import { randomUUID } from "node:crypto";

import { alarms, equipment, events, getDashboardSummary, mapSnapshot, missions, robots, tasks } from "../data/mockData.js";
import { loadPersistedState, savePersistedState } from "./persistence.js";
import type { AutoTaskStatus, Coordinate, CreateTaskInput, EventItem, Mission, OverrideInput, Robot, Task, TaskType } from "../types.js";

const validTaskTypes: TaskType[] = ["MOVE", "PICK", "DROP", "GO_CHARGE"];
const validOverrideActions: OverrideInput["action"][] = ["PAUSE", "RESUME", "CANCEL", "REASSIGN"];

interface EventFilters {
  type?: string;
  source?: string;
  q?: string;
}

interface DispatchPlan {
  robot: Robot;
  route: Coordinate[];
  sourceWaypointIndex: number;
}

interface RouteCandidate {
  route: Coordinate[];
  sourceWaypointIndex: number;
}

interface BatteryClock {
  lastUpdatedAt: number;
  dischargeAccumulatorMs: number;
  chargeAccumulatorMs: number;
}

const targetMoveStepByTaskType: Record<TaskType, string> = {
  MOVE: "MOVE_TO_TARGET",
  PICK: "MOVE_TO_TARGET",
  DROP: "MOVE_TO_DROP",
  GO_CHARGE: "MOVE_TO_CHARGER"
};

const targetHandshakeStepByTaskType: Record<TaskType, string> = {
  MOVE: "TARGET_HANDSHAKE",
  PICK: "EQUIPMENT_HANDSHAKE",
  DROP: "DROP_HANDSHAKE",
  GO_CHARGE: "CHARGER_HANDSHAKE"
};

const routeOverlapClearance = 24;
const structureClearance = 10;
const serviceAisleY = 930;
const upperServiceAisleY = 80;
const serviceAisleYs = [serviceAisleY, upperServiceAisleY];
const safeAisleXs = [55, 245, 390, 590, 730, 920, 1070, 1270, 1425, 1625];
const stationAccessGap = 25;
const batteryDischargeIntervalMs = 5 * 60 * 1000;
const batteryChargeIntervalMs = 60 * 1000;
const stationHandshakeMs = 2000;
const lowBatteryThreshold = 20;
const chargeStopThreshold = 80;
const chargerArrivalTolerance = 36;
const batteryClocks = new Map<string, BatteryClock>();

const productionLineNumbers = Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0"));
const autoTaskTemplates: Array<Omit<CreateTaskInput, "priority">> = productionLineNumbers.flatMap((line) => [
  { type: "PICK", source: `SPLY-${line}`, target: `PRI-${line}`, memo: `routine ${line}: supply deck to primary equipment` },
  { type: "MOVE", source: `PRI-${line}`, target: `INV-${line}`, memo: `routine ${line}: primary equipment to turnover unit` },
  { type: "MOVE", source: `INV-${line}`, target: `SEC-${line}`, memo: `routine ${line}: turnover unit to secondary equipment` },
  { type: "DROP", source: `SEC-${line}`, target: `DRP-${line}`, memo: `routine ${line}: secondary equipment to drop port` }
]);

const autoTaskState = {
  enabled: true,
  intervalMs: 7000,
  cursor: 0,
  generatedCount: 0,
  lastGeneratedAt: null as string | null,
  lastTaskId: null as string | null,
  lastMissionId: null as string | null,
  lastAttemptAt: 0
};

function nextDomainId(prefix: "T" | "M", existingIds: string[]) {
  let next = Math.floor(Math.random() * 9000 + 1000);
  while (existingIds.includes(`${prefix}-${next}`)) {
    next = Math.floor(Math.random() * 9000 + 1000);
  }
  return `${prefix}-${next}`;
}

function stationCenter(id: string): Coordinate | undefined {
  const station = mapSnapshot.stations.find((item) => item.id === id);
  if (!station) {
    return undefined;
  }
  return { x: station.x + station.width / 2, y: station.y + station.height / 2 };
}

function stationById(id: string) {
  return mapSnapshot.stations.find((item) => item.id === id);
}

function chargerStations() {
  return mapSnapshot.stations.filter((station) => station.type === "CHARGER");
}

function nearestChargerId(source: Coordinate) {
  return chargerStations()
    .sort(
      (left, right) =>
        Math.hypot(stationCenter(left.id)!.x - source.x, stationCenter(left.id)!.y - source.y) -
        Math.hypot(stationCenter(right.id)!.x - source.x, stationCenter(right.id)!.y - source.y)
    )[0]?.id;
}

function locationCoordinate(id: string, fallback: Coordinate): Coordinate {
  const station = stationCenter(id);
  if (station) {
    return station;
  }

  const robot = robots.find((item) => item.id === id);
  if (robot) {
    return { x: robot.x, y: robot.y };
  }

  const bufferLane = mapSnapshot.lanes.find((lane) => lane.id === "LANE-SPINE")?.points ?? [];
  const bufferPoint = bufferLane[Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % bufferLane.length];
  return bufferPoint ?? fallback;
}

function headingBetween(from: Coordinate, to: Coordinate) {
  return Math.round(((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360);
}

function cleanRoute(route: Coordinate[]) {
  return route.filter((point, index) => {
    const previous = route[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function segmentPairs(route: Coordinate[]) {
  const segments: Array<[Coordinate, Coordinate]> = [];
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    if (from.x !== to.x || from.y !== to.y) {
      segments.push([from, to]);
    }
  }
  return segments;
}

function cross(left: Coordinate, right: Coordinate) {
  return left.x * right.y - left.y * right.x;
}

function dot(left: Coordinate, right: Coordinate) {
  return left.x * right.x + left.y * right.y;
}

function pointToLineDistance(point: Coordinate, start: Coordinate, end: Coordinate) {
  const line = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(line.x, line.y);
  if (!length) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  return Math.abs(cross({ x: point.x - start.x, y: point.y - start.y }, line)) / length;
}

function routeDistance(route: Coordinate[]) {
  return segmentPairs(route).reduce((total, [from, to]) => total + Math.hypot(to.x - from.x, to.y - from.y), 0);
}

function segmentsOverlap(activeStart: Coordinate, activeEnd: Coordinate, candidateStart: Coordinate, candidateEnd: Coordinate) {
  const activeVector = { x: activeEnd.x - activeStart.x, y: activeEnd.y - activeStart.y };
  const candidateVector = { x: candidateEnd.x - candidateStart.x, y: candidateEnd.y - candidateStart.y };
  const activeLength = Math.hypot(activeVector.x, activeVector.y);
  const candidateLength = Math.hypot(candidateVector.x, candidateVector.y);
  if (!activeLength || !candidateLength) {
    return false;
  }

  const parallelScale = Math.abs(cross(activeVector, candidateVector)) / (activeLength * candidateLength);
  if (parallelScale > 0.08) {
    return false;
  }

  const distanceToCandidateLine = Math.min(
    pointToLineDistance(candidateStart, activeStart, activeEnd),
    pointToLineDistance(candidateEnd, activeStart, activeEnd)
  );
  if (distanceToCandidateLine > routeOverlapClearance) {
    return false;
  }

  const activeUnit = { x: activeVector.x / activeLength, y: activeVector.y / activeLength };
  const candidateStartProjection = dot({ x: candidateStart.x - activeStart.x, y: candidateStart.y - activeStart.y }, activeUnit);
  const candidateEndProjection = dot({ x: candidateEnd.x - activeStart.x, y: candidateEnd.y - activeStart.y }, activeUnit);
  const candidateMin = Math.min(candidateStartProjection, candidateEndProjection);
  const candidateMax = Math.max(candidateStartProjection, candidateEndProjection);
  const overlap = Math.min(activeLength, candidateMax) - Math.max(0, candidateMin);
  return overlap > routeOverlapClearance;
}

function accessCoordinates(id: string, fallback: Coordinate, towardId?: string): Coordinate[] {
  const station = stationById(id);
  if (!station) {
    return [locationCoordinate(id, fallback)];
  }

  if (station.type === "CHARGER") {
    return [{ x: station.x + station.width / 2, y: station.y - stationAccessGap }];
  }

  const toward = towardId ? stationById(towardId) ?? robots.find((robot) => robot.id === towardId) : undefined;
  const stationCenterX = station.x + station.width / 2;
  const towardX = toward && "width" in toward ? toward.x + toward.width / 2 : toward?.x;
  const exitsRight = towardX === undefined ? stationCenterX < mapSnapshot.width / 2 : towardX >= stationCenterX;
  const leftAccess = { x: station.x - stationAccessGap, y: station.y + station.height / 2 };
  const rightAccess = { x: station.x + station.width + stationAccessGap, y: station.y + station.height / 2 };
  return exitsRight ? [rightAccess, leftAccess] : [leftAccess, rightAccess];
}

function solidStructureRects() {
  return [
    ...mapSnapshot.stations,
    ...mapSnapshot.obstacles.filter((obstacle) => obstacle.type !== "FENCE")
  ].map((rect) => ({
    x: rect.x - structureClearance,
    y: rect.y - structureClearance,
    width: rect.width + structureClearance * 2,
    height: rect.height + structureClearance * 2
  }));
}

function pointInsideRect(point: Coordinate, rect: { x: number; y: number; width: number; height: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function orientation(left: Coordinate, right: Coordinate, point: Coordinate) {
  const value = (right.y - left.y) * (point.x - right.x) - (right.x - left.x) * (point.y - right.y);
  if (Math.abs(value) < 0.0001) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function onSegment(left: Coordinate, point: Coordinate, right: Coordinate) {
  return (
    point.x <= Math.max(left.x, right.x) &&
    point.x >= Math.min(left.x, right.x) &&
    point.y <= Math.max(left.y, right.y) &&
    point.y >= Math.min(left.y, right.y)
  );
}

function lineSegmentsIntersect(leftStart: Coordinate, leftEnd: Coordinate, rightStart: Coordinate, rightEnd: Coordinate) {
  const o1 = orientation(leftStart, leftEnd, rightStart);
  const o2 = orientation(leftStart, leftEnd, rightEnd);
  const o3 = orientation(rightStart, rightEnd, leftStart);
  const o4 = orientation(rightStart, rightEnd, leftEnd);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  return (
    (o1 === 0 && onSegment(leftStart, rightStart, leftEnd)) ||
    (o2 === 0 && onSegment(leftStart, rightEnd, leftEnd)) ||
    (o3 === 0 && onSegment(rightStart, leftStart, rightEnd)) ||
    (o4 === 0 && onSegment(rightStart, leftEnd, rightEnd))
  );
}

function segmentIntersectsRect(start: Coordinate, end: Coordinate, rect: { x: number; y: number; width: number; height: number }) {
  if (pointInsideRect(start, rect) || pointInsideRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft]
  ].some(([edgeStart, edgeEnd]) => lineSegmentsIntersect(start, end, edgeStart, edgeEnd));
}

function routeIntersectsStructures(route: Coordinate[]) {
  const rects = solidStructureRects();
  return segmentPairs(route).some(([start, end]) => rects.some((rect) => segmentIntersectsRect(start, end, rect)));
}

function routeViaServiceAisle(from: Coordinate, to: Coordinate, y: number, viaX = from.x) {
  return cleanRoute([from, { x: viaX, y: from.y }, { x: viaX, y }, { x: to.x, y }, to]);
}

function safePathCandidates(from: Coordinate, to: Coordinate) {
  const candidates = [
    cleanRoute([from, to]),
    ...serviceAisleYs.flatMap((y) => [from.x, ...safeAisleXs].map((viaX) => routeViaServiceAisle(from, to, y, viaX)))
  ];
  return candidates.filter((route) => !routeIntersectsStructures(route)).sort((left, right) => routeDistance(left) - routeDistance(right));
}

function buildRouteCandidates(robot: Robot, task: Task) {
  const start = { x: robot.x, y: robot.y };
  const candidates: RouteCandidate[] = [];

  for (const source of accessCoordinates(task.source, start, task.target)) {
    const toSourceCandidates = safePathCandidates(start, source);
    if (!toSourceCandidates.length) {
      continue;
    }

    for (const target of accessCoordinates(task.target, source, task.source)) {
      const toTargetCandidates = safePathCandidates(source, target);
      for (const toSource of toSourceCandidates) {
        for (const toTarget of toTargetCandidates) {
          const route = cleanRoute([...toSource, ...toTarget.slice(1)]);
          if (!routeIntersectsStructures(route)) {
            candidates.push({
              route,
              sourceWaypointIndex: Math.max(0, toSource.length - 1)
            });
          }
        }
      }
    }
  }

  return candidates.sort((left, right) => routeDistance(left.route) - routeDistance(right.route));
}

export class FmsStore {
  constructor() {
    loadPersistedState(this.stateRefs());
  }

  private stateRefs() {
    return { robots, tasks, missions, alarms, events, equipment, mapSnapshot, autoTaskState };
  }

  private persist() {
    savePersistedState(this.stateRefs());
  }

  getDashboardSummary() {
    return getDashboardSummary();
  }

  getMap() {
    return mapSnapshot;
  }

  getRobots() {
    return robots;
  }

  getAutoTaskStatus(): AutoTaskStatus {
    return {
      enabled: autoTaskState.enabled,
      intervalMs: autoTaskState.intervalMs,
      generatedCount: autoTaskState.generatedCount,
      lastGeneratedAt: autoTaskState.lastGeneratedAt,
      lastTaskId: autoTaskState.lastTaskId,
      lastMissionId: autoTaskState.lastMissionId,
      idleRobots: this.getIdleRobots().length,
      queuedTasks: tasks.filter((task) => task.status === "QUEUED").length,
      activeMissions: missions.filter((mission) => mission.state === "RUNNING" || mission.state === "QUEUED").length
    };
  }

  updateAutoTaskStatus(input: Partial<Pick<AutoTaskStatus, "enabled" | "intervalMs">>) {
    if (typeof input.enabled === "boolean") {
      autoTaskState.enabled = input.enabled;
    }
    if (typeof input.intervalMs === "number" && Number.isFinite(input.intervalMs)) {
      autoTaskState.intervalMs = Math.max(3000, Math.min(60000, Math.round(input.intervalMs)));
    }
    this.appendEvent("simulation.auto_tasks.updated", "simulation", {
      enabled: autoTaskState.enabled,
      intervalMs: autoTaskState.intervalMs
    });
    this.persist();
    return this.getAutoTaskStatus();
  }

  runAutoTaskScheduler(options: { force?: boolean } = {}) {
    this.dispatchLowBatteryRobots();
    this.dispatchQueuedTasks();

    if (!autoTaskState.enabled && !options.force) {
      const status = this.getAutoTaskStatus();
      this.persist();
      return status;
    }

    const now = Date.now();
    if (!options.force && now - autoTaskState.lastAttemptAt < autoTaskState.intervalMs) {
      const status = this.getAutoTaskStatus();
      this.persist();
      return status;
    }

    autoTaskState.lastAttemptAt = now;
    const idleRobots = this.getIdleRobots();
    if (!idleRobots.length) {
      const status = this.getAutoTaskStatus();
      this.persist();
      return status;
    }

    const generatedLimit = Math.min(idleRobots.length, 2);
    let generatedThisRun = 0;
    let attempts = 0;
    while (generatedThisRun < generatedLimit && attempts < autoTaskTemplates.length) {
      const template = autoTaskTemplates[autoTaskState.cursor % autoTaskTemplates.length];
      autoTaskState.cursor += 1;
      attempts += 1;
      if (this.isTemplateCellBusy(template) || !this.isTemplateDispatchable(template)) {
        continue;
      }
      const taskResult = this.createTask({
        ...template,
        priority: 3 + ((autoTaskState.cursor + generatedThisRun) % 3)
      });
      if ("error" in taskResult) {
        this.appendEvent("simulation.auto_task.failed", "simulation", { template, error: taskResult.error });
        continue;
      }
      generatedThisRun += 1;
      autoTaskState.generatedCount += 1;
      autoTaskState.lastGeneratedAt = new Date(now).toISOString();
      autoTaskState.lastTaskId = taskResult.data.id;
      autoTaskState.lastMissionId = taskResult.data.missionId ?? null;
      this.appendEvent("simulation.auto_task.created", taskResult.data.id, {
        taskId: taskResult.data.id,
        missionId: taskResult.data.missionId ?? null,
        source: taskResult.data.source,
        target: taskResult.data.target
      });
    }

    const status = this.getAutoTaskStatus();
    this.persist();
    return status;
  }

  tickRobotPositions(now = Date.now()) {
    const speedPerTick = 28;
    let completedAnyMission = false;
    const batteryStateChanged = this.updateRobotBatteries(now);

    for (const robot of robots) {
      if (robot.state !== "MOVING" || robot.route.length < 2) {
        continue;
      }

      const heldState = this.advanceHeldMission(robot, now);
      if (heldState === "WAIT") {
        continue;
      }
      if (heldState === "COMPLETED") {
        completedAnyMission = true;
        continue;
      }

      const targetIndex = robot.routeIndex;
      const target = robot.route[targetIndex];
      if (!target) {
        completedAnyMission = this.completeRobotMission(robot) || completedAnyMission;
        continue;
      }

      const dx = target.x - robot.x;
      const dy = target.y - robot.y;
      const distance = Math.hypot(dx, dy);

      const reachedWaypoint = distance <= speedPerTick;
      if (reachedWaypoint) {
        robot.x = target.x;
        robot.y = target.y;
        robot.routeIndex += 1;
      } else {
        robot.x += (dx / distance) * speedPerTick;
        robot.y += (dy / distance) * speedPerTick;
      }

      robot.heading = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
      robot.currentCell = `X${Math.round(robot.x)} Y${Math.round(robot.y)}`;
      this.updateMissionProgress(robot);

      if (reachedWaypoint && this.startSourceHandshake(robot, targetIndex, now)) {
        continue;
      }

      if (reachedWaypoint && targetIndex === robot.route.length - 1) {
        if (this.startTargetHandshake(robot, now)) {
          continue;
        }
        completedAnyMission = this.completeRobotMission(robot) || completedAnyMission;
        continue;
      }

      this.appendEvent("robot.position", robot.id, {
        robotId: robot.id,
        x: Math.round(robot.x),
        y: Math.round(robot.y),
        heading: robot.heading
      });
    }

    const chargeDispatched = this.dispatchLowBatteryRobots();
    if (completedAnyMission || batteryStateChanged || chargeDispatched) {
      this.dispatchQueuedTasks();
    }
    this.persist();
  }

  getRobot(id: string) {
    return robots.find((robot) => robot.id === id);
  }

  getRobotEvents(id: string) {
    return events.filter((event) => event.source === id || event.payload.robotId === id);
  }

  getTasks() {
    return [...tasks].sort((left, right) => right.priority - left.priority);
  }

  createTask(input: CreateTaskInput) {
    if (!validTaskTypes.includes(input.type)) {
      return { error: "Invalid task type", status: 400 } as const;
    }
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 5) {
      return { error: "Priority must be an integer between 1 and 5", status: 400 } as const;
    }
    if (!input.source.trim()) {
      return { error: "Source is required", status: 400 } as const;
    }

    const chargerId = nearestChargerId(locationCoordinate(input.source, { x: 500, y: 500 })) ?? "CH-01";
    const resolvedTarget = input.type === "GO_CHARGE" ? chargerId : input.target?.trim();
    if (!resolvedTarget) {
      return { error: "Target is required", status: 400 } as const;
    }
    if (input.source === resolvedTarget) {
      return { error: "Source and target cannot be the same", status: 400 } as const;
    }

    const task: Task = {
      id: nextDomainId("T", tasks.map((item) => item.id)),
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      type: input.type,
      priority: input.priority,
      source: input.source,
      target: resolvedTarget,
      memo: input.memo
    };
    tasks.unshift(task);
    this.appendEvent("task.created", task.id, { ...task });
    this.dispatchTask(task);
    this.persist();
    return { data: task } as const;
  }

  updateTask(id: string, patch: Partial<Pick<Task, "priority" | "status" | "memo" | "target">>) {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return undefined;
    }
    Object.assign(task, patch);
    this.appendEvent("task.updated", id, patch);
    this.persist();
    return task;
  }

  cancelTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return { error: "Task not found", status: 404 } as const;
    }
    if (task.status === "RUNNING") {
      return { error: "Running tasks cannot be canceled", status: 409 } as const;
    }
    task.status = "CANCELED";
    const mission = missions.find((item) => item.taskId === task.id && item.state !== "COMPLETED");
    if (mission) {
      mission.state = "COMPLETED";
      mission.progress = 100;
      mission.currentStep = "CANCELED";
      const robot = robots.find((item) => item.id === mission.robotId);
      if (robot) {
        this.releaseRobot(robot);
      }
    }
    this.appendEvent("task.canceled", id, { id });
    this.dispatchQueuedTasks();
    this.persist();
    return { data: task } as const;
  }

  getMissions() {
    return missions;
  }

  getActiveMissions() {
    return missions.filter((mission) => mission.state !== "COMPLETED");
  }

  updateMission(id: string, patch: Partial<Pick<Mission, "state" | "currentStep" | "progress">>) {
    const mission = missions.find((item) => item.id === id);
    if (!mission) {
      return undefined;
    }
    Object.assign(mission, patch);
    this.appendEvent("mission.state.changed", id, patch);
    this.persist();
    return mission;
  }

  applyOverride(id: string, input: OverrideInput) {
    const mission = missions.find((item) => item.id === id);
    if (!mission) {
      return { error: "Mission not found", status: 404 } as const;
    }
    if (!validOverrideActions.includes(input.action)) {
      return { error: "Invalid override action", status: 400 } as const;
    }
    if (!input.reason.trim()) {
      return { error: "Reason is required", status: 400 } as const;
    }

    mission.needsManualOverride = false;
    if (input.action === "PAUSE") {
      mission.state = "PAUSED";
      const robot = robots.find((item) => item.id === mission.robotId);
      if (robot) {
        robot.state = "WAITING_PATH";
      }
    }
    if (input.action === "RESUME") {
      mission.state = "RUNNING";
      const robot = robots.find((item) => item.id === mission.robotId);
      if (robot) {
        robot.state = "MOVING";
      }
    }
    if (input.action === "CANCEL") {
      mission.state = "COMPLETED";
      const linkedTask = tasks.find((task) => task.id === mission.taskId);
      if (linkedTask) {
        linkedTask.status = "CANCELED";
      }
      const robot = robots.find((item) => item.id === mission.robotId);
      if (robot) {
        this.releaseRobot(robot);
      }
    }
    if (input.action === "REASSIGN" && input.targetRobotId) {
      const previousRobot = robots.find((item) => item.id === mission.robotId);
      const nextRobot = robots.find((item) => item.id === input.targetRobotId);
      const linkedTask = tasks.find((task) => task.id === mission.taskId);
      if (!nextRobot) {
        return { error: "Target robot not found", status: 404 } as const;
      }
      if (nextRobot.missionId && nextRobot.missionId !== mission.id) {
        return { error: "Target robot already has an active mission", status: 409 } as const;
      }
      const dispatchPlan = linkedTask ? this.buildDispatchPlanForRobot(nextRobot, linkedTask, [mission.id]) : undefined;
      if (linkedTask && !dispatchPlan) {
        return { error: "No collision-free route available for target robot", status: 409 } as const;
      }
      if (previousRobot && previousRobot.id !== nextRobot.id) {
        this.releaseRobot(previousRobot);
      }
      mission.robotId = input.targetRobotId;
      mission.state = "RUNNING";
      if (linkedTask && dispatchPlan) {
        this.assignMissionToRobot(nextRobot, mission, linkedTask, dispatchPlan);
      }
    }
    this.appendEvent("mission.override.applied", id, {
      operator: input.operator,
      action: input.action,
      reason: input.reason,
      targetRobotId: input.targetRobotId
    });
    this.persist();
    return { data: mission } as const;
  }

  getEquipment() {
    return equipment;
  }

  resetEquipment(id: string) {
    const target = equipment.find((item) => item.id === id);
    if (!target) {
      return undefined;
    }
    target.state = "READY";
    target.signal = "MANUAL_RESET";
    target.lastUpdated = new Date().toISOString();
    this.appendEvent("equipment.state.changed", id, { ...target });
    this.persist();
    return target;
  }

  getAlarms() {
    return alarms;
  }

  ackAlarm(id: string, user: string) {
    const alarm = alarms.find((item) => item.id === id);
    if (!alarm) {
      return { error: "Alarm not found", status: 404 } as const;
    }
    if (alarm.status !== "OPEN") {
      return { error: "Only open alarms can be acknowledged", status: 409 } as const;
    }
    alarm.status = "ACKED";
    alarm.acknowledgedBy = user;
    this.appendEvent("alarm.acked", id, { user });
    this.persist();
    return { data: alarm } as const;
  }

  resolveAlarm(id: string, user: string) {
    const alarm = alarms.find((item) => item.id === id);
    if (!alarm) {
      return { error: "Alarm not found", status: 404 } as const;
    }
    if (alarm.status === "RESOLVED") {
      return { error: "Alarm already resolved", status: 409 } as const;
    }
    alarm.status = "RESOLVED";
    alarm.resolvedBy = user;
    this.appendEvent("alarm.resolved", id, { user });
    this.persist();
    return { data: alarm } as const;
  }

  getEvents(filters: EventFilters = {}) {
    const type = filters.type?.trim();
    const source = filters.source?.trim().toLowerCase();
    const query = filters.q?.trim().toLowerCase();

    return [...events]
      .filter((event) => {
        if (type && event.type !== type) {
          return false;
        }
        if (source && !event.source.toLowerCase().includes(source)) {
          return false;
        }
        if (query) {
          const haystack = `${event.id} ${event.type} ${event.source} ${JSON.stringify(event.payload)}`.toLowerCase();
          return haystack.includes(query);
        }
        return true;
      })
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  exportEventsCsv(filters: EventFilters = {}) {
    const header = "id,type,source,timestamp,payload";
    const rows = this.getEvents(filters).map((event) =>
      [event.id, event.type, event.source, event.timestamp, JSON.stringify(event.payload).replaceAll('"', '""')].join(",")
    );
    return [header, ...rows].join("\n");
  }

  private appendEvent(type: string, source: string, payload: Record<string, unknown>) {
    const event: EventItem = {
      id: randomUUID(),
      type,
      source,
      timestamp: new Date().toISOString(),
      payload
    };
    events.unshift(event);
    if (events.length > 300) {
      events.pop();
    }
  }

  private dispatchQueuedTasks() {
    for (const task of [...tasks].filter((item) => item.status === "QUEUED").sort((left, right) => right.priority - left.priority)) {
      this.dispatchTask(task);
    }
  }

  private updateRobotBatteries(now: number) {
    let changed = false;

    for (const robot of robots) {
      const clock = batteryClocks.get(robot.id) ?? {
        lastUpdatedAt: now,
        dischargeAccumulatorMs: 0,
        chargeAccumulatorMs: 0
      };
      const elapsedMs = Math.max(0, now - clock.lastUpdatedAt);
      clock.lastUpdatedAt = now;
      batteryClocks.set(robot.id, clock);

      if (!elapsedMs) {
        continue;
      }

      if (robot.state === "CHARGING") {
        clock.dischargeAccumulatorMs = 0;
        clock.chargeAccumulatorMs += elapsedMs;
        const chargeSteps = Math.floor(clock.chargeAccumulatorMs / batteryChargeIntervalMs);
        if (chargeSteps > 0) {
          const previousBattery = robot.battery;
          robot.battery = Math.min(100, robot.battery + chargeSteps);
          clock.chargeAccumulatorMs %= batteryChargeIntervalMs;
          changed = changed || robot.battery !== previousBattery;
          if (robot.battery !== previousBattery) {
            this.appendEvent("robot.battery.changed", robot.id, {
              robotId: robot.id,
              battery: robot.battery,
              mode: "charging"
            });
          }
        }
        if (robot.battery >= chargeStopThreshold) {
          this.stopChargingRobot(robot);
          changed = true;
        }
        continue;
      }

      clock.chargeAccumulatorMs = 0;
      if (robot.state !== "MOVING") {
        clock.dischargeAccumulatorMs = 0;
        continue;
      }

      clock.dischargeAccumulatorMs += elapsedMs;
      const dischargeSteps = Math.floor(clock.dischargeAccumulatorMs / batteryDischargeIntervalMs);
      if (dischargeSteps > 0) {
        const previousBattery = robot.battery;
        robot.battery = Math.max(0, robot.battery - dischargeSteps);
        clock.dischargeAccumulatorMs %= batteryDischargeIntervalMs;
        changed = changed || robot.battery !== previousBattery;
        if (robot.battery !== previousBattery) {
          this.appendEvent("robot.battery.changed", robot.id, {
            robotId: robot.id,
            battery: robot.battery,
            mode: "discharging"
          });
        }
      }
    }

    return changed;
  }

  private dispatchLowBatteryRobots() {
    let dispatched = false;

    for (const robot of robots) {
      if (robot.state !== "IDLE" || robot.missionId || robot.battery > lowBatteryThreshold || this.hasPendingChargeTask(robot.id)) {
        continue;
      }

      const chargerId = nearestChargerId({ x: robot.x, y: robot.y }) ?? "CH-01";
      if (this.isRobotAtStation(robot, chargerId)) {
        this.startChargingRobot(robot, chargerId);
        dispatched = true;
        continue;
      }

      const taskResult = this.createTask({
        type: "GO_CHARGE",
        priority: 5,
        source: robot.id,
        memo: `auto: battery ${robot.battery}% below charge threshold`
      });

      if ("error" in taskResult) {
        this.appendEvent("robot.charge_dispatch.failed", robot.id, {
          robotId: robot.id,
          battery: robot.battery,
          error: taskResult.error
        });
        continue;
      }

      this.appendEvent("robot.charge_dispatch.created", robot.id, {
        robotId: robot.id,
        battery: robot.battery,
        taskId: taskResult.data.id,
        missionId: taskResult.data.missionId ?? null,
        target: taskResult.data.target
      });
      dispatched = true;
    }

    return dispatched;
  }

  private hasPendingChargeTask(robotId: string) {
    return tasks.some(
      (task) => task.type === "GO_CHARGE" && task.source === robotId && !["COMPLETED", "CANCELED"].includes(task.status)
    );
  }

  private isTemplateCellBusy(template: Omit<CreateTaskInput, "priority">) {
    const cells = [template.source, template.target].filter((cell): cell is string => Boolean(cell));
    return cells.some((cell) => {
      const reservedByRobot = robots.some((robot) => robot.reservedCells.includes(cell));
      const reservedByTask = tasks.some(
        (task) => !["COMPLETED", "CANCELED"].includes(task.status) && (task.source === cell || task.target === cell)
      );
      return reservedByRobot || reservedByTask;
    });
  }

  private isTemplateDispatchable(template: Omit<CreateTaskInput, "priority">) {
    const target = template.type === "GO_CHARGE" ? nearestChargerId(locationCoordinate(template.source, { x: 500, y: 500 })) : template.target;
    if (!target) {
      return false;
    }

    const task: Task = {
      id: "__AUTO_TEMPLATE__",
      type: template.type,
      priority: 3,
      status: "QUEUED",
      source: template.source,
      target,
      memo: template.memo,
      createdAt: new Date().toISOString()
    };
    return Boolean(this.findDispatchRobot(task));
  }

  private isRobotAtStation(robot: Robot, stationId: string) {
    const station = stationCenter(stationId);
    if (!station) {
      return false;
    }
    return Math.hypot(robot.x - station.x, robot.y - station.y) <= chargerArrivalTolerance;
  }

  private getIdleRobots() {
    return robots.filter((robot) => robot.state === "IDLE" && !robot.missionId && robot.battery > lowBatteryThreshold);
  }

  private dispatchTask(task: Task) {
    if (task.status !== "QUEUED") {
      return missions.find((mission) => mission.taskId === task.id);
    }

    const dispatchPlan = this.findDispatchRobot(task);
    if (!dispatchPlan) {
      this.appendEvent("mission.dispatch.waiting", task.id, { taskId: task.id, reason: "no_available_collision_free_route" });
      return undefined;
    }

    const mission: Mission = {
      id: nextDomainId("M", missions.map((item) => item.id)),
      robotId: dispatchPlan.robot.id,
      taskId: task.id,
      state: "RUNNING",
      currentStep: task.type !== "GO_CHARGE" && dispatchPlan.sourceWaypointIndex > 0 ? "MOVE_TO_SOURCE" : targetMoveStepByTaskType[task.type],
      progress: 0,
      needsManualOverride: false,
      sourceWaypointIndex: dispatchPlan.sourceWaypointIndex,
      stepStartedAt: new Date().toISOString()
    };

    missions.unshift(mission);
    task.status = "ASSIGNED";
    task.missionId = mission.id;
    if (task.type === "GO_CHARGE" && dispatchPlan.route.length < 2) {
      mission.state = "COMPLETED";
      mission.currentStep = "CHARGING";
      mission.progress = 100;
      task.status = "COMPLETED";
      this.startChargingRobot(dispatchPlan.robot, task.target);
      this.appendEvent("mission.created", mission.id, { ...mission, task });
      return mission;
    }
    this.assignMissionToRobot(dispatchPlan.robot, mission, task, dispatchPlan);
    this.appendEvent("mission.created", mission.id, { ...mission, task });
    return mission;
  }

  private findDispatchRobot(task: Task) {
    const hasEnoughBattery = (robot: Robot) => task.type === "GO_CHARGE" || robot.battery >= 35;
    const isAvailable = (robot: Robot) => robot.state === "IDLE" && !robot.missionId && hasEnoughBattery(robot);
    const sourceRobot = robots.find((robot) => robot.id === task.source && isAvailable(robot));
    if (sourceRobot) {
      return this.buildDispatchPlanForRobot(sourceRobot, task);
    }

    const source = locationCoordinate(task.source, { x: 500, y: 500 });
    const plans = robots
      .filter(isAvailable)
      .sort((left, right) => Math.hypot(left.x - source.x, left.y - source.y) - Math.hypot(right.x - source.x, right.y - source.y))
      .map((robot) => this.buildDispatchPlanForRobot(robot, task))
      .filter((plan): plan is DispatchPlan => Boolean(plan));

    return plans.sort((left, right) => routeDistance(left.route) - routeDistance(right.route))[0];
  }

  private buildDispatchPlanForRobot(robot: Robot, task: Task, ignoredMissionIds: string[] = []) {
    const candidate = buildRouteCandidates(robot, task).find((item) => !this.routeOverlapsActiveRoute(item.route, robot.id, ignoredMissionIds));
    if (!candidate) {
      return undefined;
    }
    return { robot, route: candidate.route, sourceWaypointIndex: candidate.sourceWaypointIndex };
  }

  private routeOverlapsActiveRoute(candidateRoute: Coordinate[], robotId: string, ignoredMissionIds: string[] = []) {
    const candidateSegments = segmentPairs(candidateRoute);
    for (const robot of robots) {
      if (robot.id === robotId || !robot.missionId || robot.state === "ERROR" || ignoredMissionIds.includes(robot.missionId)) {
        continue;
      }
      const mission = missions.find((item) => item.id === robot.missionId);
      if (!mission || mission.state === "COMPLETED") {
        continue;
      }
      for (const [activeStart, activeEnd] of segmentPairs(robot.route)) {
        for (const [candidateStart, candidateEnd] of candidateSegments) {
          if (segmentsOverlap(activeStart, activeEnd, candidateStart, candidateEnd)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private assignMissionToRobot(robot: Robot, mission: Mission, task: Task, dispatchPlan: Pick<DispatchPlan, "route" | "sourceWaypointIndex">) {
    const route = dispatchPlan.route;
    robot.state = "MOVING";
    robot.missionId = mission.id;
    robot.targetCell = task.target;
    robot.reservedCells = [task.source, task.target];
    robot.route = route;
    robot.routeIndex = route.length > 1 ? 1 : 0;
    robot.heading = route.length > 1 ? headingBetween(route[0], route[1]) : robot.heading;
    mission.sourceWaypointIndex = dispatchPlan.sourceWaypointIndex;
    mission.currentStep =
      task.type !== "GO_CHARGE" && dispatchPlan.sourceWaypointIndex > 0 ? "MOVE_TO_SOURCE" : targetMoveStepByTaskType[task.type];
    mission.stepStartedAt = new Date().toISOString();
    this.appendEvent("mission.dispatched", mission.id, {
      missionId: mission.id,
      taskId: task.id,
      robotId: robot.id,
      sourceWaypointIndex: mission.sourceWaypointIndex,
      route: robot.route
    });
  }

  private advanceHeldMission(robot: Robot, now: number) {
    const mission = robot.missionId ? missions.find((item) => item.id === robot.missionId) : undefined;
    if (!mission || mission.state !== "RUNNING") {
      return false;
    }

    if (!["SOURCE_HANDSHAKE", "EQUIPMENT_HANDSHAKE", "DROP_HANDSHAKE", "TARGET_HANDSHAKE", "CHARGER_HANDSHAKE"].includes(mission.currentStep)) {
      return false;
    }

    const stepStartedAt = mission.stepStartedAt ? new Date(mission.stepStartedAt).getTime() : now;
    if (now - stepStartedAt < stationHandshakeMs) {
      return "WAIT" as const;
    }

    const task = tasks.find((item) => item.id === mission.taskId);
    if (!task) {
      return false;
    }

    if (mission.currentStep === "SOURCE_HANDSHAKE") {
      mission.currentStep = targetMoveStepByTaskType[task.type];
      mission.stepStartedAt = new Date(now).toISOString();
      mission.progress = Math.max(mission.progress, 45);
      task.status = "RUNNING";
      this.appendEvent("mission.source.handshake.completed", mission.id, {
        missionId: mission.id,
        taskId: task.id,
        source: task.source,
        nextStep: mission.currentStep
      });
      return false;
    }

    return this.completeRobotMission(robot) ? ("COMPLETED" as const) : false;
  }

  private startSourceHandshake(robot: Robot, reachedWaypointIndex: number, now: number) {
    const mission = robot.missionId ? missions.find((item) => item.id === robot.missionId) : undefined;
    const task = mission ? tasks.find((item) => item.id === mission.taskId) : undefined;
    if (!mission || !task || task.type === "GO_CHARGE" || mission.state !== "RUNNING") {
      return false;
    }
    if (mission.currentStep !== "MOVE_TO_SOURCE" || mission.sourceWaypointIndex !== reachedWaypointIndex) {
      return false;
    }

    mission.currentStep = "SOURCE_HANDSHAKE";
    mission.stepStartedAt = new Date(now).toISOString();
    mission.progress = Math.max(mission.progress, 35);
    task.status = "RUNNING";
    this.appendEvent("mission.source.arrived", mission.id, {
      missionId: mission.id,
      taskId: task.id,
      source: task.source,
      robotId: robot.id
    });
    return true;
  }

  private startTargetHandshake(robot: Robot, now: number) {
    const mission = robot.missionId ? missions.find((item) => item.id === robot.missionId) : undefined;
    const task = mission ? tasks.find((item) => item.id === mission.taskId) : undefined;
    if (!mission || !task || mission.state !== "RUNNING") {
      return false;
    }
    if (["EQUIPMENT_HANDSHAKE", "DROP_HANDSHAKE", "TARGET_HANDSHAKE", "CHARGER_HANDSHAKE"].includes(mission.currentStep)) {
      return true;
    }

    mission.currentStep = targetHandshakeStepByTaskType[task.type];
    mission.stepStartedAt = new Date(now).toISOString();
    mission.progress = Math.max(mission.progress, 95);
    task.status = "RUNNING";
    this.appendEvent("mission.target.arrived", mission.id, {
      missionId: mission.id,
      taskId: task.id,
      target: task.target,
      robotId: robot.id,
      handshake: mission.currentStep
    });
    return true;
  }

  private updateMissionProgress(robot: Robot) {
    if (!robot.missionId || robot.route.length < 2) {
      return;
    }
    const mission = missions.find((item) => item.id === robot.missionId);
    if (!mission || mission.state !== "RUNNING") {
      return;
    }
    const completedLegs = Math.max(0, robot.routeIndex - 1);
    const totalLegs = Math.max(1, robot.route.length - 1);
    mission.progress = Math.max(mission.progress, Math.min(99, Math.round((completedLegs / totalLegs) * 100)));
  }

  private completeRobotMission(robot: Robot) {
    if (!robot.missionId) {
      this.releaseRobot(robot);
      return false;
    }

    const mission = missions.find((item) => item.id === robot.missionId);
    const task = mission ? tasks.find((item) => item.id === mission.taskId) : undefined;
    if (!mission) {
      this.releaseRobot(robot);
      return false;
    }

    mission.state = "COMPLETED";
    mission.currentStep = "COMPLETED";
    mission.progress = 100;
    mission.stepStartedAt = new Date().toISOString();
    if (task) {
      task.status = "COMPLETED";
    }
    this.appendEvent("mission.completed", mission.id, {
      missionId: mission.id,
      taskId: mission.taskId,
      robotId: robot.id
    });
    if (task?.type === "GO_CHARGE") {
      this.startChargingRobot(robot, task.target);
      return true;
    }
    this.releaseRobot(robot);
    return true;
  }

  private startChargingRobot(robot: Robot, stationId: string) {
    robot.state = "CHARGING";
    robot.missionId = null;
    robot.targetCell = stationId;
    robot.currentCell = stationId;
    robot.reservedCells = [stationId];
    robot.route = [{ x: robot.x, y: robot.y }];
    robot.routeIndex = 0;
    this.appendEvent("robot.charging.started", robot.id, {
      robotId: robot.id,
      stationId,
      battery: robot.battery
    });
  }

  private stopChargingRobot(robot: Robot) {
    const stationId = robot.currentCell;
    robot.state = "IDLE";
    robot.targetCell = null;
    robot.reservedCells = [];
    robot.route = [{ x: robot.x, y: robot.y }];
    robot.routeIndex = 0;
    this.appendEvent("robot.charging.stopped", robot.id, {
      robotId: robot.id,
      stationId,
      battery: robot.battery
    });
  }

  private releaseRobot(robot: Robot) {
    robot.state = "IDLE";
    robot.missionId = null;
    robot.targetCell = null;
    robot.reservedCells = [];
    robot.route = [{ x: robot.x, y: robot.y }];
    robot.routeIndex = 0;
  }
}

export const store = new FmsStore();

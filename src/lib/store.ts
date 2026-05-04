import { randomUUID } from "node:crypto";

import { alarms, equipment, events, getDashboardSummary, mapSnapshot, missions, robots, tasks } from "../data/mockData.js";
import type { Coordinate, CreateTaskInput, EventItem, Mission, OverrideInput, Robot, Task, TaskType } from "../types.js";

const validTaskTypes: TaskType[] = ["MOVE", "PICK", "DROP", "GO_CHARGE"];
const validOverrideActions: OverrideInput["action"][] = ["PAUSE", "RESUME", "CANCEL", "REASSIGN"];

interface EventFilters {
  type?: string;
  source?: string;
  q?: string;
}

const missionStepByTaskType: Record<TaskType, string> = {
  MOVE: "MOVE_TO_TARGET",
  PICK: "MOVE_TO_PICK",
  DROP: "MOVE_TO_DROP",
  GO_CHARGE: "MOVE_TO_CHARGER"
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

export class FmsStore {
  getDashboardSummary() {
    return getDashboardSummary();
  }

  getMap() {
    return mapSnapshot;
  }

  getRobots() {
    return robots;
  }

  tickRobotPositions() {
    const speedPerTick = 28;
    let completedAnyMission = false;

    for (const robot of robots) {
      if (robot.state !== "MOVING" || robot.route.length < 2) {
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

      if (distance <= speedPerTick) {
        robot.x = target.x;
        robot.y = target.y;
        robot.routeIndex = (robot.routeIndex + 1) % robot.route.length;
      } else {
        robot.x += (dx / distance) * speedPerTick;
        robot.y += (dy / distance) * speedPerTick;
      }

      robot.heading = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
      robot.currentCell = `X${Math.round(robot.x)} Y${Math.round(robot.y)}`;
      this.updateMissionProgress(robot);

      if (distance <= speedPerTick && robot.routeIndex >= robot.route.length - 1) {
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

    if (completedAnyMission) {
      this.dispatchQueuedTasks();
    }
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

    const chargerId = mapSnapshot.stations.find((station) => station.type === "CHARGER")?.id ?? "CH-01";
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
    return { data: task } as const;
  }

  updateTask(id: string, patch: Partial<Pick<Task, "priority" | "status" | "memo" | "target">>) {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return undefined;
    }
    Object.assign(task, patch);
    this.appendEvent("task.updated", id, patch);
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
      if (previousRobot && previousRobot.id !== nextRobot.id) {
        this.releaseRobot(previousRobot);
      }
      mission.robotId = input.targetRobotId;
      mission.state = "RUNNING";
      if (linkedTask) {
        this.assignMissionToRobot(nextRobot, mission, linkedTask);
      }
    }
    this.appendEvent("mission.override.applied", id, {
      operator: input.operator,
      action: input.action,
      reason: input.reason,
      targetRobotId: input.targetRobotId
    });
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

  private dispatchTask(task: Task) {
    if (task.status !== "QUEUED") {
      return missions.find((mission) => mission.taskId === task.id);
    }

    const robot = this.findDispatchRobot(task);
    if (!robot) {
      this.appendEvent("mission.dispatch.waiting", task.id, { taskId: task.id, reason: "no_available_robot" });
      return undefined;
    }

    const mission: Mission = {
      id: nextDomainId("M", missions.map((item) => item.id)),
      robotId: robot.id,
      taskId: task.id,
      state: "RUNNING",
      currentStep: missionStepByTaskType[task.type],
      progress: 0,
      needsManualOverride: false
    };

    missions.unshift(mission);
    task.status = "ASSIGNED";
    task.missionId = mission.id;
    this.assignMissionToRobot(robot, mission, task);
    this.appendEvent("mission.created", mission.id, { ...mission, task });
    return mission;
  }

  private findDispatchRobot(task: Task) {
    const hasEnoughBattery = (robot: Robot) => task.type === "GO_CHARGE" || robot.battery >= 35;
    const isAvailable = (robot: Robot) => robot.state !== "ERROR" && !robot.missionId && hasEnoughBattery(robot);
    const sourceRobot = robots.find((robot) => robot.id === task.source && isAvailable(robot));
    if (sourceRobot) {
      return sourceRobot;
    }

    const source = locationCoordinate(task.source, { x: 500, y: 500 });
    return robots
      .filter(isAvailable)
      .sort((left, right) => Math.hypot(left.x - source.x, left.y - source.y) - Math.hypot(right.x - source.x, right.y - source.y))[0];
  }

  private assignMissionToRobot(robot: Robot, mission: Mission, task: Task) {
    const start = { x: robot.x, y: robot.y };
    const source = locationCoordinate(task.source, start);
    const target = locationCoordinate(task.target, source);
    robot.state = "MOVING";
    robot.missionId = mission.id;
    robot.targetCell = task.target;
    robot.reservedCells = [task.source, task.target];
    robot.route = [start, source, target];
    robot.routeIndex = 1;
    robot.heading = headingBetween(start, source);
    this.appendEvent("mission.dispatched", mission.id, {
      missionId: mission.id,
      taskId: task.id,
      robotId: robot.id,
      route: robot.route
    });
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
    if (task) {
      task.status = "COMPLETED";
    }
    this.appendEvent("mission.completed", mission.id, {
      missionId: mission.id,
      taskId: mission.taskId,
      robotId: robot.id
    });
    this.releaseRobot(robot);
    return true;
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

import { randomUUID } from "node:crypto";

import { alarms, equipment, events, getDashboardSummary, mapSnapshot, missions, robots, tasks } from "../data/mockData.js";
import type { CreateTaskInput, EventItem, Mission, OverrideInput, Task, TaskType } from "../types.js";

const validTaskTypes: TaskType[] = ["MOVE", "PICK", "DROP", "GO_CHARGE"];
const validOverrideActions: OverrideInput["action"][] = ["PAUSE", "RESUME", "CANCEL", "REASSIGN"];

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
      id: `T-${Math.floor(Math.random() * 9000 + 1000)}`,
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
    this.appendEvent("task.canceled", id, { id });
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
    }
    if (input.action === "RESUME") {
      mission.state = "RUNNING";
    }
    if (input.action === "CANCEL") {
      mission.state = "COMPLETED";
      const linkedTask = tasks.find((task) => task.id === mission.taskId);
      if (linkedTask) {
        linkedTask.status = "CANCELED";
      }
    }
    if (input.action === "REASSIGN" && input.targetRobotId) {
      mission.robotId = input.targetRobotId;
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

  getEvents() {
    return [...events].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  exportEventsCsv() {
    const header = "id,type,source,timestamp,payload";
    const rows = this.getEvents().map((event) =>
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
  }
}

export const store = new FmsStore();

import { randomUUID } from "node:crypto";

import { alarms, equipment, events, getDashboardSummary, mapSnapshot, missions, robots, tasks } from "../data/mockData.js";
import type { Alarm, EventItem, Mission, Robot, Task } from "../types.js";

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

  createTask(input: Pick<Task, "type" | "priority" | "source" | "target" | "memo">) {
    const task: Task = {
      id: `T-${Math.floor(Math.random() * 9000 + 1000)}`,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      ...input
    };
    tasks.unshift(task);
    this.appendEvent("task.created", task.id, { ...task });
    return task;
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
      return undefined;
    }
    task.status = "CANCELED";
    this.appendEvent("task.canceled", id, { id });
    return task;
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

  applyOverride(id: string, operator: string, action: string, reason: string) {
    const mission = missions.find((item) => item.id === id);
    if (!mission) {
      return undefined;
    }
    mission.needsManualOverride = false;
    if (action === "RESUME") {
      mission.state = "RUNNING";
    }
    this.appendEvent("mission.override.applied", id, { operator, action, reason });
    return mission;
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
      return undefined;
    }
    alarm.status = "ACKED";
    alarm.acknowledgedBy = user;
    this.appendEvent("alarm.acked", id, { user });
    return alarm;
  }

  resolveAlarm(id: string, user: string) {
    const alarm = alarms.find((item) => item.id === id);
    if (!alarm) {
      return undefined;
    }
    alarm.status = "RESOLVED";
    alarm.resolvedBy = user;
    this.appendEvent("alarm.resolved", id, { user });
    return alarm;
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

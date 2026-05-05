import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Alarm, Equipment, EventItem, MapSnapshot, Mission, Robot, Task } from "../types.js";

export interface AutoTaskRuntimeState {
  enabled: boolean;
  intervalMs: number;
  cursor: number;
  generatedCount: number;
  lastGeneratedAt: string | null;
  lastTaskId: string | null;
  lastMissionId: string | null;
  lastAttemptAt: number;
}

export interface FmsStateRefs {
  robots: Robot[];
  tasks: Task[];
  missions: Mission[];
  alarms: Alarm[];
  events: EventItem[];
  equipment: Equipment[];
  mapSnapshot: MapSnapshot;
  autoTaskState: AutoTaskRuntimeState;
}

interface PersistedFmsState {
  version: 1;
  savedAt: string;
  robots: Robot[];
  tasks: Task[];
  missions: Mission[];
  alarms: Alarm[];
  events: EventItem[];
  equipment: Equipment[];
  mapSnapshot: MapSnapshot;
  autoTaskState: AutoTaskRuntimeState;
}

export const defaultStateFilePath = process.env.FMS_STATE_FILE ?? join(process.cwd(), "data", "fms-state.json");

function persistenceEnabled(filePath?: string) {
  if (filePath) {
    return true;
  }
  if (process.env.FMS_PERSISTENCE === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}

function replaceArray<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

function toPersistedState(state: FmsStateRefs): PersistedFmsState {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    robots: state.robots,
    tasks: state.tasks,
    missions: state.missions,
    alarms: state.alarms,
    events: state.events,
    equipment: state.equipment,
    mapSnapshot: state.mapSnapshot,
    autoTaskState: state.autoTaskState
  };
}

export function loadPersistedState(state: FmsStateRefs, filePath?: string) {
  const resolvedFilePath = filePath ?? defaultStateFilePath;
  if (!persistenceEnabled(filePath) || !existsSync(resolvedFilePath)) {
    return false;
  }

  const persisted = JSON.parse(readFileSync(resolvedFilePath, "utf8")) as Partial<PersistedFmsState>;
  if (persisted.version !== 1) {
    return false;
  }

  if (persisted.robots) replaceArray(state.robots, persisted.robots);
  if (persisted.tasks) replaceArray(state.tasks, persisted.tasks);
  if (persisted.missions) replaceArray(state.missions, persisted.missions);
  if (persisted.alarms) replaceArray(state.alarms, persisted.alarms);
  if (persisted.events) replaceArray(state.events, persisted.events);
  if (persisted.equipment) replaceArray(state.equipment, persisted.equipment);
  if (persisted.mapSnapshot) Object.assign(state.mapSnapshot, persisted.mapSnapshot);
  if (persisted.autoTaskState) Object.assign(state.autoTaskState, persisted.autoTaskState);

  return true;
}

export function savePersistedState(state: FmsStateRefs, filePath?: string) {
  const resolvedFilePath = filePath ?? defaultStateFilePath;
  if (!persistenceEnabled(filePath)) {
    return false;
  }

  mkdirSync(dirname(resolvedFilePath), { recursive: true });
  const tempFilePath = `${resolvedFilePath}.tmp`;
  writeFileSync(tempFilePath, `${JSON.stringify(toPersistedState(state), null, 2)}\n`, "utf8");
  renameSync(tempFilePath, resolvedFilePath);
  return true;
}

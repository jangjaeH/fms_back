export type RobotState = "IDLE" | "MOVING" | "WAITING_PATH" | "ERROR";
export type MissionState = "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED";
export type AlarmSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type AlarmStatus = "OPEN" | "ACKED" | "RESOLVED";
export type EquipmentState = "READY" | "BUSY" | "FAULT" | "OFFLINE";
export type TaskType = "MOVE" | "PICK" | "DROP" | "GO_CHARGE";
export type TaskStatus = "QUEUED" | "ASSIGNED" | "RUNNING" | "COMPLETED" | "CANCELED";
export type OverrideAction = "PAUSE" | "RESUME" | "CANCEL" | "REASSIGN";

export interface Coordinate {
  x: number;
  y: number;
}

export interface DashboardSummary {
  activeRobots: number;
  pendingTasks: number;
  activeMissions: number;
  activeAlarms: number;
}

export interface Robot {
  id: string;
  name: string;
  state: RobotState;
  battery: number;
  currentCell: string;
  targetCell: string | null;
  reservedCells: string[];
  missionId: string | null;
  x: number;
  y: number;
  heading: number;
  radius: number;
  route: Coordinate[];
  routeIndex: number;
}

export interface Task {
  id: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  source: string;
  target: string;
  memo?: string;
  createdAt: string;
}

export interface Mission {
  id: string;
  robotId: string;
  taskId: string;
  state: MissionState;
  currentStep: string;
  progress: number;
  needsManualOverride: boolean;
}

export interface Alarm {
  id: string;
  severity: AlarmSeverity;
  title: string;
  source: string;
  status: AlarmStatus;
  missionId?: string;
  robotId?: string;
  createdAt: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
}

export interface EventItem {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface Equipment {
  id: string;
  type: "PICK" | "DROP" | "CHARGER";
  state: EquipmentState;
  signal: string;
  lastUpdated: string;
}

export interface MapSnapshot {
  width: number;
  height: number;
  stations: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; type: string }>;
  zones: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; type: string }>;
  obstacles: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; type: string }>;
  lanes: Array<{ id: string; label: string; width: number; points: Coordinate[] }>;
  blockedCells: string[];
}

export interface CreateTaskInput {
  type: TaskType;
  priority: number;
  source: string;
  target?: string;
  memo?: string;
}

export interface OverrideInput {
  operator: string;
  action: OverrideAction;
  reason: string;
  targetRobotId?: string;
}

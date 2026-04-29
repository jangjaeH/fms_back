export type RobotState = "IDLE" | "MOVING" | "WAITING_PATH" | "ERROR";
export type MissionState = "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED";
export type AlarmSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type AlarmStatus = "OPEN" | "ACKED" | "RESOLVED";
export type EquipmentState = "READY" | "BUSY" | "FAULT" | "OFFLINE";

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
}

export interface Task {
  id: string;
  type: "MOVE" | "PICK" | "DROP" | "GO_CHARGE";
  priority: number;
  status: "QUEUED" | "ASSIGNED" | "RUNNING" | "COMPLETED" | "CANCELED";
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
  stations: Array<{ id: string; label: string; x: number; y: number; type: string }>;
  blockedCells: string[];
}

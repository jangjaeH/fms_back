import type {
  Alarm,
  DashboardSummary,
  Equipment,
  EventItem,
  MapSnapshot,
  Mission,
  Robot,
  Task
} from "../types.js";

export const robots: Robot[] = [
  {
    id: "R-01",
    name: "Atlas-01",
    state: "MOVING",
    battery: 82,
    currentCell: "C3",
    targetCell: "DROP-02",
    reservedCells: ["AISLE-A3", "XFER-02", "DROP-02"],
    missionId: "M-1001",
    x: 280,
    y: 330,
    heading: 90,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 280, y: 330 },
      { x: 520, y: 330 },
      { x: 690, y: 520 },
      { x: 760, y: 720 }
    ]
  },
  {
    id: "R-02",
    name: "Atlas-02",
    state: "WAITING_PATH",
    battery: 64,
    currentCell: "F4",
    targetCell: "ST-08",
    reservedCells: ["WAIT-01", "AISLE-C2", "ST-08"],
    missionId: "M-1002",
    x: 620,
    y: 420,
    heading: 180,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 620, y: 420 },
      { x: 620, y: 620 },
      { x: 430, y: 620 }
    ]
  },
  {
    id: "R-03",
    name: "Atlas-03",
    state: "IDLE",
    battery: 91,
    currentCell: "A2",
    targetCell: null,
    reservedCells: [],
    missionId: null,
    x: 160,
    y: 780,
    heading: 0,
    radius: 18,
    routeIndex: 0,
    route: [{ x: 160, y: 780 }]
  }
];

export const tasks: Task[] = [
  {
    id: "T-1001",
    type: "PICK",
    priority: 5,
    status: "ASSIGNED",
    source: "PICK-01",
    target: "DROP-02",
    createdAt: "2026-04-29T08:10:00.000Z"
  },
  {
    id: "T-1002",
    type: "MOVE",
    priority: 4,
    status: "RUNNING",
    source: "ST-01",
    target: "ST-08",
    createdAt: "2026-04-29T08:12:00.000Z"
  },
  {
    id: "T-1003",
    type: "GO_CHARGE",
    priority: 3,
    status: "QUEUED",
    source: "R-02",
    target: "CH-01",
    createdAt: "2026-04-29T08:20:00.000Z"
  }
];

export const missions: Mission[] = [
  {
    id: "M-1001",
    robotId: "R-01",
    taskId: "T-1001",
    state: "RUNNING",
    currentStep: "MOVE_TO_DROP",
    progress: 72,
    needsManualOverride: false
  },
  {
    id: "M-1002",
    robotId: "R-02",
    taskId: "T-1002",
    state: "PAUSED",
    currentStep: "WAIT_FOR_PATH",
    progress: 45,
    needsManualOverride: true
  }
];

export const alarms: Alarm[] = [
  {
    id: "A-1001",
    severity: "CRITICAL",
    title: "Robot wait timeout",
    source: "traffic-controller",
    status: "OPEN",
    robotId: "R-02",
    missionId: "M-1002",
    createdAt: "2026-04-29T08:25:00.000Z"
  },
  {
    id: "A-1002",
    severity: "MINOR",
    title: "WS reconnect occurred",
    source: "gateway",
    status: "ACKED",
    createdAt: "2026-04-29T08:18:00.000Z",
    acknowledgedBy: "operator.demo"
  },
  {
    id: "A-1003",
    severity: "MAJOR",
    title: "Charger station fault",
    source: "EQ-03",
    status: "OPEN",
    createdAt: "2026-04-29T08:23:00.000Z"
  }
];

export const events: EventItem[] = [
  {
    id: "E-1001",
    type: "robot.position",
    source: "R-01",
    timestamp: "2026-04-29T08:26:00.000Z",
    payload: { x: 3, y: 3, cell: "C3" }
  },
  {
    id: "E-1002",
    type: "alarm.raised",
    source: "A-1001",
    timestamp: "2026-04-29T08:25:00.000Z",
    payload: { severity: "CRITICAL", robotId: "R-02" }
  },
  {
    id: "E-1003",
    type: "equipment.signal.received",
    source: "EQ-03",
    timestamp: "2026-04-29T08:23:00.000Z",
    payload: { state: "FAULT", signal: "EMERGENCY_STOP" }
  }
];

export const equipment: Equipment[] = [
  {
    id: "EQ-01",
    type: "PICK",
    state: "READY",
    signal: "AUTO_READY",
    lastUpdated: "2026-04-29T08:20:00.000Z"
  },
  {
    id: "EQ-02",
    type: "DROP",
    state: "BUSY",
    signal: "TRANSFER_ACTIVE",
    lastUpdated: "2026-04-29T08:22:00.000Z"
  },
  {
    id: "EQ-03",
    type: "CHARGER",
    state: "FAULT",
    signal: "EMERGENCY_STOP",
    lastUpdated: "2026-04-29T08:23:00.000Z"
  }
];

export const mapSnapshot: MapSnapshot = {
  width: 1000,
  height: 1000,
  stations: [
    { id: "PICK-01", label: "Inbound Pick 01", x: 105, y: 210, width: 150, height: 105, type: "PICK" },
    { id: "PICK-02", label: "Inbound Pick 02", x: 105, y: 355, width: 150, height: 105, type: "PICK" },
    { id: "DROP-02", label: "Outbound Drop 02", x: 720, y: 660, width: 170, height: 120, type: "DROP" },
    { id: "CH-01", label: "Charging Bay", x: 85, y: 720, width: 145, height: 120, type: "CHARGER" },
    { id: "ST-08", label: "Buffer Station 08", x: 360, y: 565, width: 145, height: 110, type: "BUFFER" }
  ],
  zones: [
    { id: "ZONE-IN", label: "Inbound Area", x: 60, y: 155, width: 230, height: 360, type: "WORK" },
    { id: "ZONE-ASRS", label: "Storage Racks", x: 365, y: 120, width: 260, height: 285, type: "STORAGE" },
    { id: "ZONE-OUT", label: "Outbound Area", x: 685, y: 565, width: 255, height: 270, type: "WORK" },
    { id: "ZONE-CHARGE", label: "Charging / Maintenance", x: 55, y: 675, width: 235, height: 210, type: "SERVICE" }
  ],
  obstacles: [
    { id: "RACK-A", label: "Rack A", x: 380, y: 145, width: 55, height: 240, type: "RACK" },
    { id: "RACK-B", label: "Rack B", x: 470, y: 145, width: 55, height: 240, type: "RACK" },
    { id: "RACK-C", label: "Rack C", x: 560, y: 145, width: 55, height: 240, type: "RACK" },
    { id: "SAFETY-01", label: "Human Safety Fence", x: 695, y: 120, width: 170, height: 280, type: "FENCE" },
    { id: "COLUMN-01", label: "Column", x: 330, y: 510, width: 52, height: 52, type: "COLUMN" },
    { id: "COLUMN-02", label: "Column", x: 650, y: 455, width: 52, height: 52, type: "COLUMN" }
  ],
  lanes: [
    {
      id: "LANE-MAIN",
      label: "Main AGV Aisle",
      width: 58,
      points: [
        { x: 120, y: 600 },
        { x: 310, y: 600 },
        { x: 520, y: 600 },
        { x: 780, y: 600 }
      ]
    },
    {
      id: "LANE-INBOUND",
      label: "Inbound Aisle",
      width: 52,
      points: [
        { x: 280, y: 250 },
        { x: 280, y: 330 },
        { x: 280, y: 460 },
        { x: 280, y: 600 }
      ]
    },
    {
      id: "LANE-STORAGE",
      label: "Rack Transfer Aisle",
      width: 50,
      points: [
        { x: 520, y: 330 },
        { x: 520, y: 455 },
        { x: 620, y: 455 },
        { x: 620, y: 620 }
      ]
    },
    {
      id: "LANE-OUTBOUND",
      label: "Outbound Aisle",
      width: 54,
      points: [
        { x: 690, y: 520 },
        { x: 760, y: 600 },
        { x: 760, y: 720 }
      ]
    },
    {
      id: "LANE-CHARGE",
      label: "Charge Aisle",
      width: 52,
      points: [
        { x: 160, y: 780 },
        { x: 160, y: 600 },
        { x: 280, y: 600 }
      ]
    }
  ],
  blockedCells: ["RACK-A", "RACK-B", "RACK-C", "SAFETY-01", "COLUMN-01", "COLUMN-02"]
};

export const getDashboardSummary = (): DashboardSummary => ({
  activeRobots: robots.filter((robot) => robot.state !== "ERROR").length,
  pendingTasks: tasks.filter((task) => ["QUEUED", "ASSIGNED", "RUNNING"].includes(task.status)).length,
  activeMissions: missions.filter((mission) => ["QUEUED", "RUNNING", "PAUSED"].includes(mission.state)).length,
  activeAlarms: alarms.filter((alarm) => alarm.status !== "RESOLVED").length
});

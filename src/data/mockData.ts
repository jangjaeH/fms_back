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

const lineCount = 10;
const lineNumbers = Array.from({ length: lineCount }, (_, index) => String(index + 1).padStart(2, "0"));
const lineStartY = 120;
const lineGapY = 82;
const facilityWidth = 1800;
const facilityHeight = 1100;

function lineY(index: number) {
  return lineStartY + index * lineGapY;
}

function lineStations(prefix: string, label: string, type: string, x: number, width: number, height: number) {
  return lineNumbers.map((line, index) => ({
    id: `${prefix}-${line}`,
    label: `${label} ${line}`,
    x,
    y: lineY(index),
    width,
    height,
    type
  }));
}

const supplyStations = lineStations("SPLY", "Supply", "SUPPLY", 80, 140, 58);
const primaryStations = lineStations("PRI", "Primary", "PRIMARY", 415, 150, 68);
const inverterStations = lineStations("INV", "Turnover", "INVERTER", 755, 140, 68);
const secondaryStations = lineStations("SEC", "Secondary", "SECONDARY", 1095, 150, 68);
const dropStations = lineStations("DRP", "Drop", "DROP", 1450, 150, 58);

export const robots: Robot[] = [
  {
    id: "R-01",
    name: "Atlas-01",
    state: "MOVING",
    battery: 82,
    currentCell: "LINE-01",
    targetCell: "PRI-01",
    reservedCells: ["SPLY-01", "PRI-01"],
    missionId: "M-1001",
    x: 245,
    y: 300,
    heading: 90,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 245, y: 149 },
      { x: 245, y: 930 },
      { x: 390, y: 930 },
      { x: 390, y: 154 }
    ]
  },
  {
    id: "R-02",
    name: "Atlas-02",
    state: "WAITING_PATH",
    battery: 64,
    currentCell: "LINE-05",
    targetCell: "SEC-05",
    reservedCells: ["INV-05", "SEC-05"],
    missionId: "M-1002",
    x: 920,
    y: 482,
    heading: 90,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 920, y: 482 },
      { x: 920, y: 930 },
      { x: 1070, y: 930 },
      { x: 1070, y: 482 }
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
    x: 145,
    y: 930,
    heading: 0,
    radius: 18,
    routeIndex: 0,
    route: [{ x: 145, y: 930 }]
  }
];

export const tasks: Task[] = [
  {
    id: "T-1001",
    type: "PICK",
    priority: 5,
    status: "ASSIGNED",
    source: "SPLY-01",
    target: "PRI-01",
    missionId: "M-1001",
    createdAt: "2026-04-29T08:10:00.000Z"
  },
  {
    id: "T-1002",
    type: "MOVE",
    priority: 4,
    status: "RUNNING",
    source: "INV-05",
    target: "SEC-05",
    missionId: "M-1002",
    createdAt: "2026-04-29T08:12:00.000Z"
  },
  {
    id: "T-1003",
    type: "GO_CHARGE",
    priority: 3,
    status: "COMPLETED",
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
  },
  {
    id: "EQ-04",
    type: "CHARGER",
    state: "READY",
    signal: "AUTO_READY",
    lastUpdated: "2026-04-29T08:24:00.000Z"
  }
];

export const mapSnapshot: MapSnapshot = {
  width: facilityWidth,
  height: facilityHeight,
  stations: [
    ...supplyStations,
    ...primaryStations,
    ...inverterStations,
    ...secondaryStations,
    ...dropStations,
    { id: "CH-01", label: "Charging Bay 1", x: 80, y: 960, width: 130, height: 80, type: "CHARGER" },
    { id: "CH-02", label: "Charging Bay 2", x: 240, y: 960, width: 130, height: 80, type: "CHARGER" }
  ],
  zones: [
    { id: "ZONE-SUPPLY", label: "Supply Decks x10", x: 50, y: 80, width: 200, height: 835, type: "DOCK" },
    { id: "ZONE-PRIMARY", label: "Primary Equipment x10", x: 380, y: 80, width: 220, height: 835, type: "PRODUCTION" },
    { id: "ZONE-INVERTER", label: "Turnover Units x10", x: 720, y: 80, width: 210, height: 835, type: "QC" },
    { id: "ZONE-SECONDARY", label: "Secondary Equipment x10", x: 1060, y: 80, width: 220, height: 835, type: "PRODUCTION" },
    { id: "ZONE-DROP", label: "Drop Ports x10", x: 1415, y: 80, width: 220, height: 835, type: "DOCK" },
    { id: "ZONE-SERVICE", label: "Charging / Maintenance", x: 50, y: 935, width: 360, height: 125, type: "SERVICE" },
    { id: "ZONE-CONTROL", label: "Control Room", x: 1460, y: 935, width: 270, height: 125, type: "OFFICE" }
  ],
  obstacles: [
    { id: "FLOW-01", label: "Supply to Primary Conveyor", x: 270, y: 105, width: 70, height: 810, type: "CONVEYOR" },
    { id: "FLOW-02", label: "Primary to Turnover Conveyor", x: 620, y: 105, width: 70, height: 810, type: "CONVEYOR" },
    { id: "FLOW-03", label: "Turnover to Secondary Conveyor", x: 960, y: 105, width: 70, height: 810, type: "CONVEYOR" },
    { id: "FLOW-04", label: "Secondary to Drop Conveyor", x: 1300, y: 105, width: 70, height: 810, type: "CONVEYOR" },
    { id: "FENCE-LINE", label: "Safety Fence", x: 45, y: 70, width: 1600, height: 855, type: "FENCE" },
    { id: "WALL-CTRL-N", label: "Wall", x: 1460, y: 930, width: 270, height: 16, type: "WALL" },
    { id: "WALL-CTRL-W", label: "Wall", x: 1460, y: 930, width: 16, height: 130, type: "WALL" },
    { id: "MAINT-BENCH", label: "Maintenance Bench", x: 410, y: 970, width: 190, height: 42, type: "MACHINE" },
    { id: "COLUMN-01", label: "Column", x: 335, y: 942, width: 38, height: 38, type: "COLUMN" },
    { id: "COLUMN-02", label: "Column", x: 690, y: 942, width: 38, height: 38, type: "COLUMN" },
    { id: "COLUMN-03", label: "Column", x: 1030, y: 942, width: 38, height: 38, type: "COLUMN" },
    { id: "COLUMN-04", label: "Column", x: 1370, y: 942, width: 38, height: 38, type: "COLUMN" }
  ],
  lanes: [
    {
      id: "LANE-SPINE",
      label: "Main AGV Return Spine",
      width: 68,
      points: [
        { x: 145, y: 930 },
        { x: 390, y: 930 },
        { x: 590, y: 930 },
        { x: 730, y: 930 },
        { x: 920, y: 930 },
        { x: 1070, y: 930 },
        { x: 1270, y: 930 },
        { x: 1425, y: 930 }
      ]
    },
    {
      id: "LANE-SUPPLY",
      label: "Supply Vertical Aisle",
      width: 54,
      points: [
        { x: 245, y: 149 },
        { x: 245, y: 887 },
        { x: 245, y: 930 }
      ]
    },
    {
      id: "LANE-PRIMARY-L",
      label: "Primary Infeed Aisle",
      width: 54,
      points: [
        { x: 390, y: 154 },
        { x: 390, y: 892 },
        { x: 390, y: 930 }
      ]
    },
    {
      id: "LANE-PRIMARY-R",
      label: "Primary Outfeed Aisle",
      width: 54,
      points: [
        { x: 590, y: 154 },
        { x: 590, y: 892 },
        { x: 590, y: 930 }
      ]
    },
    {
      id: "LANE-INVERTER-L",
      label: "Turnover Infeed Aisle",
      width: 54,
      points: [
        { x: 730, y: 154 },
        { x: 730, y: 892 },
        { x: 730, y: 930 }
      ]
    },
    {
      id: "LANE-INVERTER-R",
      label: "Turnover Outfeed Aisle",
      width: 54,
      points: [
        { x: 920, y: 154 },
        { x: 920, y: 892 },
        { x: 920, y: 930 }
      ]
    },
    {
      id: "LANE-SECONDARY-L",
      label: "Secondary Infeed Aisle",
      width: 54,
      points: [
        { x: 1070, y: 154 },
        { x: 1070, y: 892 },
        { x: 1070, y: 930 }
      ]
    },
    {
      id: "LANE-SECONDARY-R",
      label: "Secondary Outfeed Aisle",
      width: 54,
      points: [
        { x: 1270, y: 154 },
        { x: 1270, y: 892 },
        { x: 1270, y: 930 }
      ]
    },
    {
      id: "LANE-DROP",
      label: "Drop Vertical Aisle",
      width: 54,
      points: [
        { x: 1425, y: 149 },
        { x: 1425, y: 887 },
        { x: 1425, y: 930 }
      ]
    }
  ],
  blockedCells: [
    "FENCE-LINE",
    "WALL-CTRL-N",
    "WALL-CTRL-W",
    "COLUMN-01",
    "COLUMN-02",
    "COLUMN-03",
    "COLUMN-04"
  ]
};

export const getDashboardSummary = (): DashboardSummary => ({
  activeRobots: robots.filter((robot) => robot.state !== "ERROR").length,
  pendingTasks: tasks.filter((task) => ["QUEUED", "ASSIGNED", "RUNNING"].includes(task.status)).length,
  activeMissions: missions.filter((mission) => ["QUEUED", "RUNNING", "PAUSED"].includes(mission.state)).length,
  activeAlarms: alarms.filter((alarm) => alarm.status !== "RESOLVED").length
});

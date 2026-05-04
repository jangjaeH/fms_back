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
    currentCell: "MAIN-AISLE",
    targetCell: "DROP-02",
    reservedCells: ["MAIN-AISLE", "QC-01", "DROP-02"],
    missionId: "M-1001",
    x: 430,
    y: 610,
    heading: 0,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 430, y: 610 },
      { x: 640, y: 610 },
      { x: 780, y: 640 },
      { x: 805, y: 855 }
    ]
  },
  {
    id: "R-02",
    name: "Atlas-02",
    state: "WAITING_PATH",
    battery: 64,
    currentCell: "PROD-AISLE",
    targetCell: "ST-08",
    reservedCells: ["PROD-AISLE", "ST-08"],
    missionId: "M-1002",
    x: 640,
    y: 330,
    heading: 270,
    radius: 18,
    routeIndex: 1,
    route: [
      { x: 640, y: 330 },
      { x: 600, y: 330 },
      { x: 600, y: 475 },
      { x: 405, y: 475 }
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
    x: 170,
    y: 775,
    heading: 0,
    radius: 18,
    routeIndex: 0,
    route: [{ x: 170, y: 775 }]
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
    missionId: "M-1001",
    createdAt: "2026-04-29T08:10:00.000Z"
  },
  {
    id: "T-1002",
    type: "MOVE",
    priority: 4,
    status: "RUNNING",
    source: "ST-01",
    target: "ST-08",
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
  width: 1000,
  height: 1000,
  stations: [
    { id: "PICK-01", label: "Receiving Dock 1", x: 88, y: 120, width: 150, height: 72, type: "DOCK" },
    { id: "PICK-02", label: "Receiving Dock 2", x: 88, y: 220, width: 150, height: 72, type: "DOCK" },
    { id: "ST-08", label: "Rack Buffer 08", x: 345, y: 430, width: 126, height: 88, type: "BUFFER" },
    { id: "ASM-01", label: "Assembly Cell A", x: 725, y: 145, width: 150, height: 105, type: "ASSEMBLY" },
    { id: "ASM-02", label: "Assembly Cell B", x: 725, y: 315, width: 150, height: 105, type: "ASSEMBLY" },
    { id: "QC-01", label: "QC / Packing", x: 700, y: 595, width: 170, height: 88, type: "QC" },
    { id: "DROP-02", label: "Shipping Dock 2", x: 720, y: 815, width: 170, height: 80, type: "DOCK" },
    { id: "CH-01", label: "Charging Bay 1", x: 105, y: 720, width: 130, height: 90, type: "CHARGER" },
    { id: "CH-02", label: "Charging Bay 2", x: 105, y: 595, width: 130, height: 82, type: "CHARGER" }
  ],
  zones: [
    { id: "ZONE-RECV", label: "Receiving Dock", x: 60, y: 75, width: 220, height: 255, type: "DOCK" },
    { id: "ZONE-RACK", label: "High-Bay Rack Storage", x: 320, y: 75, width: 315, height: 465, type: "STORAGE" },
    { id: "ZONE-PROD", label: "Assembly / Process Cells", x: 680, y: 80, width: 250, height: 445, type: "PRODUCTION" },
    { id: "ZONE-QC", label: "QC / Packing", x: 660, y: 560, width: 270, height: 155, type: "QC" },
    { id: "ZONE-SHIP", label: "Shipping Dock", x: 660, y: 775, width: 270, height: 155, type: "DOCK" },
    { id: "ZONE-SERVICE", label: "Charging / Maintenance", x: 65, y: 585, width: 225, height: 315, type: "SERVICE" },
    { id: "ZONE-OFFICE", label: "Control Room", x: 70, y: 410, width: 205, height: 145, type: "OFFICE" }
  ],
  obstacles: [
    { id: "DOOR-IN-01", label: "Roll-up Door", x: 34, y: 122, width: 24, height: 70, type: "DOCK_DOOR" },
    { id: "DOOR-IN-02", label: "Roll-up Door", x: 34, y: 222, width: 24, height: 70, type: "DOCK_DOOR" },
    { id: "DOOR-OUT-02", label: "Trailer Door", x: 782, y: 932, width: 120, height: 24, type: "DOCK_DOOR" },
    { id: "RACK-A1", label: "Rack A1", x: 335, y: 110, width: 42, height: 300, type: "RACK" },
    { id: "RACK-A2", label: "Rack A2", x: 405, y: 110, width: 42, height: 300, type: "RACK" },
    { id: "RACK-A3", label: "Rack A3", x: 475, y: 110, width: 42, height: 300, type: "RACK" },
    { id: "RACK-A4", label: "Rack A4", x: 545, y: 110, width: 42, height: 300, type: "RACK" },
    { id: "CONV-01", label: "Infeed Conveyor", x: 655, y: 140, width: 38, height: 300, type: "CONVEYOR" },
    { id: "CONV-02", label: "Pack Conveyor", x: 675, y: 585, width: 235, height: 36, type: "CONVEYOR" },
    { id: "FENCE-PROD", label: "Safety Fence", x: 670, y: 70, width: 270, height: 470, type: "FENCE" },
    { id: "WALL-CTRL-N", label: "Wall", x: 70, y: 405, width: 205, height: 16, type: "WALL" },
    { id: "WALL-CTRL-E", label: "Wall", x: 259, y: 405, width: 16, height: 150, type: "WALL" },
    { id: "COLUMN-01", label: "Column", x: 298, y: 592, width: 42, height: 42, type: "COLUMN" },
    { id: "COLUMN-02", label: "Column", x: 565, y: 592, width: 42, height: 42, type: "COLUMN" },
    { id: "COLUMN-03", label: "Column", x: 920, y: 542, width: 42, height: 42, type: "COLUMN" },
    { id: "MAINT-BENCH", label: "Maintenance Bench", x: 92, y: 830, width: 150, height: 42, type: "MACHINE" }
  ],
  lanes: [
    {
      id: "LANE-SPINE",
      label: "Main AGV Spine",
      width: 72,
      points: [
        { x: 220, y: 610 },
        { x: 430, y: 610 },
        { x: 640, y: 610 },
        { x: 805, y: 610 }
      ]
    },
    {
      id: "LANE-RECV",
      label: "Receiving Cross Aisle",
      width: 62,
      points: [
        { x: 220, y: 155 },
        { x: 220, y: 255 },
        { x: 220, y: 420 },
        { x: 220, y: 610 }
      ]
    },
    {
      id: "LANE-RACK",
      label: "Rack Transfer Aisle",
      width: 56,
      points: [
        { x: 405, y: 475 },
        { x: 405, y: 610 },
        { x: 640, y: 610 }
      ]
    },
    {
      id: "LANE-PROD",
      label: "Production Feed Aisle",
      width: 58,
      points: [
        { x: 640, y: 185 },
        { x: 640, y: 330 },
        { x: 640, y: 610 }
      ]
    },
    {
      id: "LANE-SHIP",
      label: "Shipping Aisle",
      width: 62,
      points: [
        { x: 805, y: 610 },
        { x: 805, y: 710 },
        { x: 805, y: 855 }
      ]
    },
    {
      id: "LANE-SERVICE",
      label: "Service Aisle",
      width: 52,
      points: [
        { x: 170, y: 775 },
        { x: 170, y: 610 },
        { x: 220, y: 610 }
      ]
    }
  ],
  blockedCells: [
    "RACK-A1",
    "RACK-A2",
    "RACK-A3",
    "RACK-A4",
    "FENCE-PROD",
    "WALL-CTRL-N",
    "WALL-CTRL-E",
    "COLUMN-01",
    "COLUMN-02",
    "COLUMN-03"
  ]
};

export const getDashboardSummary = (): DashboardSummary => ({
  activeRobots: robots.filter((robot) => robot.state !== "ERROR").length,
  pendingTasks: tasks.filter((task) => ["QUEUED", "ASSIGNED", "RUNNING"].includes(task.status)).length,
  activeMissions: missions.filter((mission) => ["QUEUED", "RUNNING", "PAUSED"].includes(mission.state)).length,
  activeAlarms: alarms.filter((alarm) => alarm.status !== "RESOLVED").length
});

import type { Express } from "express";

import { store } from "../lib/store.js";

export const registerRoutes = (app: Express) => {
  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "robot-monitoring-backend" });
  });

  app.get("/dashboard/summary", (_request, response) => {
    response.json(store.getDashboardSummary());
  });

  app.get("/map", (_request, response) => {
    response.json(store.getMap());
  });

  app.get("/robots", (_request, response) => {
    response.json(store.getRobots());
  });

  app.get("/robots/:id", (request, response) => {
    const robot = store.getRobot(request.params.id);
    if (!robot) {
      response.status(404).json({ message: "Robot not found" });
      return;
    }
    response.json(robot);
  });

  app.get("/robots/:id/events", (request, response) => {
    response.json(store.getRobotEvents(request.params.id));
  });

  app.get("/simulation/auto-tasks", (_request, response) => {
    response.json(store.getAutoTaskStatus());
  });

  app.patch("/simulation/auto-tasks", (request, response) => {
    response.json(
      store.updateAutoTaskStatus({
        enabled: typeof request.body?.enabled === "boolean" ? request.body.enabled : undefined,
        intervalMs: typeof request.body?.intervalMs === "number" ? request.body.intervalMs : undefined
      })
    );
  });

  app.post("/simulation/auto-tasks/run", (_request, response) => {
    response.status(201).json(store.runAutoTaskScheduler({ force: true }));
  });

  app.get("/tasks", (_request, response) => {
    response.json(store.getTasks());
  });

  app.post("/tasks", (request, response) => {
    const { type, priority, source, target, memo } = request.body;
    if (!type || priority === undefined || !source) {
      response.status(400).json({ message: "type, priority, and source are required" });
      return;
    }
    const task = store.createTask({ type, priority, source, target, memo });
    if ("error" in task) {
      response.status(task.status ?? 400).json({ message: task.error });
      return;
    }
    response.status(201).json(task.data);
  });

  app.patch("/tasks/:id", (request, response) => {
    const task = store.updateTask(request.params.id, request.body);
    if (!task) {
      response.status(404).json({ message: "Task not found" });
      return;
    }
    response.json(task);
  });

  app.delete("/tasks/:id", (request, response) => {
    const task = store.cancelTask(request.params.id);
    if ("error" in task) {
      response.status(task.status ?? 400).json({ message: task.error });
      return;
    }
    response.json(task.data);
  });

  app.get("/missions", (_request, response) => {
    response.json(store.getMissions());
  });

  app.get("/missions/active", (_request, response) => {
    response.json(store.getActiveMissions());
  });

  app.post("/missions", (request, response) => {
    const { type, priority, source, target, memo } = request.body;
    if (!type || priority === undefined || !source) {
      response.status(400).json({ message: "type, priority, and source are required" });
      return;
    }
    const task = store.createTask({ type, priority, source, target, memo });
    if ("error" in task) {
      response.status(task.status ?? 400).json({ message: task.error });
      return;
    }
    const mission = store.getMissions().find((item) => item.id === task.data.missionId) ?? null;
    response.status(201).json({ task: task.data, mission });
  });

  app.patch("/missions/:id", (request, response) => {
    const mission = store.updateMission(request.params.id, request.body);
    if (!mission) {
      response.status(404).json({ message: "Mission not found" });
      return;
    }
    response.json(mission);
  });

  app.post("/missions/:id/override", (request, response) => {
    const { operator = "operator.demo", action = "RESUME", reason = "", targetRobotId } = request.body;
    const mission = store.applyOverride(request.params.id, { operator, action, reason, targetRobotId });
    if ("error" in mission) {
      response.status(mission.status ?? 400).json({ message: mission.error });
      return;
    }
    response.json(mission.data);
  });

  app.get("/equipment", (_request, response) => {
    response.json(store.getEquipment());
  });

  app.post("/equipment/:id/reset", (request, response) => {
    const target = store.resetEquipment(request.params.id);
    if (!target) {
      response.status(404).json({ message: "Equipment not found" });
      return;
    }
    response.json(target);
  });

  app.get("/alarms", (_request, response) => {
    response.json(store.getAlarms());
  });

  app.patch("/alarms/:id/ack", (request, response) => {
    const alarm = store.ackAlarm(request.params.id, request.body?.user ?? "operator.demo");
    if ("error" in alarm) {
      response.status(alarm.status ?? 400).json({ message: alarm.error });
      return;
    }
    response.json(alarm.data);
  });

  app.patch("/alarms/:id/resolve", (request, response) => {
    const alarm = store.resolveAlarm(request.params.id, request.body?.user ?? "operator.demo");
    if ("error" in alarm) {
      response.status(alarm.status ?? 400).json({ message: alarm.error });
      return;
    }
    response.json(alarm.data);
  });

  app.get("/events", (request, response) => {
    response.json(
      store.getEvents({
        type: typeof request.query.type === "string" ? request.query.type : undefined,
        source: typeof request.query.source === "string" ? request.query.source : undefined,
        q: typeof request.query.q === "string" ? request.query.q : undefined
      })
    );
  });

  app.get("/events/export", (request, response) => {
    response.setHeader("Content-Type", "text/csv");
    response.send(
      store.exportEventsCsv({
        type: typeof request.query.type === "string" ? request.query.type : undefined,
        source: typeof request.query.source === "string" ? request.query.source : undefined,
        q: typeof request.query.q === "string" ? request.query.q : undefined
      })
    );
  });
};

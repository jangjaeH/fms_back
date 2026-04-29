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

  app.get("/tasks", (_request, response) => {
    response.json(store.getTasks());
  });

  app.post("/tasks", (request, response) => {
    const { type, priority, source, target, memo } = request.body;
    if (!type || !priority || !source || !target) {
      response.status(400).json({ message: "type, priority, source, target are required" });
      return;
    }
    const task = store.createTask({ type, priority, source, target, memo });
    response.status(201).json(task);
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
    if (!task) {
      response.status(404).json({ message: "Task not found" });
      return;
    }
    response.json(task);
  });

  app.get("/missions", (_request, response) => {
    response.json(store.getMissions());
  });

  app.get("/missions/active", (_request, response) => {
    response.json(store.getActiveMissions());
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
    const { operator = "operator.demo", action = "RESUME", reason = "manual override" } = request.body;
    const mission = store.applyOverride(request.params.id, operator, action, reason);
    if (!mission) {
      response.status(404).json({ message: "Mission not found" });
      return;
    }
    response.json(mission);
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
    if (!alarm) {
      response.status(404).json({ message: "Alarm not found" });
      return;
    }
    response.json(alarm);
  });

  app.patch("/alarms/:id/resolve", (request, response) => {
    const alarm = store.resolveAlarm(request.params.id, request.body?.user ?? "operator.demo");
    if (!alarm) {
      response.status(404).json({ message: "Alarm not found" });
      return;
    }
    response.json(alarm);
  });

  app.get("/events", (_request, response) => {
    response.json(store.getEvents());
  });

  app.get("/events/export", (_request, response) => {
    response.setHeader("Content-Type", "text/csv");
    response.send(store.exportEventsCsv());
  });
};

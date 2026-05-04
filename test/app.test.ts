import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("robot monitoring backend", () => {
  const app = createApp();

  it("returns dashboard summary", async () => {
    const response = await request(app).get("/dashboard/summary");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      activeRobots: expect.any(Number),
      pendingTasks: expect.any(Number),
      activeMissions: expect.any(Number),
      activeAlarms: expect.any(Number)
    });
  });

  it("creates a task and dispatches it into a mission", async () => {
    const response = await request(app).post("/tasks").send({
      type: "MOVE",
      priority: 2,
      source: "ST-02",
      target: "ST-05"
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("ASSIGNED");
    expect(response.body.id).toContain("T-");
    expect(response.body.missionId).toContain("M-");

    const missionsResponse = await request(app).get("/missions");
    expect(missionsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: response.body.missionId,
          taskId: response.body.id,
          state: "RUNNING"
        })
      ])
    );
  });

  it("creates a mission directly from the mission endpoint", async () => {
    const response = await request(app).post("/missions").send({
      type: "GO_CHARGE",
      priority: 3,
      source: "R-03"
    });

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      type: "GO_CHARGE",
      target: "CH-01"
    });
    if (response.body.mission) {
      expect(response.body.mission).toMatchObject({
        taskId: response.body.task.id,
        state: "RUNNING"
      });
    }
  });

  it("reports and updates the auto task generator", async () => {
    const status = await request(app).get("/simulation/auto-tasks");

    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      enabled: expect.any(Boolean),
      intervalMs: expect.any(Number),
      generatedCount: expect.any(Number)
    });

    const updated = await request(app).patch("/simulation/auto-tasks").send({
      enabled: false,
      intervalMs: 5000
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      enabled: false,
      intervalMs: 5000
    });
  });

  it("rejects an invalid task request", async () => {
    const response = await request(app).post("/tasks").send({
      type: "MOVE",
      priority: 6,
      source: "ST-02",
      target: "ST-02"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Priority");
  });

  it("acknowledges an open alarm", async () => {
    const response = await request(app).patch("/alarms/A-1001/ack").send({
      user: "operator.demo"
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ACKED");
    expect(response.body.acknowledgedBy).toBe("operator.demo");
  });

  it("filters events by type", async () => {
    const response = await request(app).get("/events").query({ type: "alarm.raised" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "alarm.raised"
        })
      ])
    );
    expect(response.body.every((event: { type: string }) => event.type === "alarm.raised")).toBe(true);
  });

  it("resets faulted equipment and appends an event", async () => {
    const response = await request(app).post("/equipment/EQ-03/reset").send({});

    expect(response.status).toBe(200);
    expect(response.body.state).toBe("READY");

    const eventsResponse = await request(app).get("/events").query({ type: "equipment.state.changed", source: "EQ-03" });
    expect(eventsResponse.body[0]).toMatchObject({
      type: "equipment.state.changed",
      source: "EQ-03"
    });
  });
});

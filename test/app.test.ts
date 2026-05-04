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

  it("creates a task", async () => {
    const response = await request(app).post("/tasks").send({
      type: "MOVE",
      priority: 2,
      source: "ST-02",
      target: "ST-05"
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("QUEUED");
    expect(response.body.id).toContain("T-");
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

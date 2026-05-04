import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

interface RouteRobot {
  id: string;
  state: string;
  missionId: string | null;
  route: Array<{ x: number; y: number }>;
}

const routeOverlapClearance = 24;

function routeSegments(route: RouteRobot["route"]) {
  const segments: Array<[RouteRobot["route"][number], RouteRobot["route"][number]]> = [];
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    if (from.x !== to.x || from.y !== to.y) {
      segments.push([from, to]);
    }
  }
  return segments;
}

function cross(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x * right.y - left.y * right.x;
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x * right.x + left.y * right.y;
}

function pointToLineDistance(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const line = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(line.x, line.y);
  if (!length) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  return Math.abs(cross({ x: point.x - start.x, y: point.y - start.y }, line)) / length;
}

function segmentsOverlap(
  activeStart: { x: number; y: number },
  activeEnd: { x: number; y: number },
  candidateStart: { x: number; y: number },
  candidateEnd: { x: number; y: number }
) {
  const activeVector = { x: activeEnd.x - activeStart.x, y: activeEnd.y - activeStart.y };
  const candidateVector = { x: candidateEnd.x - candidateStart.x, y: candidateEnd.y - candidateStart.y };
  const activeLength = Math.hypot(activeVector.x, activeVector.y);
  const candidateLength = Math.hypot(candidateVector.x, candidateVector.y);
  if (!activeLength || !candidateLength) {
    return false;
  }

  const parallelScale = Math.abs(cross(activeVector, candidateVector)) / (activeLength * candidateLength);
  if (parallelScale > 0.08) {
    return false;
  }

  const distanceToCandidateLine = Math.min(
    pointToLineDistance(candidateStart, activeStart, activeEnd),
    pointToLineDistance(candidateEnd, activeStart, activeEnd)
  );
  if (distanceToCandidateLine > routeOverlapClearance) {
    return false;
  }

  const activeUnit = { x: activeVector.x / activeLength, y: activeVector.y / activeLength };
  const candidateStartProjection = dot({ x: candidateStart.x - activeStart.x, y: candidateStart.y - activeStart.y }, activeUnit);
  const candidateEndProjection = dot({ x: candidateEnd.x - activeStart.x, y: candidateEnd.y - activeStart.y }, activeUnit);
  const candidateMin = Math.min(candidateStartProjection, candidateEndProjection);
  const candidateMax = Math.max(candidateStartProjection, candidateEndProjection);
  const overlap = Math.min(activeLength, candidateMax) - Math.max(0, candidateMin);
  return overlap > routeOverlapClearance;
}

function routesOverlap(leftRoute: RouteRobot["route"], rightRoute: RouteRobot["route"]) {
  for (const [leftStart, leftEnd] of routeSegments(leftRoute)) {
    for (const [rightStart, rightEnd] of routeSegments(rightRoute)) {
      if (segmentsOverlap(leftStart, leftEnd, rightStart, rightEnd)) {
        return true;
      }
    }
  }
  return false;
}

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

  it("keeps seeded active robot routes from sharing corridor segments", async () => {
    const response = await request(app).get("/robots");
    const activeRobots = (response.body as RouteRobot[]).filter((robot) => robot.missionId && robot.state !== "ERROR");

    for (let leftIndex = 0; leftIndex < activeRobots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < activeRobots.length; rightIndex += 1) {
        expect(routesOverlap(activeRobots[leftIndex].route, activeRobots[rightIndex].route)).toBe(false);
      }
    }
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

    const robotsResponse = await request(app).get("/robots");
    const dispatchedRobot = (robotsResponse.body as RouteRobot[]).find((robot) => robot.missionId === response.body.missionId);
    const otherActiveRobots = (robotsResponse.body as RouteRobot[]).filter(
      (robot) => robot.id !== dispatchedRobot?.id && robot.missionId && robot.state !== "ERROR"
    );
    expect(dispatchedRobot).toBeDefined();
    for (const robot of otherActiveRobots) {
      expect(routesOverlap(dispatchedRobot?.route ?? [], robot.route)).toBe(false);
    }
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

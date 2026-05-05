import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadPersistedState, savePersistedState, type FmsStateRefs } from "../src/lib/persistence.js";

function stateFixture(): FmsStateRefs {
  return {
    robots: [],
    tasks: [],
    missions: [],
    alarms: [],
    events: [],
    equipment: [],
    mapSnapshot: {
      width: 100,
      height: 100,
      stations: [],
      zones: [],
      obstacles: [],
      lanes: [],
      blockedCells: []
    },
    autoTaskState: {
      enabled: true,
      intervalMs: 7000,
      cursor: 0,
      generatedCount: 0,
      lastGeneratedAt: null,
      lastTaskId: null,
      lastMissionId: null,
      lastAttemptAt: 0
    }
  };
}

describe("FMS persistence", () => {
  it("saves and restores runtime state", () => {
    const directory = mkdtempSync(join(tmpdir(), "fms-state-"));
    const stateFile = join(directory, "state.json");

    try {
      const source = stateFixture();
      source.robots.push({
        id: "R-PERSIST",
        name: "Persisted Robot",
        state: "IDLE",
        battery: 77,
        currentCell: "A1",
        targetCell: null,
        reservedCells: [],
        missionId: null,
        x: 10,
        y: 20,
        heading: 0,
        radius: 18,
        route: [{ x: 10, y: 20 }],
        routeIndex: 0
      });
      source.autoTaskState.generatedCount = 3;

      expect(savePersistedState(source, stateFile)).toBe(true);

      const target = stateFixture();
      expect(loadPersistedState(target, stateFile)).toBe(true);

      expect(target.robots).toHaveLength(1);
      expect(target.robots[0]).toMatchObject({ id: "R-PERSIST", battery: 77 });
      expect(target.autoTaskState.generatedCount).toBe(3);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

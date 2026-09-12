import { describe, expect, it } from "vitest";
import {
  isAppReady,
  isDeployRunning,
  isStaleActiveDeploy,
  STALE_ACTIVE_MS,
} from "./stale";

function status(state: string, ageMs = 0) {
  return {
    state,
    updatedAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

describe("isStaleActiveDeploy", () => {
  it("treats old building status as stale", () => {
    expect(isStaleActiveDeploy(status("building", STALE_ACTIVE_MS + 1000))).toBe(
      true
    );
  });

  it("keeps fresh building status active", () => {
    expect(isStaleActiveDeploy(status("building", 1000))).toBe(false);
  });
});

describe("isDeployRunning", () => {
  it("is false for stale running status", () => {
    expect(isDeployRunning(status("running", STALE_ACTIVE_MS + 5000))).toBe(
      false
    );
  });
});

describe("isAppReady", () => {
  it("is true when app and database are healthy with no active deploy", () => {
    expect(
      isAppReady({
        status: "ok",
        database: "connected",
        deployStatus: status("ready", 60000),
      })
    ).toBe(true);
  });

  it("is false while deploy is actively building", () => {
    expect(
      isAppReady({
        status: "ok",
        database: "connected",
        deployStatus: status("building", 1000),
      })
    ).toBe(false);
  });

  it("is true when stale building status remains on disk", () => {
    expect(
      isAppReady({
        status: "ok",
        database: "connected",
        deployStatus: status("building", STALE_ACTIVE_MS + 1000),
      })
    ).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requestSync = vi.fn();
const context = vi.fn();
vi.mock("../../src/server/garmin/session", () => ({
  getGarminRequestContext: () => context(),
  getGarminClient: () => ({ requestSync }),
}));

import {
  manualSyncAvailableAt,
  requestedSyncProgress,
  type GarminJobState,
  type GarminSyncStatus,
} from "../../src/features/garmin/sync";
import {
  requestedSyncLabel,
  requestedSyncShare,
} from "../../src/features/data-activity/model";
import { requestGarminSync } from "../../src/server/garmin/actions";

const category = {
  state: "complete" as const,
  oldestSynchronizedDate: "2024-01-01",
  lastSuccessAt: "2026-10-16T06:00:00Z",
  lastErrorCode: null,
  activityCount: 10,
};

function status(
  phases: Partial<Record<"activities" | "recovery", GarminJobState>>,
  manualSyncAvailableAt: string | null = null,
): GarminSyncStatus {
  return {
    started: true,
    categories: {
      activities: category,
      recovery: category,
      fitness: category,
      patterns: category,
    },
    lastSyncAt: null,
    updatedAt: null,
    manualSyncAvailableAt,
    phases: Object.fromEntries(
      Object.entries(phases).map(([phase, state]) => [
        phase,
        { state, updatedAt: "2026-10-16T08:00:00Z" },
      ]),
    ),
  };
}

describe("requested Garmin sync progress", () => {
  const queued = status({ activities: "queued", recovery: "queued" });

  it("counts activities then sleep until both settle", () => {
    expect(requestedSyncProgress(queued, queued)).toEqual({
      done: 0,
      total: 2,
      current: "activities",
      settled: false,
    });
    const halfway = requestedSyncProgress(
      queued,
      status({ activities: "succeeded", recovery: "running" }),
    );
    expect(halfway).toEqual({
      done: 1,
      total: 2,
      current: "recovery",
      settled: false,
    });
    expect(requestedSyncLabel(halfway)).toBe("Garmin · 1 sur 2 · sommeil");
    expect(requestedSyncShare(halfway)).toBe(0.5);
  });

  it("settles when a job fails so the athlete is never stuck", () => {
    expect(
      requestedSyncProgress(
        queued,
        status({ activities: "failed", recovery: "succeeded" }),
      ).settled,
    ).toBe(true);
  });

  it("only follows the jobs that were open when the sync was requested", () => {
    const running = status({ activities: "running", recovery: "succeeded" });
    const progress = requestedSyncProgress(running, running);
    expect(progress).toMatchObject({ total: 1, current: "activities" });
    expect(requestedSyncLabel(progress)).toBe("Garmin · 0 sur 1 · activités");
    expect(requestedSyncShare(progress)).toBe(0.1);
    expect(requestedSyncProgress(status({}), status({})).settled).toBe(true);
  });
});

describe("manual sync availability", () => {
  const now = Date.parse("2026-10-16T08:00:00Z");

  it("reports a future limit and ignores past or missing ones", () => {
    expect(manualSyncAvailableAt(status({}, "2026-10-16T08:05:00Z"), now)).toBe(
      Date.parse("2026-10-16T08:05:00Z"),
    );
    expect(
      manualSyncAvailableAt(status({}, "2026-10-16T07:55:00Z"), now),
    ).toBeNull();
    expect(manualSyncAvailableAt(status({}), now)).toBeNull();
    expect(manualSyncAvailableAt(null, now)).toBeNull();
  });
});

describe("requestGarminSync", () => {
  it("asks for a session before calling Garmin", async () => {
    context.mockResolvedValueOnce(null);
    await expect(requestGarminSync()).resolves.toEqual({
      status: "session-expired",
    });
    expect(requestSync).not.toHaveBeenCalled();
  });

  it("returns the queued status", async () => {
    const sync = status({ activities: "queued", recovery: "queued" });
    context.mockResolvedValueOnce({ accessToken: "token" });
    requestSync.mockResolvedValueOnce({
      ok: true,
      value: { ...sync, request: "queued" },
    });
    const result = await requestGarminSync();
    expect(result.status).toBe("requested");
    expect(requestSync).toHaveBeenCalledWith({ accessToken: "token" });
  });

  it.each([
    [{ code: "sync_throttled", retryAfterSeconds: 120 }, "throttled"],
    [{ code: "reconnect_required" }, "reconnect"],
    [{ code: "disconnected" }, "reconnect"],
    [{ code: "unauthorized" }, "session-expired"],
    [{ code: "provider_unavailable" }, "unavailable"],
    [{ code: "timeout" }, "unavailable"],
    [{ code: "malformed" }, "unavailable"],
  ])("maps %o to %s", async (failure, expected) => {
    context.mockResolvedValueOnce({ accessToken: "token" });
    requestSync.mockResolvedValueOnce({ ok: false, failure });
    const before = Date.now();
    const result = await requestGarminSync();
    expect(result.status).toBe(expected);
    if (result.status === "throttled")
      expect(Date.parse(result.availableAt)).toBeGreaterThanOrEqual(
        before + 120_000,
      );
  });

  it("treats a thrown client error as Garmin being unavailable", async () => {
    context.mockResolvedValueOnce({ accessToken: "token" });
    requestSync.mockRejectedValueOnce(new Error("boom"));
    await expect(requestGarminSync()).resolves.toEqual({
      status: "unavailable",
    });
  });
});

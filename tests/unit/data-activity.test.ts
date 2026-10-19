import { describe, expect, it } from "vitest";
import {
  activityState,
  activityStatusLabel,
  activityTone,
  garminConnectionTone,
  dataActivitySchema,
  freshCategories,
  threadDelay,
  type DataActivityObservation,
} from "@/features/data-activity/model";

const category = {
  state: "complete" as const,
  oldestSynchronizedDate: null,
  lastSuccessAt: "2026-10-13T10:00:00Z",
  lastErrorCode: null,
  activityCount: null,
};
function observation(): DataActivityObservation {
  return {
    connection: "connected",
    sync: {
      started: true,
      categories: {
        activities: { ...category, activityCount: 4 },
        recovery: { ...category },
        fitness: { ...category },
        patterns: { ...category },
      },
      lastSyncAt: category.lastSuccessAt,
      updatedAt: category.lastSuccessAt,
    },
  };
}
describe("data activity", () => {
  it("delays the thread and keeps it visible for at least 600ms", () => {
    expect(threadDelay(true, 0, 1_000)).toBe(300);
    expect(threadDelay(true, 1_300, 1_400)).toBe(0);
    expect(threadDelay(false, 1_300, 1_400)).toBe(500);
    expect(threadDelay(false, 1_300, 2_000)).toBe(0);
  });
  it("rejects malformed timestamps and missing categories", () => {
    expect(
      dataActivitySchema.safeParse({ connection: "connected", sync: {} })
        .success,
    ).toBe(false);
    const invalid = observation();
    invalid.sync.categories.recovery.lastSuccessAt = "yesterday";
    expect(dataActivitySchema.safeParse(invalid).success).toBe(false);
  });
  it("uses actual unsettled categories even with another failed category", () => {
    const current = observation();
    current.sync.categories.activities.state = "failed";
    expect(activityState(current, false, false)).toBe("attention");
    current.sync.categories.recovery.state = "partial";
    expect(activityState(current, false, false)).toBe("syncing");
  });
  it("stops synchronization for offline, outage and reconnect", () => {
    const current = observation();
    current.sync.categories.activities.state = "running";
    expect(activityState(current, true, false)).toBe("offline");
    expect(activityState(current, false, true)).toBe("unavailable");
    current.connection = "expired";
    expect(activityState(current, false, true)).toBe("reconnect");
  });
  it("ignores initial observations, poll timestamps and declining counts", () => {
    const before = observation();
    const after = observation();
    after.sync.updatedAt = "2026-10-13T11:00:00Z";
    after.sync.categories.activities.activityCount = 3;
    expect(freshCategories(null, after)).toEqual([]);
    expect(freshCategories(before, after)).toEqual([]);
  });
  it("offers only categories with fresh successes or increasing activity counts", () => {
    const before = observation();
    const after = observation();
    after.sync.categories.activities.activityCount = 5;
    after.sync.categories.recovery.lastSuccessAt = "2026-10-13T11:00:00Z";
    expect(freshCategories(before, after)).toEqual(["activities", "recovery"]);
    expect(freshCategories(after, after)).toEqual([]);
  });
  it("compares success instants across timezone offsets", () => {
    const before = observation();
    const after = observation();
    after.sync.categories.recovery.lastSuccessAt = "2026-10-13T12:00:00+02:00";
    expect(freshCategories(before, after)).toEqual([]);
    after.sync.categories.recovery.lastSuccessAt = "2026-10-13T09:30:00-01:00";
    expect(freshCategories(before, after)).toEqual(["recovery"]);
    after.sync.categories.recovery.lastSuccessAt = "2026-10-13T11:30:00+02:00";
    expect(freshCategories(before, after)).toEqual([]);
  });
  it("words the Garmin status line like the data activity board", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const base = { observation: observation(), progress: null, now };
    expect(activityStatusLabel({ ...base, state: "complete" })).toBe(
      "Garmin synchronisé 12:00",
    );
    expect(
      activityStatusLabel({ ...base, state: "complete", short: true }),
    ).toBe("Garmin 12:00");
    expect(activityStatusLabel({ ...base, state: "syncing" })).toBe(
      "Garmin · synchro…",
    );
    expect(activityStatusLabel({ ...base, state: "offline" })).toBe(
      "Hors ligne · données de 12:00",
    );
    expect(
      activityStatusLabel({
        ...base,
        state: "offline",
        now: new Date("2026-10-15T12:00:00Z"),
      }),
    ).toBe("Hors ligne · données du 13/10/2026");
    expect(activityStatusLabel({ ...base, state: "reconnect" })).toBe(
      "Garmin déconnecté · Reconnecter",
    );
    expect(
      activityStatusLabel({
        ...base,
        state: "unavailable",
        observation: { ...observation(), connection: "rate_limited" },
      }),
    ).toBe("Garmin en retard");
    expect(
      activityStatusLabel({ ...base, observation: null, state: "unavailable" }),
    ).toBe("Statut Garmin indisponible");
    expect(
      activityStatusLabel({
        ...base,
        state: "syncing",
        progress: { done: 2, total: 4, current: "recovery", settled: false },
      }),
    ).toBe("Garmin · 2 sur 4 · sommeil");
  });
  it("gives the Garmin status one tone per state", () => {
    expect(activityTone("complete")).toBe("success");
    expect(activityTone("syncing")).toBe("provider");
    expect(activityTone("reconnect")).toBe("danger");
    expect(activityTone("offline")).toBe("warning");
    expect(garminConnectionTone("connected")).toBe("success");
    expect(garminConnectionTone("expired")).toBe("danger");
    expect(garminConnectionTone("rate_limited")).toBe("warning");
    expect(garminConnectionTone(null)).toBe("warning");
  });
});

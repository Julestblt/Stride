import { describe, expect, it } from "vitest";
import type {
  GarminSyncCategoryStatus,
  GarminSyncState,
} from "../../src/features/garmin/sync";
import type { SyncObservation } from "../../src/features/onboarding/sync-polling";
import {
  buildTimeline,
  categoryView,
  importNotice,
  isImportRunning,
} from "../../src/features/onboarding/import-history";

const today = new Date("2026-10-10T12:00:00Z");
function category(
  state: GarminSyncState,
  extra: Partial<GarminSyncCategoryStatus> = {},
): GarminSyncCategoryStatus {
  return {
    state,
    oldestSynchronizedDate: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    activityCount: null,
    ...extra,
  };
}
function sync(
  activities: GarminSyncCategoryStatus,
  rest: GarminSyncState = "running",
  started = true,
  firstActivityDate: string | null = null,
): SyncObservation {
  return {
    started,
    categories: {
      activities,
      recovery: category(rest),
      fitness: category(rest),
      patterns: category(rest),
    },
    lastSyncAt: null,
    updatedAt: null,
    firstActivityDate,
  };
}

describe("import timeline", () => {
  it("shows only the current year before any activity is found", () => {
    expect(buildTimeline(null, today)).toEqual({
      years: [{ year: 2026, fill: 0 }],
      reading: null,
      earlier: false,
    });
    const scanning = buildTimeline(
      sync(category("running", { oldestSynchronizedDate: "2003-02-01" })),
      today,
    );
    expect(scanning.years).toEqual([{ year: 2026, fill: 0 }]);
    expect(scanning.reading).toBe("février 2003");
  });
  it("starts at the first real activity, not at the scanned floor", () => {
    const timeline = buildTimeline(
      sync(
        category("complete", { oldestSynchronizedDate: "2000-01-01" }),
        "complete",
        true,
        "2025-03-14",
      ),
      today,
    );
    expect(timeline.years.map(({ year }) => year)).toEqual([2025, 2026]);
    expect(timeline.years[0]?.fill).toBeCloseTo(293 / 365, 3);
    expect(timeline.years[1]?.fill).toBe(1);
    expect(timeline.reading).toBeNull();
    expect(timeline.earlier).toBe(false);
  });
  it("keeps reading the scan position while the import runs", () => {
    const timeline = buildTimeline(
      sync(
        category("running", { oldestSynchronizedDate: "2021-03-14" }),
        "running",
        true,
        "2022-06-01",
      ),
      today,
    );
    expect(timeline.years[0]?.year).toBe(2022);
    expect(timeline.reading).toBe("mars 2021");
  });
  it("caps very long histories at twelve years", () => {
    const timeline = buildTimeline(
      sync(category("complete"), "complete", true, "2001-05-01"),
      today,
    );
    expect(timeline.years).toHaveLength(12);
    expect(timeline.years[0]).toEqual({ year: 2015, fill: 1 });
    expect(timeline.earlier).toBe(true);
  });
});

describe("import category rows", () => {
  it("shows the verified activity count and reading date", () => {
    expect(
      categoryView(
        "activities",
        category("running", {
          oldestSynchronizedDate: "2021-03-14",
          activityCount: 1486,
        }),
      ),
    ).toEqual({
      value: "1 486",
      tone: "accent",
      detail: "Lecture · 14 mars 2021",
      bar: "active",
    });
    expect(
      categoryView(
        "activities",
        category("complete", {
          oldestSynchronizedDate: "2000-01-01",
          activityCount: 444,
        }),
        "2019-01-02",
      ),
    ).toMatchObject({
      value: "444",
      tone: "success",
      detail: "Première activité le 2 janvier 2019",
      bar: "full",
    });
    expect(
      categoryView(
        "activities",
        category("complete", {
          oldestSynchronizedDate: "2000-01-01",
          activityCount: 0,
        }),
      ).detail,
    ).toBe("Aucune activité trouvée");
  });
  it.each([
    ["pending", "En attente", "muted", "empty"],
    ["running", "En cours", "accent", "active"],
    ["partial", "En cours", "accent", "active"],
    ["complete", "Terminé", "success", "full"],
    ["failed", "Incomplet", "warning", "attention"],
  ] as const)(
    "maps %s to its label, tone and bar",
    (state, value, tone, bar) => {
      expect(categoryView("recovery", category(state))).toMatchObject({
        value,
        tone,
        bar,
      });
    },
  );
  it("describes recovery, fitness and patterns from real dates only", () => {
    expect(
      categoryView(
        "recovery",
        category("complete", { oldestSynchronizedDate: "2026-07-01" }),
      ).detail,
    ).toBe("Lu depuis juillet 2026");
    expect(categoryView("fitness", category("running")).detail).toBe(
      "En attente de Garmin",
    );
    expect(categoryView("fitness", category("failed")).detail).toBe(
      "Garmin n’a pas renvoyé ces données",
    );
    expect(categoryView("patterns", category("pending")).detail).toBe(
      "Après les premières activités",
    );
    expect(categoryView("patterns", category("partial")).detail).toBe(
      "D’après les activités déjà lues",
    );
  });
  it("never renders percentages, totals or time estimates", () => {
    const states: GarminSyncState[] = [
      "pending",
      "running",
      "partial",
      "complete",
      "failed",
    ];
    for (const state of states)
      for (const name of [
        "activities",
        "recovery",
        "fitness",
        "patterns",
      ] as const) {
        const view = categoryView(
          name,
          category(state, {
            oldestSynchronizedDate: "2021-03-14",
            activityCount: 1486,
          }),
        );
        expect(`${view.value} ${view.detail}`).not.toMatch(
          /%|~|\/|minute|heure/,
        );
      }
  });
});

describe("import notices", () => {
  it("prioritizes reconnect, then outages, then failed categories", () => {
    const failed = sync(category("failed"));
    expect(importNotice(failed, { reconnect: true, unavailable: true })).toBe(
      "paused",
    );
    expect(importNotice(failed, { reconnect: false, unavailable: true })).toBe(
      "slow",
    );
    expect(importNotice(failed, { reconnect: false, unavailable: false })).toBe(
      "partial",
    );
    expect(
      importNotice(sync(category("running")), {
        reconnect: false,
        unavailable: false,
      }),
    ).toBeNull();
  });
  it("treats not started and active imports as running", () => {
    expect(isImportRunning(null)).toBe(true);
    expect(isImportRunning(sync(category("pending"), "pending", false))).toBe(
      true,
    );
    expect(isImportRunning(sync(category("running")))).toBe(true);
    expect(isImportRunning(sync(category("complete"), "complete"))).toBe(false);
  });
});

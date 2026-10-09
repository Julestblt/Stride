import { describe, expect, it } from "vitest";
import type {
  GarminSyncCategoryStatus,
  GarminSyncState,
  GarminSyncStatus,
} from "../../src/features/garmin/sync";
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
): GarminSyncStatus {
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
  };
}

describe("import timeline", () => {
  it("shows nine unread years before anything is synchronized", () => {
    const timeline = buildTimeline(null, today);
    expect(timeline.years.map(({ year }) => year)).toEqual([
      2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(timeline.years.every(({ fill }) => fill === 0)).toBe(true);
    expect(timeline.reading).toBeNull();
  });
  it("fills from today back to the oldest synchronized date", () => {
    const timeline = buildTimeline(
      sync(category("running", { oldestSynchronizedDate: "2021-03-14" })),
      today,
    );
    const fills = Object.fromEntries(
      timeline.years.map(({ year, fill }) => [year, fill]),
    );
    expect(fills[2020]).toBe(0);
    expect(fills[2021]).toBeCloseTo(293 / 365, 3);
    expect(fills[2022]).toBe(1);
    expect(fills[2026]).toBe(1);
    expect(timeline.reading).toBe("mars 2021");
  });
  it("extends past nine years for long histories and trims empty years once complete", () => {
    const running = buildTimeline(
      sync(category("running", { oldestSynchronizedDate: "2012-06-01" })),
      today,
    );
    expect(running.years[0]?.year).toBe(2012);
    const complete = buildTimeline(
      sync(category("complete", { oldestSynchronizedDate: "2020-01-01" })),
      today,
    );
    expect(complete.years[0]).toEqual({ year: 2020, fill: 1 });
    expect(complete.reading).toBeNull();
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
          oldestSynchronizedDate: "2019-01-02",
          activityCount: 444,
        }),
      ),
    ).toMatchObject({
      value: "444",
      tone: "success",
      detail: "Historique lu depuis le 2 janvier 2019",
      bar: "full",
    });
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
    ).toBe("Depuis juillet 2026");
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

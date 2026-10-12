import { describe, expect, it } from "vitest";
import {
  healthDays,
  healthModel,
  loadZone,
  parseHealthView,
} from "@/features/progress/health";
import {
  formatStage,
  healthPageView,
  stressLabel,
} from "@/features/progress/health-view";
import { addDays } from "@/features/progress/period";

const today = "2026-10-12";

function observations(
  count: number,
  values: (age: number) => Record<string, number | null>,
) {
  return Array.from({ length: count }, (_, index) => {
    const age = count - 1 - index;
    const day = addDays(today, -age);
    return Object.entries({
      sleep_duration_seconds: 26_400,
      sleep_deep_seconds: 4800,
      sleep_light_seconds: 15_000,
      sleep_rem_seconds: 5400,
      sleep_awake_seconds: 600,
      sleep_score: 82,
      hrv_last_night_ms: 58 + (index % 3) - 1,
      resting_heart_rate_bpm: 45 + (index % 2),
      average_stress: 28,
      training_load_acute: 450,
      training_load_chronic: 400,
      vo2_max: 55,
      ...values(age),
    }).map(([metric, value]) => ({ metric, day, value }));
  }).flat();
}

describe("health view", () => {
  it("defaults to the week", () => {
    expect(parseHealthView("month")).toBe("month");
    expect(parseHealthView("day")).toBe("day");
    expect(parseHealthView("year")).toBe("week");
    expect(parseHealthView(undefined)).toBe("week");
  });

  it("classifies training load ratios", () => {
    expect(loadZone(0.79)).toBe("low");
    expect(loadZone(0.8)).toBe("productive");
    expect(loadZone(1.5)).toBe("productive");
    expect(loadZone(1.51)).toBe("high");
  });

  it("labels Garmin stress levels", () => {
    expect(stressLabel(25)).toBe("Journée calme");
    expect(stressLabel(40)).toBe("Stress faible");
    expect(stressLabel(60)).toBe("Stress modéré");
    expect(stressLabel(80)).toBe("Stress élevé");
  });

  it("formats sleep stages", () => {
    expect(formatStage(3480)).toBe("58 min");
    expect(formatStage(12_360)).toBe("3h26");
  });
});

describe("health model", () => {
  it("reads a short night that keeps its restorative share", () => {
    const model = healthModel({
      days: healthDays(
        observations(40, (age) =>
          age === 0
            ? {
                sleep_duration_seconds: 21_120,
                sleep_deep_seconds: 3480,
                sleep_light_seconds: 12_360,
                sleep_rem_seconds: 5280,
                sleep_awake_seconds: 840,
              }
            : {},
        ),
      ),
      view: "week",
      today,
    });
    expect(model.sleep).toMatchObject({
      last: 21_120,
      average: 26_400,
      shortest: true,
      trend: "watch",
    });
    expect(model.sleep?.nights).toHaveLength(14);
    expect(model.sleep?.restorativeShare).toBeCloseTo(8760 / 21_120);
    expect(model.load).toMatchObject({ zone: "productive", vo2: 55 });
    expect(model.load?.ratio).toBeCloseTo(1.125);
    const view = healthPageView(model, null);
    expect(view.headline).toBe(
      "Tu récupères bien de la charge, mais ton sommeil ne suit plus.",
    );
    expect(view.sleep?.note).toContain("C’est la durée qui manque");
    expect(view.kpis.map((kpi) => kpi.key)).toEqual([
      "sleep",
      "hrv",
      "resting",
      "battery",
      "stress",
      "load",
    ]);
    expect(view.kpis.find((kpi) => kpi.key === "battery")).toMatchObject({
      value: "—",
      detail: "Non transmis par Garmin",
    });
  });

  it("uses thirty nights for the month", () => {
    const model = healthModel({
      days: healthDays(observations(40, () => ({}))),
      view: "month",
      today,
    });
    expect(model.readingDays).toBe(30);
    expect(model.sleep?.nights).toHaveLength(30);
    expect(model.hrv?.points).toHaveLength(30);
  });

  it("reads Body Battery recharge against the usual night", () => {
    const model = healthModel({
      days: healthDays(
        observations(30, (age) => ({
          body_battery_wake: age === 0 ? 61 : 80,
          body_battery_charged: age === 0 ? 38 : 55,
          body_battery_drained: -51,
        })),
      ),
      view: "week",
      today,
    });
    expect(model.energy).toMatchObject({
      wake: 61,
      charged: 38,
      usualCharged: 55,
      drained: -51,
    });
    expect(healthPageView(model, null).energy?.status).toBe(
      "Recharge partielle",
    );
  });

  it("states missing data honestly", () => {
    const model = healthModel({ days: [], view: "week", today });
    const view = healthPageView(model, null);
    expect(view.headline).toBe(
      "Pas encore assez de données Garmin pour lire ta santé.",
    );
    expect(view.sleep).toBeNull();
    expect(view.takeaways).toEqual([]);
  });
});

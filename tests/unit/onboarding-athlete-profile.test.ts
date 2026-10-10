import { describe, expect, it } from "vitest";
import {
  buildAthleteProfile,
  formatHours,
  historySpan,
  recentWeeks,
  type AthleteProfileInputs,
} from "../../src/features/onboarding/athlete-profile";
import { emptyProfile } from "../../src/features/onboarding/profile";

const today = new Date("2026-10-10T12:00:00Z");
function inputs(
  overrides: Partial<AthleteProfileInputs> = {},
): AthleteProfileInputs {
  return {
    today,
    profile: {
      ...emptyProfile,
      first_name: "Ada",
      available_weekdays: [2, 4, 6, 7],
      long_run_day: "sunday",
    },
    goal: { focus: "ultra_trail" },
    races: [
      {
        name: "EcoTrail Paris 120K",
        race_date: "2027-03-20",
        distance_km: 120,
        elevation_gain_m: 2000,
        priority: "A",
        target_duration_seconds: null,
      },
      {
        name: null,
        race_date: null,
        distance_km: null,
        elevation_gain_m: null,
        priority: "B",
        target_duration_seconds: null,
      },
    ],
    weeks: [
      { weekStart: "2026-10-05", activityCount: 5, durationSeconds: 6 * 3600 },
      { weekStart: "2026-09-28", activityCount: 3, durationSeconds: 3 * 3600 },
      { weekStart: "2026-01-05", activityCount: 9, durationSeconds: 9 * 3600 },
    ],
    activityCount: 444,
    firstActivityAt: "2025-06-13T07:00:00Z",
    activities: [
      {
        startedAt: "2026-09-13T06:00:00Z",
        localStartedAt: null,
        type: "trail_running",
        distanceMeters: 62_961,
        durationSeconds: 30_000,
        elevationGainMeters: 1057,
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        startedAt: `2026-08-${String(index + 1).padStart(2, "0")}T06:00:00Z`,
        localStartedAt: null,
        type: "running",
        distanceMeters: 10_000,
        durationSeconds: 3_600,
        elevationGainMeters: 50,
      })),
    ],
    observations: [
      ...Array.from({ length: 10 }, (_, index) => ({
        metric: "hrv_last_night_ms",
        observedOn: `2026-10-0${(index % 9) + 1}`,
        value: 70 + index,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        metric: "sleep_duration_seconds",
        observedOn: `2026-08-1${index}`,
        value: 27_000,
      })),
    ],
    vo2Max: { value: 55.6, observedOn: "2026-10-09" },
    maxHeartRate: { value: 199, startedAt: "2025-11-15T06:00:00Z" },
    ...overrides,
  };
}
const fact = (view: ReturnType<typeof buildAthleteProfile>, key: string) =>
  view.sections
    .flatMap((section) => section.facts)
    .find((item) => item.key === key);

describe("athlete profile", () => {
  it("fills sixteen Monday weeks and ignores older ones", () => {
    const weeks = recentWeeks(inputs().weeks, today);
    expect(weeks).toHaveLength(16);
    expect(weeks[15]).toEqual({
      weekStart: "2026-10-05",
      hours: 6,
      activities: 5,
    });
    expect(weeks[14]).toEqual({
      weekStart: "2026-09-28",
      hours: 3,
      activities: 3,
    });
    expect(weeks[0].weekStart).toBe("2026-06-22");
    expect(weeks.reduce((total, week) => total + week.hours, 0)).toBe(9);
  });
  it("derives each training value from stored weeks, activities and answers", () => {
    const view = buildAthleteProfile(inputs());
    expect(fact(view, "typical_week")).toMatchObject({
      value: "0h34 · 0,5 séances",
      source: "garmin",
      detail: "Moyenne · 16 dernières semaines",
    });
    expect(fact(view, "regularity")?.value).toBe("2 semaines sur 16");
    expect(fact(view, "terrain")).toMatchObject({
      value: "Trail · un tiers",
      detail: "Course à pied · 12 derniers mois",
    });
    expect(fact(view, "availability")).toMatchObject({
      value: "4 jours · sortie longue dim.",
      source: "athlete",
    });
  });
  it("shows fitness and recovery from observations with their window", () => {
    const view = buildAthleteProfile(inputs());
    expect(fact(view, "vo2_max")).toMatchObject({
      value: "56",
      detail: "Garmin · hier",
    });
    expect(fact(view, "longest_run")?.value).toBe("63 km · 13 sept.");
    expect(fact(view, "max_hr")).toMatchObject({
      value: "199 bpm",
      detail: "Le 15 novembre 2025 · 12 derniers mois",
    });
    expect(fact(view, "hrv")).toMatchObject({
      value: "71–79 ms",
      detail: "Nuit · base sur 28 jours",
    });
    expect(fact(view, "sleep")).toMatchObject({
      value: "7h30 en moyenne",
      detail: "8 nuits · 90 derniers jours",
    });
    expect(fact(view, "resting_hr")?.value).toBeNull();
  });
  it("lists the goal and only complete races with the time left", () => {
    const view = buildAthleteProfile(inputs());
    const goals = view.sections.find((section) => section.key === "goals")!;
    expect(
      goals.facts.map((item) => [item.label, item.value, item.detail]),
    ).toEqual([
      ["Objectif", "Ultra-trail", "Tes réponses"],
      [
        "EcoTrail Paris 120K · Course A",
        "161 jours",
        "20 mars 2027 · 120 km · 2 000 m D+",
      ],
    ]);
  });
  it("marks everything missing without data instead of inventing values", () => {
    const view = buildAthleteProfile(
      inputs({
        weeks: [],
        activities: [],
        observations: [],
        vo2Max: null,
        maxHeartRate: null,
        activityCount: 0,
        firstActivityAt: null,
      }),
    );
    for (const key of [
      "typical_week",
      "regularity",
      "terrain",
      "vo2_max",
      "longest_run",
      "max_hr",
      "hrv",
      "sleep",
    ])
      expect(fact(view, key)?.value).toBeNull();
    expect(view.history).toBeNull();
  });
  it("formats durations and history spans in French", () => {
    expect(formatHours(4.72)).toBe("4h43");
    expect(historySpan("2025-06-13T07:00:00Z", today)).toBe("15 mois");
    expect(historySpan("2018-01-01T00:00:00Z", today)).toBe("8 ans");
  });
});

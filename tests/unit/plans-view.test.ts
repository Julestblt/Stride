import { describe, expect, it } from "vitest";
import { easyRun, qualitySession } from "@/features/plans/library/library";
import type { PlanSession } from "@/features/plans/model/plan";
import { trainingTargets } from "@/features/plans/targets/targets";
import {
  formatDayLabel,
  formatDuration,
  formatTarget,
  formatWeekRange,
} from "@/features/plans/view/format";
import { sessionStats, stepViews } from "@/features/plans/view/plan-view";

const targets = trainingTargets({
  today: "2026-10-14",
  flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-10-01" },
  garminLactateThreshold: null,
  bestEfforts: [],
  vo2Max: null,
  garminZones: null,
  strideZones: {
    asOf: "2026-10-10",
    zones: [
      { zone: 1, lower: 95, upper: 113 },
      { zone: 2, lower: 114, upper: 132 },
      { zone: 3, lower: 133, upper: 151 },
      { zone: 4, lower: 152, upper: 170 },
      { zone: 5, lower: 171, upper: 190 },
    ],
  },
});
const road = { targets, terrain: "road" as const };
const placed = (content: ReturnType<typeof easyRun>, date = "2026-10-20") =>
  ({ ...content, sessionKey: "s", scheduledOn: date }) as PlanSession;

describe("format", () => {
  it("formats durations, ranges, days and targets in French", () => {
    expect(formatDuration(2_700)).toBe("45’");
    expect(formatDuration(5_340)).toBe("1h29");
    expect(formatDuration(7_200)).toBe("2h");
    expect(formatWeekRange("2026-10-19", "2026-10-25")).toBe("19–25 oct.");
    expect(formatWeekRange("2026-10-26", "2026-11-01")).toBe(
      "26 oct. – 1 nov.",
    );
    expect(formatDayLabel("2026-10-20")).toBe("mar. 20");
    expect(
      formatTarget({
        kind: "pace_range",
        fastSecondsPerKm: 265,
        slowSecondsPerKm: 278,
      }),
    ).toBe("4:25–4:38/km");
    expect(
      formatTarget({ kind: "heart_rate_range", minBpm: 152, maxBpm: 170 }),
    ).toBe("FC 152–170");
    expect(formatTarget({ kind: "rpe", min: 7, max: 7 })).toBe("Effort 7/10");
  });
});

describe("sessions", () => {
  it("lists steps with repeats and targets", () => {
    const steps = stepViews(placed(qualitySession(road, "threshold", 1)));
    expect(
      steps.map((step) => [step.name, step.duration, step.target]),
    ).toEqual([
      ["Échauffement", "15:00", "5:21–6:05/km"],
      ["4 × seuil", "4 × 6:00", "4:25–4:38/km"],
      ["Récupération × 4", "4 × 1:30", "6:05–6:37/km"],
      ["Retour au calme", "10:00", "5:21–6:05/km"],
    ]);
  });

  it("states totals, time at intensity and computed heart rate", () => {
    expect(
      sessionStats(placed(qualitySession(road, "threshold", 1)), targets),
    ).toEqual({
      total: "55’",
      distance: expect.stringMatching(/^≈ \d+,\d km$/),
      intensityTime: { seconds: 1_440, value: "24’", label: "au seuil" },
      pace: "4:25–4:38",
      heartRate: "152–170",
      elevation: null,
      terrain: "Route",
    });
  });
});

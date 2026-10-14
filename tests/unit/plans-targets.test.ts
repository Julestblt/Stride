import { describe, expect, it } from "vitest";
import { intensities } from "@/features/plans/model/structure";
import {
  confidenceForAge,
  thresholdPaceFromVo2,
  trainingTargets,
  type TargetsInput,
  type TrainingTargets,
} from "@/features/plans/targets/targets";

const today = "2026-10-14";

const strideZones = {
  asOf: "2026-10-10",
  zones: [
    { zone: 1, lower: 95, upper: 113 },
    { zone: 2, lower: 114, upper: 132 },
    { zone: 3, lower: 133, upper: 151 },
    { zone: 4, lower: 152, upper: 170 },
    { zone: 5, lower: 171, upper: 190 },
  ],
};

const input = (patch: Partial<TargetsInput> = {}): TargetsInput => ({
  today,
  flatLapThresholdPace: null,
  garminLactateThreshold: null,
  bestEfforts: [],
  vo2Max: null,
  garminZones: null,
  strideZones: null,
  ...patch,
});

const midpoint = (
  targets: TrainingTargets,
  intensity: (typeof intensities)[number],
) => {
  const range = targets.intensities[intensity].paceRange!;
  return (range.fastSecondsPerKm + range.slowSecondsPerKm) / 2;
};

const expectOrdered = (targets: TrainingTargets) => {
  for (let index = 1; index < intensities.length; index++) {
    const slower = targets.intensities[intensities[index - 1]].paceRange!;
    const faster = targets.intensities[intensities[index]].paceRange!;
    expect(faster.fastSecondsPerKm).toBeLessThan(slower.fastSecondsPerKm);
    expect(faster.slowSecondsPerKm).toBeLessThanOrEqual(
      slower.slowSecondsPerKm,
    );
    expect(midpoint(targets, intensities[index])).toBeLessThan(
      midpoint(targets, intensities[index - 1]),
    );
  }
  for (const intensity of intensities) {
    const range = targets.intensities[intensity].paceRange!;
    expect(range.fastSecondsPerKm).toBeLessThanOrEqual(range.slowSecondsPerKm);
  }
};

describe("trainingTargets", () => {
  it("derives paces from a recent flat-lap threshold pace", () => {
    const targets = trainingTargets(
      input({
        flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-10-01" },
        strideZones,
      }),
    );
    expect(targets.intensities.threshold.paceRange).toEqual({
      fastSecondsPerKm: 265,
      slowSecondsPerKm: 278,
    });
    expect(targets.intensities.threshold.paceSource).toEqual({
      kind: "flat_laps",
      asOf: "2026-10-01",
      confidence: "high",
    });
    expect(targets.intensities.threshold.heartRateRange).toEqual({
      minBpm: 152,
      maxBpm: 170,
    });
    expect(targets.intensities.repetition.heartRateRange).toBeNull();
    expect(targets.calibrationGaps).toEqual([]);
    expectOrdered(targets);
  });

  it("uses the most recent measured threshold between laps and Garmin", () => {
    const targets = trainingTargets(
      input({
        flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-09-01" },
        garminLactateThreshold: {
          speedMps: 4,
          heartRateBpm: null,
          asOf: "2026-10-05",
        },
      }),
    );
    expect(targets.intensities.threshold.paceSource?.kind).toBe(
      "garmin_lactate_threshold",
    );
    expect(targets.intensities.threshold.paceRange).toEqual({
      fastSecondsPerKm: 245,
      slowSecondsPerKm: 258,
    });
  });

  it("falls back to the best recent race effort", () => {
    const targets = trainingTargets(
      input({
        bestEfforts: [
          { meters: 10_000, seconds: 2_700, asOf: "2026-09-20" },
          { meters: 21_097, seconds: 6_600, asOf: "2026-08-30" },
          { meters: 1_000, seconds: 180, asOf: "2026-10-10" },
        ],
      }),
    );
    expect(targets.intensities.threshold.paceSource).toEqual({
      kind: "best_effort",
      asOf: "2026-09-20",
      confidence: "high",
    });
    const threshold = midpoint(targets, "threshold");
    expect(threshold).toBeGreaterThan(275);
    expect(threshold).toBeLessThan(290);
    expect(targets.calibrationGaps).toEqual(["no_heart_rate_source"]);
    expectOrdered(targets);
  });

  it("estimates from VO2 max with at most medium confidence", () => {
    const targets = trainingTargets(
      input({ vo2Max: { value: 50, asOf: "2026-10-12" } }),
    );
    expect(Math.round(thresholdPaceFromVo2(50))).toBe(255);
    expect(targets.intensities.easy.paceSource).toEqual({
      kind: "vo2max",
      asOf: "2026-10-12",
      confidence: "medium",
    });
    expectOrdered(targets);
  });

  it("uses effort targets only when no source is reliable", () => {
    const targets = trainingTargets(
      input({
        flatLapThresholdPace: { secondsPerKm: 270, asOf: "2025-01-01" },
        vo2Max: { value: 0, asOf: today },
      }),
    );
    for (const intensity of intensities) {
      expect(targets.intensities[intensity].paceRange).toBeNull();
      expect(targets.intensities[intensity].heartRateRange).toBeNull();
      expect(targets.intensities[intensity].rpe.min).toBeGreaterThan(0);
      expect(targets.intensities[intensity].talkTest).not.toBe("");
    }
    expect(targets.calibrationGaps).toEqual([
      "no_pace_source",
      "no_heart_rate_source",
    ]);
    expect(targets.trail.uphill.heartRateRange).toBeNull();
  });

  it("prefers a recent Garmin lactate-threshold heart rate over zones", () => {
    const targets = trainingTargets(
      input({
        garminLactateThreshold: {
          speedMps: null,
          heartRateBpm: 170,
          asOf: "2026-10-01",
        },
        strideZones,
      }),
    );
    expect(targets.intensities.threshold.heartRateRange).toEqual({
      minBpm: 162,
      maxBpm: 170,
    });
    expect(targets.intensities.threshold.heartRateSource?.kind).toBe(
      "garmin_lactate_threshold",
    );
    expect(targets.trail.uphill.heartRateRange).toEqual({
      minBpm: 138,
      maxBpm: 160,
    });
  });

  it("prefers Garmin zones over Stride zones and skips stale ones", () => {
    const garminZones = {
      asOf: "2026-10-01",
      zones: strideZones.zones.map((zone) => ({
        ...zone,
        lower: zone.lower + 2,
        upper: zone.upper + 2,
      })),
    };
    expect(
      trainingTargets(input({ garminZones, strideZones })).intensities.easy
        .heartRateSource?.kind,
    ).toBe("garmin_zones");
    expect(
      trainingTargets(
        input({
          garminZones: { ...garminZones, asOf: "2025-01-01" },
          strideZones,
        }),
      ).intensities.easy.heartRateSource?.kind,
    ).toBe("stride_zones");
  });

  it("lowers confidence as sources age and flags low confidence", () => {
    const targets = trainingTargets(
      input({
        flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-04-01" },
        strideZones: { ...strideZones, asOf: "2026-03-01" },
      }),
    );
    expect(targets.intensities.easy.paceSource?.confidence).toBe("low");
    expect(targets.calibrationGaps).toEqual([
      "low_confidence_pace",
      "low_confidence_heart_rate",
    ]);
  });
});

describe("confidenceForAge", () => {
  it("grades source age at its boundaries", () => {
    expect(confidenceForAge("2026-08-15", today)).toBe("high");
    expect(confidenceForAge("2026-08-14", today)).toBe("medium");
    expect(confidenceForAge("2026-06-16", today)).toBe("medium");
    expect(confidenceForAge("2026-06-15", today)).toBe("low");
    expect(confidenceForAge("2025-10-14", today)).toBe("low");
    expect(confidenceForAge("2025-10-13", today)).toBeNull();
    expect(confidenceForAge("2026-10-15", today)).toBeNull();
  });
});

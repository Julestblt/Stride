import {
  oxygenCost,
  sustainableFraction,
} from "@/features/progress/predictions";
import {
  intensities,
  type Intensity,
  type IntensityPaces,
} from "../model/structure";

export const targetsVersion = "2026-10-14";

export type TargetConfidence = "high" | "medium" | "low";

export const sourceAgeDays = { high: 60, medium: 120, ignored: 365 } as const;

const thresholdSpeedShare: Record<Intensity, [number, number]> = {
  recovery: [0.68, 0.74],
  easy: [0.74, 0.84],
  marathon: [0.88, 0.93],
  threshold: [0.97, 1.02],
  interval: [1.04, 1.08],
  repetition: [1.1, 1.15],
};

const lactateThresholdHeartRateShare: Record<
  Exclude<Intensity, "repetition">,
  [number, number]
> = {
  recovery: [0.7, 0.81],
  easy: [0.81, 0.89],
  marathon: [0.9, 0.94],
  threshold: [0.95, 1],
  interval: [1.01, 1.06],
};

const zoneByIntensity: Record<Exclude<Intensity, "repetition">, number[]> = {
  recovery: [1],
  easy: [2],
  marathon: [3],
  threshold: [4],
  interval: [5],
};

const rpe: Record<Intensity, { min: number; max: number }> = {
  recovery: { min: 2, max: 3 },
  easy: { min: 3, max: 4 },
  marathon: { min: 5, max: 6 },
  threshold: { min: 7, max: 7 },
  interval: { min: 8, max: 9 },
  repetition: { min: 9, max: 9 },
};

const talkTest: Record<Intensity, string> = {
  recovery: "Conversation très facile",
  easy: "Tu peux parler en phrases complètes",
  marathon: "Phrases courtes",
  threshold: "Quelques mots à la fois",
  interval: "Un ou deux mots",
  repetition: "Pas de conversation",
};

const minimumEffortMeters = 3_000;
const thresholdVo2Share = 0.88;

export type PaceSourceKind =
  "flat_laps" | "garmin_lactate_threshold" | "best_effort" | "vo2max";
export type HeartRateSourceKind =
  "garmin_lactate_threshold" | "garmin_zones" | "stride_zones";

export type TargetSource<K extends string> = {
  kind: K;
  asOf: string;
  confidence: TargetConfidence;
};

export type PaceRange = { fastSecondsPerKm: number; slowSecondsPerKm: number };
export type HeartRateRange = { minBpm: number; maxBpm: number };

export type IntensityTarget = {
  paceRange: PaceRange | null;
  heartRateRange: HeartRateRange | null;
  rpe: { min: number; max: number };
  talkTest: string;
  paceSource: TargetSource<PaceSourceKind> | null;
  heartRateSource: TargetSource<HeartRateSourceKind> | null;
};

export type TrailGuidance = {
  heartRateRange: HeartRateRange | null;
  rpe: { min: number; max: number };
  cue: string;
};

export type CalibrationGap =
  | "no_pace_source"
  | "low_confidence_pace"
  | "no_heart_rate_source"
  | "low_confidence_heart_rate";

export type TrainingTargets = {
  version: string;
  intensities: Record<Intensity, IntensityTarget>;
  trail: { uphill: TrailGuidance; downhill: TrailGuidance };
  calibrationGaps: CalibrationGap[];
};

type Dated = { asOf: string };
type Zones = { zone: number; lower: number; upper: number }[];

export type TargetsInput = {
  today: string;
  flatLapThresholdPace: ({ secondsPerKm: number } & Dated) | null;
  garminLactateThreshold:
    ({ speedMps: number | null; heartRateBpm: number | null } & Dated) | null;
  bestEfforts: ({ meters: number; seconds: number } & Dated)[];
  vo2Max: ({ value: number } & Dated) | null;
  garminZones: ({ zones: Zones } & Dated) | null;
  strideZones: ({ zones: Zones } & Dated) | null;
};

function ageDays(asOf: string, today: string) {
  return Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) /
      86_400_000,
  );
}

export function confidenceForAge(
  asOf: string,
  today: string,
): TargetConfidence | null {
  const age = ageDays(asOf, today);
  if (age < 0 || age > sourceAgeDays.ignored) return null;
  if (age <= sourceAgeDays.high) return "high";
  if (age <= sourceAgeDays.medium) return "medium";
  return "low";
}

function capConfidence(
  confidence: TargetConfidence,
  cap: TargetConfidence,
): TargetConfidence {
  const order: TargetConfidence[] = ["low", "medium", "high"];
  return order[Math.min(order.indexOf(confidence), order.indexOf(cap))];
}

export function effortVo2(meters: number, seconds: number) {
  const minutes = seconds / 60;
  return oxygenCost(meters / minutes) / sustainableFraction(minutes);
}

export function thresholdPaceFromVo2(vo2: number) {
  const target = thresholdVo2Share * vo2;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - target;
  const metersPerMinute = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return 60_000 / metersPerMinute;
}

type PaceCandidate = {
  secondsPerKm: number;
  source: TargetSource<PaceSourceKind>;
};

function datedSource<K extends string>(
  kind: K,
  asOf: string,
  today: string,
  cap: TargetConfidence = "high",
): TargetSource<K> | null {
  const confidence = confidenceForAge(asOf, today);
  return confidence
    ? { kind, asOf, confidence: capConfidence(confidence, cap) }
    : null;
}

function measuredThresholdPace(input: TargetsInput): PaceCandidate | null {
  const candidates: PaceCandidate[] = [];
  const laps = input.flatLapThresholdPace;
  if (laps && laps.secondsPerKm > 0) {
    const source = datedSource("flat_laps", laps.asOf, input.today);
    if (source) candidates.push({ secondsPerKm: laps.secondsPerKm, source });
  }
  const garmin = input.garminLactateThreshold;
  if (garmin?.speedMps && garmin.speedMps > 0) {
    const source = datedSource(
      "garmin_lactate_threshold",
      garmin.asOf,
      input.today,
    );
    if (source)
      candidates.push({ secondsPerKm: 1000 / garmin.speedMps, source });
  }
  return (
    candidates.sort((first, second) =>
      second.source.asOf.localeCompare(first.source.asOf),
    )[0] ?? null
  );
}

function effortThresholdPace(input: TargetsInput): PaceCandidate | null {
  const best = input.bestEfforts
    .filter(
      (effort) => effort.meters >= minimumEffortMeters && effort.seconds > 0,
    )
    .flatMap((effort) => {
      const source = datedSource("best_effort", effort.asOf, input.today);
      return source
        ? [{ vo2: effortVo2(effort.meters, effort.seconds), source }]
        : [];
    })
    .filter((item) => Number.isFinite(item.vo2) && item.vo2 > 0)
    .sort((first, second) => second.vo2 - first.vo2)[0];
  return best
    ? { secondsPerKm: thresholdPaceFromVo2(best.vo2), source: best.source }
    : null;
}

function vo2ThresholdPace(input: TargetsInput): PaceCandidate | null {
  const vo2 = input.vo2Max;
  if (!vo2 || !(vo2.value > 0)) return null;
  const source = datedSource("vo2max", vo2.asOf, input.today, "medium");
  return source
    ? { secondsPerKm: thresholdPaceFromVo2(vo2.value), source }
    : null;
}

function paceRange(thresholdSecondsPerKm: number, intensity: Intensity) {
  const [slowShare, fastShare] = thresholdSpeedShare[intensity];
  return {
    fastSecondsPerKm: Math.round(thresholdSecondsPerKm / fastShare),
    slowSecondsPerKm: Math.round(thresholdSecondsPerKm / slowShare),
  };
}

type HeartRateReference =
  | { kind: "lthr"; bpm: number; source: TargetSource<HeartRateSourceKind> }
  | { kind: "zones"; zones: Zones; source: TargetSource<HeartRateSourceKind> };

function heartRateReference(input: TargetsInput): HeartRateReference | null {
  const garmin = input.garminLactateThreshold;
  if (garmin?.heartRateBpm && garmin.heartRateBpm > 0) {
    const source = datedSource(
      "garmin_lactate_threshold",
      garmin.asOf,
      input.today,
    );
    if (source) return { kind: "lthr", bpm: garmin.heartRateBpm, source };
  }
  for (const [kind, value] of [
    ["garmin_zones", input.garminZones],
    ["stride_zones", input.strideZones],
  ] as const) {
    if (!value || value.zones.length < 5) continue;
    const source = datedSource(kind, value.asOf, input.today);
    if (source) return { kind: "zones", zones: value.zones, source };
  }
  return null;
}

function heartRateRange(
  reference: HeartRateReference,
  intensity: Exclude<Intensity, "repetition">,
): HeartRateRange | null {
  if (reference.kind === "lthr") {
    const [low, high] = lactateThresholdHeartRateShare[intensity];
    return {
      minBpm: Math.round(reference.bpm * low),
      maxBpm: Math.round(reference.bpm * high),
    };
  }
  const zones = reference.zones.filter((zone) =>
    zoneByIntensity[intensity].includes(zone.zone),
  );
  if (zones.length === 0) return null;
  return {
    minBpm: Math.min(...zones.map((zone) => zone.lower)),
    maxBpm: Math.max(...zones.map((zone) => zone.upper)),
  };
}

export function trainingTargets(input: TargetsInput): TrainingTargets {
  const pace =
    measuredThresholdPace(input) ??
    effortThresholdPace(input) ??
    vo2ThresholdPace(input);
  const heartRate = heartRateReference(input);
  const intensityTargets = Object.fromEntries(
    intensities.map((intensity) => {
      const range =
        heartRate && intensity !== "repetition"
          ? heartRateRange(heartRate, intensity)
          : null;
      return [
        intensity,
        {
          paceRange: pace ? paceRange(pace.secondsPerKm, intensity) : null,
          heartRateRange: range,
          rpe: rpe[intensity],
          talkTest: talkTest[intensity],
          paceSource: pace?.source ?? null,
          heartRateSource: range ? heartRate!.source : null,
        },
      ];
    }),
  ) as Record<Intensity, IntensityTarget>;

  const calibrationGaps: CalibrationGap[] = [];
  if (!pace) calibrationGaps.push("no_pace_source");
  else if (pace.source.confidence === "low")
    calibrationGaps.push("low_confidence_pace");
  if (!heartRate) calibrationGaps.push("no_heart_rate_source");
  else if (heartRate.source.confidence === "low")
    calibrationGaps.push("low_confidence_heart_rate");

  const easy = intensityTargets.easy.heartRateRange;
  const marathon = intensityTargets.marathon.heartRateRange;
  return {
    version: targetsVersion,
    intensities: intensityTargets,
    trail: {
      uphill: {
        heartRateRange:
          easy && marathon
            ? { minBpm: easy.minBpm, maxBpm: marathon.maxBpm }
            : null,
        rpe: { min: 4, max: 6 },
        cue: "En côte, règle l’effort au cœur ou aux sensations, pas à l’allure. Marche quand c’est plus efficace.",
      },
      downhill: {
        heartRateRange: null,
        rpe: { min: 3, max: 4 },
        cue: "En descente, reste relâché avec une cadence rapide et des appuis courts.",
      },
    },
    calibrationGaps,
  };
}

export function intensityPaces(targets: TrainingTargets): IntensityPaces {
  return Object.fromEntries(
    intensities.flatMap((intensity) => {
      const range = targets.intensities[intensity].paceRange;
      return range
        ? [[intensity, (range.fastSecondsPerKm + range.slowSecondsPerKm) / 2]]
        : [];
    }),
  );
}

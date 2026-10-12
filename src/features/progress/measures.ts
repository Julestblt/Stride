import type { Trend } from "@/components/stride/marks";
import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import {
  isOutdoorRun,
  isRunning,
  type DayValue,
  type ProgressActivity,
  type ProgressLap,
} from "./history";
import { addDays, daysBetween } from "./period";

export type MeasureKey =
  "efficiency" | "climbing" | "threshold" | "vo2" | "drift";

export type Measure = {
  key: MeasureKey;
  value: number | null;
  baseline: number | null;
  since: string | null;
  trend: Trend;
  sparkline: (number | null)[];
  samples: number;
};

export type DriftRun = { activityId: string; day: string; drift: number };

export type FitnessMeasures = {
  referenceHeartRate: number | null;
  thresholdZone: { lower: number; upper: number } | null;
  efficiency: Measure;
  climbing: Measure;
  threshold: Measure;
  vo2: Measure;
  drift: Measure & { runs: DriftRun[] };
};

export const flatGradeLimit = 0.015;
export const climbGrade = { min: 0.08, max: 0.15 } as const;
export const longRunSeconds = 90 * 60;
export const minimumWindowSamples = 3;
const sparklineBuckets = 8;
const minimumHalfSeconds = 15 * 60;
const referenceTolerance = 6;
const fastestPace = 150;
const slowestPace = 600;

type Sample = DayValue;

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function comparisonWindow(start: string, today: string) {
  const days = daysBetween(start, today) + 1;
  return Math.min(28, Math.max(14, Math.round(days / 4)));
}

function windowMedian(
  samples: Sample[],
  from: string,
  to: string,
  minimum: number,
) {
  const values = samples
    .filter((sample) => sample.day >= from && sample.day <= to)
    .map((sample) => sample.value);
  return values.length >= minimum ? median(values) : null;
}

export function sparklineWindows(start: string, today: string) {
  const days = daysBetween(start, today) + 1;
  return Array.from({ length: sparklineBuckets }, (_, bucket) => ({
    from: addDays(start, Math.floor((bucket * days) / sparklineBuckets)),
    to: addDays(
      start,
      Math.floor(((bucket + 1) * days) / sparklineBuckets) - 1,
    ),
  }));
}

export function sparkline(samples: Sample[], start: string, today: string) {
  return sparklineWindows(start, today).map(({ from, to }) =>
    windowMedian(samples, from, to, 1),
  );
}

function classify(
  delta: number | null,
  threshold: number,
  lowerIsBetter: boolean,
): Trend {
  if (delta === null) return "stable";
  const gain = lowerIsBetter ? -delta : delta;
  if (gain >= threshold) return "improving";
  if (gain <= -threshold) return "watch";
  return "stable";
}

function windowMeasure(
  key: MeasureKey,
  samples: Sample[],
  start: string,
  today: string,
  threshold: number,
  lowerIsBetter: boolean,
  minimum = minimumWindowSamples,
): Measure {
  const inRange = samples.filter(
    (sample) => sample.day >= start && sample.day <= today,
  );
  const window = comparisonWindow(start, today);
  const currentStart = addDays(today, -(window - 1));
  const value = windowMedian(inRange, currentStart, today, minimum);
  const first = inRange.reduce<string | null>(
    (earliest, sample) =>
      earliest === null || sample.day < earliest ? sample.day : earliest,
    null,
  );
  const baselineEnd = first ? addDays(first, window - 1) : null;
  const baseline =
    first && baselineEnd && baselineEnd < currentStart
      ? windowMedian(inRange, first, baselineEnd, minimum)
      : null;
  const delta = value !== null && baseline !== null ? value - baseline : null;
  return {
    key,
    value,
    baseline,
    since: baseline === null ? null : first,
    trend: classify(delta, threshold, lowerIsBetter),
    sparkline: sparkline(inRange, start, today),
    samples: inRange.length,
  };
}

function lapPace(lap: ProgressLap) {
  return lap.duration / (lap.distance / 1000);
}

export function isFlatLap(lap: ProgressLap) {
  if (lap.gain === null || lap.loss === null || lap.distance < 400)
    return false;
  const pace = lapPace(lap);
  return (
    (lap.gain + lap.loss) / lap.distance <= flatGradeLimit &&
    pace >= fastestPace &&
    pace <= slowestPace
  );
}

export function isClimbLap(lap: ProgressLap) {
  if (lap.gain === null || lap.distance < 200) return false;
  const grade = lap.gain / lap.distance;
  return grade >= climbGrade.min && grade <= climbGrade.max;
}

export function referenceHeartRate(zones: HeartRateZones | null) {
  const zone = zones?.zones.find((item) => item.zone === 2);
  return zone ? Math.round(zone.upper / 5) * 5 : null;
}

export function efficiencyPace(
  lap: ProgressLap,
  reference: number,
  resting: number | null,
) {
  if (lap.heartRate === null) return null;
  if (Math.abs(lap.heartRate - reference) > referenceTolerance) return null;
  const base = resting ?? 0;
  if (lap.heartRate <= base || reference <= base) return null;
  const speed = lap.distance / lap.duration;
  const adjusted = (speed * (reference - base)) / (lap.heartRate - base);
  return 1000 / adjusted;
}

export function cardiacDrift(laps: ProgressLap[]) {
  const ordered = [...laps]
    .filter((lap) => lap.heartRate !== null)
    .sort((a, b) => a.index - b.index);
  const total = ordered.reduce((sum, lap) => sum + lap.duration, 0);
  if (total < longRunSeconds) return null;
  const halves = [
    { distance: 0, duration: 0, beats: 0 },
    { distance: 0, duration: 0, beats: 0 },
  ];
  let elapsed = 0;
  for (const lap of ordered) {
    const half = halves[elapsed + lap.duration / 2 <= total / 2 ? 0 : 1];
    half.distance += lap.distance;
    half.duration += lap.duration;
    half.beats += lap.heartRate! * lap.duration;
    elapsed += lap.duration;
  }
  if (halves.some((half) => half.duration < minimumHalfSeconds)) return null;
  const [first, second] = halves.map(
    (half) => half.beats / half.duration / (half.distance / half.duration),
  );
  return (second / first - 1) * 100;
}

function lapDays(activities: ProgressActivity[]) {
  return new Map(activities.map((activity) => [activity.id, activity]));
}

function driftMeasure(
  activities: ProgressActivity[],
  laps: ProgressLap[],
  start: string,
  today: string,
): Measure & { runs: DriftRun[] } {
  const byActivity = new Map<string, ProgressLap[]>();
  for (const lap of laps)
    byActivity.set(lap.activityId, [
      ...(byActivity.get(lap.activityId) ?? []),
      lap,
    ]);
  const runs = activities
    .filter(
      (activity) =>
        isRunning(activity.type) &&
        activity.day >= start &&
        activity.day <= today &&
        (activity.duration ?? 0) >= longRunSeconds,
    )
    .flatMap((activity): DriftRun[] => {
      const drift = cardiacDrift(byActivity.get(activity.id) ?? []);
      return drift === null
        ? []
        : [{ activityId: activity.id, day: activity.day, drift }];
    })
    .sort((a, b) => a.day.localeCompare(b.day));
  const recent = runs.slice(-3);
  const value = median(recent.map((run) => run.drift));
  const early =
    runs.length >= 4 ? runs.slice(0, Math.min(3, runs.length - 3)) : [];
  const baseline = early.length ? median(early.map((run) => run.drift)) : null;
  const delta = value !== null && baseline !== null ? value - baseline : null;
  let trend: Trend = "stable";
  if (value !== null) {
    if (value > 8 || (value > 5 && delta !== null && delta >= 2))
      trend = "investigate";
    else if (value > 5) trend = "watch";
    else if (delta !== null && delta <= -2) trend = "improving";
  }
  return {
    key: "drift",
    value,
    baseline,
    since: baseline === null ? null : runs[0].day,
    trend,
    sparkline: sparkline(
      runs.map((run) => ({ day: run.day, value: run.drift })),
      start,
      today,
    ),
    samples: runs.length,
    runs,
  };
}

export function fitnessMeasures({
  activities,
  laps,
  vo2,
  zones,
  start,
  today,
}: {
  activities: ProgressActivity[];
  laps: ProgressLap[];
  vo2: DayValue[];
  zones: HeartRateZones | null;
  start: string;
  today: string;
}): FitnessMeasures {
  const byId = lapDays(activities);
  const outdoorLaps = laps.flatMap((lap) => {
    const activity = byId.get(lap.activityId);
    return activity && isOutdoorRun(activity.type)
      ? [{ lap, day: activity.day }]
      : [];
  });
  const flat = outdoorLaps.filter(({ lap }) => isFlatLap(lap));
  const reference = referenceHeartRate(zones);
  const zone4 = zones?.zones.find((item) => item.zone === 4) ?? null;
  const efficiency = reference
    ? flat.flatMap(({ lap, day }) => {
        const pace = efficiencyPace(lap, reference, zones?.resting ?? null);
        return pace === null ? [] : [{ day, value: pace }];
      })
    : [];
  const threshold = zone4
    ? flat
        .filter(
          ({ lap }) =>
            lap.heartRate !== null &&
            lap.heartRate >= zone4.lower &&
            lap.heartRate <= zone4.upper,
        )
        .map(({ lap, day }) => ({ day, value: lapPace(lap) }))
    : [];
  const climbing = outdoorLaps
    .filter(({ lap }) => isClimbLap(lap))
    .map(({ lap, day }) => ({
      day,
      value: (lap.gain! / lap.duration) * 3600,
    }));
  const vo2InRange = vo2
    .filter((item) => item.day >= start && item.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const vo2Value = vo2InRange.at(-1)?.value ?? null;
  const vo2Baseline = vo2InRange.length > 1 ? vo2InRange[0].value : null;
  return {
    referenceHeartRate: reference,
    thresholdZone: zone4 ? { lower: zone4.lower, upper: zone4.upper } : null,
    efficiency: windowMeasure("efficiency", efficiency, start, today, 4, true),
    climbing: windowMeasure("climbing", climbing, start, today, 30, false),
    threshold: windowMeasure("threshold", threshold, start, today, 4, true),
    vo2: {
      key: "vo2",
      value: vo2Value,
      baseline: vo2Baseline,
      since: vo2Baseline === null ? null : vo2InRange[0].day,
      trend: classify(
        vo2Value !== null && vo2Baseline !== null
          ? vo2Value - vo2Baseline
          : null,
        1,
        false,
      ),
      sparkline: sparkline(vo2InRange, start, today),
      samples: vo2InRange.length,
    },
    drift: driftMeasure(activities, laps, start, today),
  };
}

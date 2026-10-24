import type { Trend } from "@/components/stride/marks";
import { z } from "zod";
import type { LoadPoint, ProgressRace } from "./history";
import { addDays, daysBetween } from "./period";
import { median } from "./measures";

export const recoveryMetrics = [
  "training_readiness",
  "sleep_duration_seconds",
  "sleep_score",
  "hrv_last_night_ms",
  "hrv_status",
  "resting_heart_rate_bpm",
] as const;

export type RecoveryNight = {
  day: string;
  readiness: number | null;
  sleepSeconds: number | null;
  sleepScore: number | null;
  hrv: number | null;
  hrvStatus: string | null;
  restingHeartRate: number | null;
};

export const legsOptions = ["heavy", "normal", "fresh"] as const;
export const sorenessOptions = ["none", "light", "marked"] as const;
export const stressOptions = ["low", "normal", "high"] as const;
export type Legs = (typeof legsOptions)[number];
export type Soreness = (typeof sorenessOptions)[number];
export type Stress = (typeof stressOptions)[number];

export type Checkin = {
  day: string;
  legs: Legs | null;
  soreness: Soreness | null;
  stress: Stress | null;
  updatedAt: string | null;
};

export const checkinFieldSchema = z.discriminatedUnion("field", [
  z.strictObject({ field: z.literal("legs"), value: z.enum(legsOptions) }),
  z.strictObject({
    field: z.literal("soreness"),
    value: z.enum(sorenessOptions),
  }),
  z.strictObject({ field: z.literal("stress"), value: z.enum(stressOptions) }),
]);
export type CheckinField = z.infer<typeof checkinFieldSchema>;

export const checkinRowSchema = z
  .object({
    checkin_date: z.string(),
    legs: z.enum(legsOptions).nullable(),
    soreness: z.enum(sorenessOptions).nullable(),
    stress: z.enum(stressOptions).nullable(),
    updated_at: z.string().nullable(),
  })
  .transform((row): Checkin => ({
    day: row.checkin_date,
    legs: row.legs,
    soreness: row.soreness,
    stress: row.stress,
    updatedAt: row.updated_at,
  }));

export function recoveryNights(
  observations: {
    metric: string;
    day: string;
    value: number | null;
    text: string | null;
  }[],
): RecoveryNight[] {
  const nights = new Map<string, RecoveryNight>();
  for (const item of observations) {
    const night = nights.get(item.day) ?? {
      day: item.day,
      readiness: null,
      sleepSeconds: null,
      sleepScore: null,
      hrv: null,
      hrvStatus: null,
      restingHeartRate: null,
    };
    if (item.metric === "training_readiness") night.readiness = item.value;
    if (item.metric === "sleep_duration_seconds")
      night.sleepSeconds = item.value;
    if (item.metric === "sleep_score") night.sleepScore = item.value;
    if (item.metric === "hrv_last_night_ms") night.hrv = item.value;
    if (item.metric === "hrv_status") night.hrvStatus = item.text;
    if (item.metric === "resting_heart_rate_bpm")
      night.restingHeartRate = item.value;
    nights.set(item.day, night);
  }
  return [...nights.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export const trendDays = 14;
export const baselineDays = 28;
export const minimumBaseline = 7;
export const shortNightSeconds = 45 * 60;

type Series = { day: string; value: number }[];

function series(
  nights: RecoveryNight[],
  pick: (night: RecoveryNight) => number | null,
  from: string,
  to: string,
): Series {
  return nights.flatMap((night) => {
    const value = pick(night);
    return value !== null && night.day >= from && night.day <= to
      ? [{ day: night.day, value }]
      : [];
  });
}

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function quantile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function usualRange(values: number[]) {
  if (values.length < minimumBaseline) return null;
  const average = mean(values)!;
  const deviation = Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length,
  );
  return {
    low: Math.round(average - deviation),
    high: Math.round(average + deviation),
  };
}

export function restingRange(values: number[]) {
  if (values.length < minimumBaseline) return null;
  return {
    low: Math.round(quantile(values, 0.25)),
    high: Math.round(quantile(values, 0.75)),
  };
}

export type Readiness = {
  today: number;
  average: number | null;
  level: "high" | "moderate" | "low" | "poor";
  trend: Trend;
};

export function readinessLevel(score: number): Readiness["level"] {
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  if (score >= 25) return "low";
  return "poor";
}

export const readinessTones = {
  high: "success",
  moderate: "warning",
  low: "danger",
  poor: "danger",
} as const satisfies Record<
  Readiness["level"],
  "success" | "warning" | "danger"
>;

export type SessionFit = "ready" | "caution" | "review";

export function sessionFit(score: number, quality: boolean): SessionFit {
  const level = readinessLevel(score);
  if (quality)
    return level === "high"
      ? "ready"
      : level === "moderate"
        ? "caution"
        : "review";
  return level === "poor" ? "review" : "ready";
}

export type SignalStatus = {
  trend: Trend;
  streak: number;
};

export type SleepSignal = {
  last: number;
  lastDay: string;
  average: number | null;
  score: number | null;
  nights: { day: string; seconds: number | null; score: number | null }[];
} & SignalStatus;

export type RangeSignal = {
  last: number;
  lastDay: string;
  range: { low: number; high: number } | null;
  median: number | null;
  points: { day: string; value: number | null }[];
  position: "below" | "within" | "above" | null;
  status: string | null;
} & SignalStatus;

export type LoadSignal = { ratio: number; average: number | null };

export type RaceRecovery = {
  id: string;
  name: string;
  day: string;
  days: number | null;
  ongoing: number | null;
};

export type RecoveryModel = {
  today: string;
  readiness: Readiness | null;
  sleep: SleepSignal | null;
  hrv: RangeSignal | null;
  restingHeartRate: RangeSignal | null;
  load: LoadSignal | null;
  checkin: Checkin | null;
  races: RaceRecovery[];
  nextRace: ProgressRace | null;
};

function latest(points: Series, today: string) {
  const last = points.at(-1);
  return last && daysBetween(last.day, today) <= 1 ? last : null;
}

function streak(
  nights: { day: string; value: number | null }[],
  failing: (value: number) => boolean,
) {
  let count = 0;
  for (const night of [...nights].reverse()) {
    if (night.value === null || !failing(night.value)) break;
    count++;
  }
  return count;
}

function windowNights(today: string, days: number) {
  return Array.from({ length: days }, (_, index) =>
    addDays(today, index - days + 1),
  );
}

function rangeSignal(
  nights: RecoveryNight[],
  pick: (night: RecoveryNight) => number | null,
  today: string,
  rangeOf: (values: number[]) => { low: number; high: number } | null,
  higherIsBetter: boolean,
): RangeSignal | null {
  const recent = series(nights, pick, addDays(today, -1), today);
  const last = latest(recent, today);
  if (!last) return null;
  const baseline = series(
    nights,
    pick,
    addDays(last.day, -baselineDays),
    addDays(last.day, -1),
  ).map((item) => item.value);
  const range = rangeOf(baseline);
  const byDay = new Map(nights.map((night) => [night.day, pick(night)]));
  const points = windowNights(last.day, trendDays).map((day) => ({
    day,
    value: byDay.get(day) ?? null,
  }));
  const position = range
    ? last.value < range.low
      ? "below"
      : last.value > range.high
        ? "above"
        : "within"
    : null;
  const unfavorable = higherIsBetter ? "below" : "above";
  const outside = range
    ? streak(points, (value) =>
        higherIsBetter ? value < range.low : value > range.high,
      )
    : 0;
  return {
    last: last.value,
    lastDay: last.day,
    range,
    median: median(baseline),
    points,
    position,
    status: nights.find((night) => night.day === last.day)?.hrvStatus ?? null,
    streak: outside,
    trend:
      position === null
        ? "stable"
        : position === unfavorable
          ? outside >= 2
            ? "investigate"
            : "watch"
          : position === "within"
            ? "stable"
            : "improving",
  };
}

function sleepSignal(
  nights: RecoveryNight[],
  today: string,
): SleepSignal | null {
  const recent = series(
    nights,
    (night) => night.sleepSeconds,
    addDays(today, -1),
    today,
  );
  const last = latest(recent, today);
  if (!last) return null;
  const average = mean(
    series(
      nights,
      (night) => night.sleepSeconds,
      addDays(last.day, -trendDays),
      addDays(last.day, -1),
    ).map((item) => item.value),
  );
  const byDay = new Map(nights.map((night) => [night.day, night]));
  const window = windowNights(last.day, trendDays).map((day) => ({
    day,
    seconds: byDay.get(day)?.sleepSeconds ?? null,
    score: byDay.get(day)?.sleepScore ?? null,
  }));
  const short =
    average === null
      ? 0
      : streak(
          window.map((night) => ({ day: night.day, value: night.seconds })),
          (value) => value < average - shortNightSeconds,
        );
  return {
    last: last.value,
    lastDay: last.day,
    average,
    score: byDay.get(last.day)?.sleepScore ?? null,
    nights: window,
    streak: short,
    trend: short >= 2 ? "investigate" : short === 1 ? "watch" : "stable",
  };
}

function readinessSignal(
  nights: RecoveryNight[],
  today: string,
): Readiness | null {
  const recent = series(
    nights,
    (night) => night.readiness,
    addDays(today, -1),
    today,
  );
  const last = latest(recent, today);
  if (!last) return null;
  const previous = series(
    nights,
    (night) => night.readiness,
    addDays(last.day, -trendDays),
    addDays(last.day, -1),
  ).map((item) => item.value);
  const average = previous.length >= minimumBaseline ? mean(previous) : null;
  const delta = average === null ? 0 : last.value - average;
  return {
    today: last.value,
    average,
    level: readinessLevel(last.value),
    trend: delta <= -5 ? "watch" : delta >= 5 ? "improving" : "stable",
  };
}

function loadSignal(load: LoadPoint[], today: string): LoadSignal | null {
  const ratio = (point: LoadPoint) =>
    point.chronic > 0 ? point.acute / point.chronic : null;
  const current = [...load].reverse().find((point) => point.day <= today);
  if (!current || daysBetween(current.day, today) > 1) return null;
  const value = ratio(current);
  if (value === null) return null;
  const previous = load
    .filter(
      (point) =>
        point.day >= addDays(current.day, -trendDays) &&
        point.day < current.day,
    )
    .flatMap((point) => {
      const item = ratio(point);
      return item === null ? [] : [item];
    });
  return {
    ratio: value,
    average: previous.length >= minimumBaseline ? mean(previous) : null,
  };
}

export const maximumRecoveryDays = 30;

export function raceRecoveries(
  nights: RecoveryNight[],
  races: ProgressRace[],
  today: string,
): RaceRecovery[] {
  return races
    .filter((race) => race.day < today)
    .sort((a, b) => a.day.localeCompare(b.day))
    .flatMap((race): RaceRecovery[] => {
      const baseline = series(
        nights,
        (night) => night.hrv,
        addDays(race.day, -baselineDays),
        addDays(race.day, -1),
      ).map((item) => item.value);
      const range = usualRange(baseline);
      if (!range) return [];
      const after = series(
        nights,
        (night) => night.hrv,
        addDays(race.day, 1),
        addDays(race.day, maximumRecoveryDays),
      );
      if (after.length === 0) return [];
      const back = after.find((night) => night.value >= range.low);
      const elapsed = Math.min(
        daysBetween(race.day, today),
        maximumRecoveryDays,
      );
      return [
        {
          id: race.id,
          name: race.name,
          day: race.day,
          days: back ? daysBetween(race.day, back.day) : null,
          ongoing: back ? null : elapsed,
        },
      ];
    });
}

export function recoveryModel({
  nights,
  load,
  checkin,
  races,
  today,
}: {
  nights: RecoveryNight[];
  load: LoadPoint[];
  checkin: Checkin | null;
  races: ProgressRace[];
  today: string;
}): RecoveryModel {
  return {
    today,
    readiness: readinessSignal(nights, today),
    sleep: sleepSignal(nights, today),
    hrv: rangeSignal(nights, (night) => night.hrv, today, usualRange, true),
    restingHeartRate: rangeSignal(
      nights,
      (night) => night.restingHeartRate,
      today,
      restingRange,
      false,
    ),
    load: loadSignal(load, today),
    checkin: checkin?.day === today ? checkin : null,
    races: raceRecoveries(nights, races, today),
    nextRace:
      races
        .filter((race) => race.day >= today)
        .sort((a, b) => a.day.localeCompare(b.day))[0] ?? null,
  };
}

import type { Trend } from "@/components/stride/marks";
import { z } from "zod";
import { median } from "./measures";
import { addDays, daysBetween } from "./period";
import { restingRange, usualRange } from "./recovery";

export const healthViews = ["day", "week", "month"] as const;
export type HealthView = (typeof healthViews)[number];
export const healthViewLabels: Record<HealthView, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

const viewSchema = z.enum(healthViews).catch("week");

export function parseHealthView(value: unknown): HealthView {
  return viewSchema.parse(Array.isArray(value) ? value[0] : value);
}

export const healthWindow: Record<
  Exclude<HealthView, "day">,
  { reading: number; chart: number }
> = {
  week: { reading: 7, chart: 14 },
  month: { reading: 30, chart: 30 },
};

export const healthMetrics = [
  "sleep_duration_seconds",
  "sleep_deep_seconds",
  "sleep_light_seconds",
  "sleep_rem_seconds",
  "sleep_awake_seconds",
  "sleep_score",
  "hrv_last_night_ms",
  "resting_heart_rate_bpm",
  "average_stress",
  "body_battery_wake",
  "body_battery_charged",
  "body_battery_drained",
  "steps",
  "recovery_time_minutes",
  "training_load_acute",
  "training_load_chronic",
  "vo2_max",
  "load_focus_low_aerobic",
  "load_focus_high_aerobic",
  "load_focus_anaerobic",
] as const;

export type HealthDay = {
  day: string;
  sleep: number | null;
  deep: number | null;
  light: number | null;
  rem: number | null;
  awake: number | null;
  sleepScore: number | null;
  hrv: number | null;
  restingHeartRate: number | null;
  stress: number | null;
  batteryWake: number | null;
  batteryCharged: number | null;
  batteryDrained: number | null;
  steps: number | null;
  recoveryMinutes: number | null;
  acute: number | null;
  chronic: number | null;
  vo2: number | null;
  focusLowAerobic: number | null;
  focusHighAerobic: number | null;
  focusAnaerobic: number | null;
};

const fields: Record<(typeof healthMetrics)[number], keyof HealthDay> = {
  sleep_duration_seconds: "sleep",
  sleep_deep_seconds: "deep",
  sleep_light_seconds: "light",
  sleep_rem_seconds: "rem",
  sleep_awake_seconds: "awake",
  sleep_score: "sleepScore",
  hrv_last_night_ms: "hrv",
  resting_heart_rate_bpm: "restingHeartRate",
  average_stress: "stress",
  body_battery_wake: "batteryWake",
  body_battery_charged: "batteryCharged",
  body_battery_drained: "batteryDrained",
  steps: "steps",
  recovery_time_minutes: "recoveryMinutes",
  training_load_acute: "acute",
  training_load_chronic: "chronic",
  vo2_max: "vo2",
  load_focus_low_aerobic: "focusLowAerobic",
  load_focus_high_aerobic: "focusHighAerobic",
  load_focus_anaerobic: "focusAnaerobic",
};

function emptyDay(day: string): HealthDay {
  return {
    day,
    sleep: null,
    deep: null,
    light: null,
    rem: null,
    awake: null,
    sleepScore: null,
    hrv: null,
    restingHeartRate: null,
    stress: null,
    batteryWake: null,
    batteryCharged: null,
    batteryDrained: null,
    steps: null,
    recoveryMinutes: null,
    acute: null,
    chronic: null,
    vo2: null,
    focusLowAerobic: null,
    focusHighAerobic: null,
    focusAnaerobic: null,
  };
}

export function healthDays(
  observations: { metric: string; day: string; value: number | null }[],
): HealthDay[] {
  const days = new Map<string, HealthDay>();
  for (const item of observations) {
    const field = fields[item.metric as (typeof healthMetrics)[number]];
    if (!field || item.value === null) continue;
    const entry = days.get(item.day) ?? emptyDay(item.day);
    (entry[field] as number | null) = item.value;
    days.set(item.day, entry);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

type NumericField = Exclude<keyof HealthDay, "day">;

function values(
  days: HealthDay[],
  field: NumericField,
  from: string,
  to: string,
) {
  return days.flatMap((item) =>
    item.day >= from && item.day <= to && item[field] !== null
      ? [{ day: item.day, value: item[field] as number }]
      : [],
  );
}

function latest(
  days: HealthDay[],
  field: NumericField,
  today: string,
  maxAge = 1,
) {
  const found = [...days]
    .reverse()
    .find((item) => item.day <= today && item[field] !== null);
  return found && daysBetween(found.day, today) <= maxAge
    ? { day: found.day, value: found[field] as number }
    : null;
}

function mean(list: number[]) {
  return list.length
    ? list.reduce((sum, value) => sum + value, 0) / list.length
    : null;
}

function series(
  days: HealthDay[],
  field: NumericField,
  end: string,
  length: number,
) {
  const byDay = new Map(
    days.map((item) => [item.day, item[field] as number | null]),
  );
  return Array.from({ length }, (_, index) => {
    const day = addDays(end, index - length + 1);
    return { day, value: byDay.get(day) ?? null };
  });
}

export type SleepStages = {
  deep: number;
  light: number;
  rem: number;
  awake: number;
};

export type HealthSleep = {
  last: number;
  lastDay: string;
  average: number | null;
  readingAverage: number | null;
  score: number | null;
  stages: SleepStages | null;
  restorativeShare: number | null;
  usualRestorativeShare: number | null;
  shortest: boolean;
  nights: { day: string; value: number | null; score: number | null }[];
  trend: Trend;
};

export type HealthRange = {
  last: number;
  lastDay: string;
  range: { low: number; high: number } | null;
  median: number | null;
  points: { day: string; value: number | null }[];
  position: "below" | "within" | "above" | null;
};

export type HealthEnergy = {
  wake: number;
  wakeDay: string;
  charged: number | null;
  usualCharged: number | null;
  drained: number | null;
  stress: number | null;
  points: { day: string; value: number | null }[];
};

export type HealthLoad = {
  ratio: number;
  acute: number;
  chronic: number;
  vo2: number | null;
  recoveryHours: number | null;
  focus: { lowAerobic: number; highAerobic: number; anaerobic: number } | null;
  zone: "low" | "productive" | "high";
};

export type HealthStress = {
  value: number;
  day: string;
  average: number | null;
};

export type HealthModel = {
  view: Exclude<HealthView, "day">;
  today: string;
  readingDays: number;
  chartDays: number;
  sleep: HealthSleep | null;
  hrv: HealthRange | null;
  restingHeartRate: HealthRange | null;
  energy: HealthEnergy | null;
  stress: HealthStress | null;
  load: HealthLoad | null;
  history: { sleepNights: number; hrvNights: number; loadDays: number };
};

function restorative(item: HealthDay) {
  if (item.deep === null || item.rem === null || !item.sleep) return null;
  return (item.deep + item.rem) / item.sleep;
}

function sleepModel(
  days: HealthDay[],
  today: string,
  readingDays: number,
  chartDays: number,
): HealthSleep | null {
  const last = latest(days, "sleep", today);
  if (!last) return null;
  const night = days.find((item) => item.day === last.day)!;
  const previous = values(
    days,
    "sleep",
    addDays(last.day, -14),
    addDays(last.day, -1),
  ).map((item) => item.value);
  const average = previous.length >= 7 ? mean(previous) : null;
  const reading = values(
    days,
    "sleep",
    addDays(last.day, -(readingDays - 1)),
    last.day,
  ).map((item) => item.value);
  const fortnight = values(days, "sleep", addDays(last.day, -13), last.day).map(
    (item) => item.value,
  );
  const shares = days
    .filter((item) => item.day >= addDays(last.day, -28) && item.day < last.day)
    .flatMap((item) => {
      const share = restorative(item);
      return share === null ? [] : [share];
    });
  const nightsSeries = series(days, "sleep", last.day, chartDays);
  const scores = new Map(days.map((item) => [item.day, item.sleepScore]));
  const short = average !== null && last.value < average - 45 * 60;
  return {
    last: last.value,
    lastDay: last.day,
    average,
    readingAverage: reading.length ? mean(reading) : null,
    score: night.sleepScore,
    stages:
      night.deep !== null && night.light !== null && night.rem !== null
        ? {
            deep: night.deep,
            light: night.light,
            rem: night.rem,
            awake: night.awake ?? 0,
          }
        : null,
    restorativeShare: restorative(night),
    usualRestorativeShare: shares.length >= 7 ? median(shares) : null,
    shortest: fortnight.length >= 7 && last.value <= Math.min(...fortnight),
    nights: nightsSeries.map((item) => ({
      ...item,
      score: scores.get(item.day) ?? null,
    })),
    trend: short
      ? "watch"
      : average !== null && last.value > average + 30 * 60
        ? "improving"
        : "stable",
  };
}

function rangeModel(
  days: HealthDay[],
  field: "hrv" | "restingHeartRate",
  today: string,
  chartDays: number,
): HealthRange | null {
  const last = latest(days, field, today);
  if (!last) return null;
  const baseline = values(
    days,
    field,
    addDays(last.day, -28),
    addDays(last.day, -1),
  ).map((item) => item.value);
  const range = field === "hrv" ? usualRange(baseline) : restingRange(baseline);
  return {
    last: last.value,
    lastDay: last.day,
    range,
    median: median(baseline),
    points: series(days, field, last.day, chartDays),
    position: range
      ? last.value < range.low
        ? "below"
        : last.value > range.high
          ? "above"
          : "within"
      : null,
  };
}

function energyModel(
  days: HealthDay[],
  today: string,
  chartDays: number,
): HealthEnergy | null {
  const wake = latest(days, "batteryWake", today);
  if (!wake) return null;
  const night = days.find((item) => item.day === wake.day)!;
  const yesterday = days.find((item) => item.day === addDays(wake.day, -1));
  const charged = values(
    days,
    "batteryCharged",
    addDays(wake.day, -28),
    addDays(wake.day, -1),
  ).map((item) => item.value);
  return {
    wake: wake.value,
    wakeDay: wake.day,
    charged: night.batteryCharged,
    usualCharged: charged.length >= 7 ? median(charged) : null,
    drained: yesterday?.batteryDrained ?? null,
    stress: yesterday?.stress ?? null,
    points: series(days, "batteryWake", wake.day, chartDays),
  };
}

export function loadZone(ratio: number): HealthLoad["zone"] {
  if (ratio < 0.8) return "low";
  if (ratio > 1.5) return "high";
  return "productive";
}

function loadModel(days: HealthDay[], today: string): HealthLoad | null {
  const acute = latest(days, "acute", today);
  const chronic = latest(days, "chronic", today);
  if (!acute || !chronic || chronic.value <= 0) return null;
  const vo2 = latest(days, "vo2", today, 30);
  const recovery = latest(days, "recoveryMinutes", today);
  const day = days.find((item) => item.day === acute.day)!;
  const ratio = acute.value / chronic.value;
  return {
    ratio,
    acute: acute.value,
    chronic: chronic.value,
    vo2: vo2?.value ?? null,
    recoveryHours: recovery ? recovery.value / 60 : null,
    focus:
      day.focusLowAerobic !== null &&
      day.focusHighAerobic !== null &&
      day.focusAnaerobic !== null
        ? {
            lowAerobic: day.focusLowAerobic,
            highAerobic: day.focusHighAerobic,
            anaerobic: day.focusAnaerobic,
          }
        : null,
    zone: loadZone(ratio),
  };
}

function stressModel(
  days: HealthDay[],
  today: string,
  readingDays: number,
): HealthStress | null {
  const complete = latest(days, "stress", addDays(today, -1));
  if (!complete) return null;
  const reading = values(
    days,
    "stress",
    addDays(today, -readingDays),
    addDays(today, -1),
  ).map((item) => item.value);
  return { value: complete.value, day: complete.day, average: mean(reading) };
}

export function healthModel({
  days,
  view,
  today,
}: {
  days: HealthDay[];
  view: Exclude<HealthView, "day">;
  today: string;
}): HealthModel {
  const { reading, chart } = healthWindow[view];
  return {
    view,
    today,
    readingDays: reading,
    chartDays: chart,
    sleep: sleepModel(days, today, reading, chart),
    hrv: rangeModel(days, "hrv", today, chart),
    restingHeartRate: rangeModel(days, "restingHeartRate", today, chart),
    energy: energyModel(days, today, chart),
    stress: stressModel(days, today, reading),
    load: loadModel(days, today),
    history: {
      sleepNights: days.filter((item) => item.sleep !== null).length,
      hrvNights: days.filter((item) => item.hrv !== null).length,
      loadDays: days.filter((item) => item.acute !== null).length,
    },
  };
}

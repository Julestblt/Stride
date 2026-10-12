import { z } from "zod";

export type ProgressActivity = {
  id: string;
  day: string;
  type: string;
  name: string | null;
  distance: number | null;
  duration: number | null;
  gain: number | null;
};

export type ProgressLap = {
  activityId: string;
  index: number;
  distance: number;
  duration: number;
  heartRate: number | null;
  gain: number | null;
  loss: number | null;
};

export type LoadPoint = { day: string; acute: number; chronic: number };
export type DayValue = { day: string; value: number };

export type ProgressRace = {
  id: string;
  name: string;
  day: string;
  kind: "road" | "trail";
  distanceKm: number | null;
  priority: string;
};

export type ProgressHistory = {
  activities: ProgressActivity[];
  laps: ProgressLap[];
  load: LoadPoint[];
  vo2: DayValue[];
  races: ProgressRace[];
};

export const runningTypes = [
  "running",
  "treadmill_running",
  "track_running",
  "trail_running",
  "ultra_run",
] as const;
const outdoorRunning = new Set<string>([
  "running",
  "track_running",
  "trail_running",
  "ultra_run",
]);
const trailRunning = new Set<string>(["trail_running", "ultra_run"]);

export function isRunning(type: string) {
  return (runningTypes as readonly string[]).includes(type);
}

export function isOutdoorRun(type: string) {
  return outdoorRunning.has(type);
}

export function isTrailRun(type: string) {
  return trailRunning.has(type);
}

const measure = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => {
    const parsed = value === null ? NaN : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  });

export const progressActivityColumns =
  "id, activity_type, activity_name, started_at, local_started_at, distance_meters, duration_seconds, elevation_gain_meters";

export const progressActivitySchema = z
  .object({
    id: z.string(),
    activity_type: z.string().nullable(),
    activity_name: z.string().nullable(),
    started_at: z.string(),
    local_started_at: z.string().nullable(),
    distance_meters: measure,
    duration_seconds: measure,
    elevation_gain_meters: measure,
  })
  .transform((row): ProgressActivity => ({
    id: row.id,
    day: (row.local_started_at ?? row.started_at).slice(0, 10),
    type: row.activity_type ?? "other",
    name: row.activity_name?.trim() || null,
    distance: row.distance_meters,
    duration: row.duration_seconds,
    gain: row.elevation_gain_meters,
  }));

export const progressLapColumns =
  "activity_id, segment_index, distance_meters, duration_seconds, average_heart_rate, elevation_gain_meters, elevation_loss_meters";

export const progressLapSchema = z
  .object({
    activity_id: z.string(),
    segment_index: z.number().int(),
    distance_meters: measure,
    duration_seconds: measure,
    average_heart_rate: measure,
    elevation_gain_meters: measure,
    elevation_loss_meters: measure,
  })
  .transform((row): ProgressLap | null =>
    row.distance_meters && row.duration_seconds
      ? {
          activityId: row.activity_id,
          index: row.segment_index,
          distance: row.distance_meters,
          duration: row.duration_seconds,
          heartRate: row.average_heart_rate || null,
          gain: row.elevation_gain_meters,
          loss: row.elevation_loss_meters,
        }
      : null,
  );

export const observationSchema = z
  .object({
    metric: z.string(),
    observed_on: z.string(),
    value_numeric: measure,
  })
  .transform((row) =>
    row.value_numeric === null
      ? null
      : { metric: row.metric, day: row.observed_on, value: row.value_numeric },
  );

export function loadPoints(
  observations: { metric: string; day: string; value: number }[],
): LoadPoint[] {
  const days = new Map<string, { acute?: number; chronic?: number }>();
  for (const item of observations) {
    const entry = days.get(item.day) ?? {};
    if (item.metric === "training_load_acute") entry.acute = item.value;
    if (item.metric === "training_load_chronic") entry.chronic = item.value;
    days.set(item.day, entry);
  }
  return [...days.entries()]
    .flatMap(([day, entry]) =>
      entry.acute !== undefined && entry.chronic !== undefined
        ? [{ day, acute: entry.acute, chronic: entry.chronic }]
        : [],
    )
    .sort((a, b) => a.day.localeCompare(b.day));
}

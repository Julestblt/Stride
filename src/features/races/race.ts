import { z } from "zod";
import { clockFromSql } from "./format";
import type { RaceKind } from "@/features/onboarding/goals";
import type { CoursePoint } from "./course";

export type RacePlan = {
  revision: number | null;
  startMinutes: number | null;
  startConfirmed: boolean;
  ambitiousSeconds: number | null;
  cautiousSeconds: number | null;
  cutoffSeconds: number | null;
  labels: string[];
  walkGradePercent: number;
  walkPaceSecondsPerKm: number;
  aidStopSeconds: number;
  waterStopSeconds: number;
  carbsPerHourG: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  alarmMinutes: number;
  nightCaffeine: boolean;
  roadbookImport: RoadbookImportSummary | null;
};

export const roadbookImportSchema = z.object({
  source: z.string().max(200),
  importedAt: z.iso.datetime(),
  points: z.number().int().min(0),
  cutoffs: z.number().int().min(0),
  review: z.array(z.string().max(60)).max(50),
});
export type RoadbookImportSummary = z.infer<typeof roadbookImportSchema>;

export const defaultPlan: RacePlan = {
  revision: null,
  startMinutes: null,
  startConfirmed: false,
  ambitiousSeconds: null,
  cautiousSeconds: null,
  cutoffSeconds: null,
  labels: [],
  walkGradePercent: 10,
  walkPaceSecondsPerKm: 690,
  aidStopSeconds: 300,
  waterStopSeconds: 120,
  carbsPerHourG: 60,
  waterMlPerHour: 450,
  sodiumMgPerHour: 500,
  alarmMinutes: 20,
  nightCaffeine: true,
  roadbookImport: null,
};

export const defaultStartMinutes = 8 * 60;

export const planColumns =
  "start_time, start_time_confirmed, ambitious_duration_seconds, cautious_duration_seconds, cutoff_duration_seconds, labels, walk_grade_percent, walk_pace_seconds_per_km, aid_stop_seconds, water_stop_seconds, carbs_per_hour_g, water_ml_per_hour, sodium_mg_per_hour, nutrition_alarm_minutes, night_caffeine, roadbook_import, revision";

export const planRowSchema = z
  .object({
    start_time: z.string().nullable(),
    start_time_confirmed: z.boolean(),
    ambitious_duration_seconds: z.number().int().nullable(),
    cautious_duration_seconds: z.number().int().nullable(),
    cutoff_duration_seconds: z.number().int().nullable(),
    labels: z.array(z.string()),
    walk_grade_percent: z.number().int(),
    walk_pace_seconds_per_km: z.number().int(),
    aid_stop_seconds: z.number().int(),
    water_stop_seconds: z.number().int(),
    carbs_per_hour_g: z.number().int(),
    water_ml_per_hour: z.number().int(),
    sodium_mg_per_hour: z.number().int(),
    nutrition_alarm_minutes: z.number().int(),
    night_caffeine: z.boolean(),
    roadbook_import: z.unknown().nullable(),
    revision: z.number().int().positive(),
  })
  .transform((row): RacePlan => ({
    revision: row.revision,
    startMinutes: clockFromSql(row.start_time),
    startConfirmed: row.start_time_confirmed,
    ambitiousSeconds: row.ambitious_duration_seconds,
    cautiousSeconds: row.cautious_duration_seconds,
    cutoffSeconds: row.cutoff_duration_seconds,
    labels: row.labels,
    walkGradePercent: row.walk_grade_percent,
    walkPaceSecondsPerKm: row.walk_pace_seconds_per_km,
    aidStopSeconds: row.aid_stop_seconds,
    waterStopSeconds: row.water_stop_seconds,
    carbsPerHourG: row.carbs_per_hour_g,
    waterMlPerHour: row.water_ml_per_hour,
    sodiumMgPerHour: row.sodium_mg_per_hour,
    alarmMinutes: row.nutrition_alarm_minutes,
    nightCaffeine: row.night_caffeine,
    roadbookImport:
      roadbookImportSchema.safeParse(row.roadbook_import).data ?? null,
  }));

export const planInputSchema = z.object({
  startMinutes: z.number().int().min(0).max(1439).nullable(),
  startConfirmed: z.boolean(),
  ambitiousSeconds: z.number().int().min(60).max(1_209_599).nullable(),
  cautiousSeconds: z.number().int().min(60).max(1_209_599).nullable(),
  cutoffSeconds: z.number().int().min(60).max(1_209_599).nullable(),
  labels: z.array(z.string().trim().min(1).max(40)).max(4),
  walkGradePercent: z.number().int().min(5).max(20),
  walkPaceSecondsPerKm: z.number().int().min(360).max(1800),
  aidStopSeconds: z.number().int().min(0).max(3600),
  waterStopSeconds: z.number().int().min(0).max(3600),
  carbsPerHourG: z.number().int().min(20).max(120),
  waterMlPerHour: z.number().int().min(100).max(1500),
  sodiumMgPerHour: z.number().int().min(0).max(2000),
  alarmMinutes: z.number().int().min(5).max(60),
  nightCaffeine: z.boolean(),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export type StoredCourse = {
  source: "gpx" | "activity";
  fileName: string | null;
  sourceActivityId: string | null;
  timeZone: string;
  distanceM: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  stepM: number;
  points: CoursePoint[];
  importedAt: string;
};

export const courseColumns =
  "source, file_name, source_activity_id, time_zone, distance_m, elevation_gain_m, elevation_loss_m, step_m, points, imported_at";

export const courseRowSchema = z
  .object({
    source: z.enum(["gpx", "activity"]),
    file_name: z.string().nullable(),
    source_activity_id: z.string().nullable(),
    time_zone: z.string(),
    distance_m: z.coerce.number(),
    elevation_gain_m: z.number().int().nullable(),
    elevation_loss_m: z.number().int().nullable(),
    step_m: z.coerce.number(),
    points: z
      .array(z.tuple([z.number(), z.number(), z.number().nullable()]))
      .min(2),
    imported_at: z.string(),
  })
  .transform((row): StoredCourse => ({
    source: row.source,
    fileName: row.file_name,
    sourceActivityId: row.source_activity_id,
    timeZone: row.time_zone,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    elevationLossM: row.elevation_loss_m,
    stepM: row.step_m,
    points: row.points,
    importedAt: row.imported_at,
  }));

export type RaceSummary = {
  id: string;
  name: string;
  kind: RaceKind;
  date: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  priority: "A" | "B" | "C";
  targetSeconds: number | null;
  revision: number;
};

const dayMs = 86_400_000;

export function daysUntil(date: string, today: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      dayMs,
  );
}

const priorityRank = { A: 0, B: 1, C: 2 } as const;

export function nextRace<T extends Pick<RaceSummary, "date" | "priority">>(
  races: T[],
  today: string,
) {
  const upcoming = races
    .filter(
      (race): race is T & { date: string } =>
        race.date !== null && race.date >= today,
    )
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.date.localeCompare(b.date),
    );
  return upcoming[0] ?? races[0] ?? null;
}

const raceDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  timeZone: "UTC",
});

export function formatRaceDate(date: string) {
  return raceDate.format(new Date(`${date}T00:00:00Z`));
}

export function formatShortDate(date: string) {
  return shortDate.format(new Date(`${date}T00:00:00Z`)).replace(".", "");
}

export function formatWeekday(date: string) {
  const day = longDay.format(new Date(`${date}T00:00:00Z`));
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export type CourseActivity = {
  id: string;
  title: string;
  date: string;
  distanceM: number | null;
  elevationGainM: number | null;
};

import { z } from "zod";

export const activityFilters = ["all", "road", "trail"] as const;
export type ActivityFilter = (typeof activityFilters)[number];
export type ActivityKind = "road" | "trail" | "other";

export const activityFilterLabels: Record<ActivityFilter, string> = {
  all: "Tout",
  road: "Route",
  trail: "Trail",
};
export const activityTypesByFilter: Record<
  Exclude<ActivityFilter, "all">,
  readonly string[]
> = {
  road: ["running", "treadmill_running", "track_running"],
  trail: ["trail_running", "ultra_run"],
};
const typeLabels: Record<string, string> = {
  running: "Course à pied",
  treadmill_running: "Course sur tapis",
  track_running: "Piste",
  trail_running: "Trail",
  ultra_run: "Ultra-trail",
  strength_training: "Renforcement",
  indoor_cardio: "Cardio",
  cycling: "Vélo",
  road_biking: "Vélo de route",
  mountain_biking: "VTT",
  indoor_cycling: "Vélo d’intérieur",
  hiking: "Randonnée",
  walking: "Marche",
  lap_swimming: "Natation",
  open_water_swimming: "Nage en eau libre",
  yoga: "Yoga",
};

export const activityColumns =
  "id, activity_type, route_name, started_at, local_started_at, distance_meters, duration_seconds, elevation_gain_meters, average_heart_rate";

const measure = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => {
    const parsed = value === null ? NaN : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

export const activityRowSchema = z
  .object({
    id: z.string(),
    activity_type: z.string().nullable(),
    route_name: z.string().nullable(),
    started_at: z.string(),
    local_started_at: z.string().nullable(),
    distance_meters: measure,
    duration_seconds: measure,
    elevation_gain_meters: measure,
    average_heart_rate: measure,
  })
  .transform((row) => ({
    id: row.id,
    type: row.activity_type,
    routeName: row.route_name?.trim() || null,
    date: (row.local_started_at ?? row.started_at).slice(0, 10),
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    elevationGainMeters: row.elevation_gain_meters,
    averageHeartRate: row.average_heart_rate,
  }));

export type Activity = z.output<typeof activityRowSchema>;
export type ActivityMetricKey =
  "distance" | "duration" | "pace" | "elevation" | "heartRate";
export type ActivityMetric = {
  key: ActivityMetricKey;
  label: string;
  value: string;
  unit?: string;
};
export type ActivityGroup = { label: string; activities: Activity[] };

const metricLabels: Record<ActivityMetricKey, string> = {
  distance: "Distance",
  duration: "Temps",
  pace: "Allure",
  elevation: "D+",
  heartRate: "FC moy.",
};
const listMetricOrder: Record<ActivityKind, ActivityMetricKey[]> = {
  road: ["distance", "pace"],
  trail: ["distance", "elevation", "duration"],
  other: ["duration", "elevation"],
};
const detailMetricOrder: ActivityMetricKey[] = [
  "distance",
  "duration",
  "pace",
  "elevation",
  "heartRate",
];
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const shortDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shortDayYear = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthName = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayMs = 86_400_000;

export function parseActivityFilter(value: unknown): ActivityFilter {
  return activityFilters.find((filter) => filter === value) ?? "all";
}

export function activityKind(type: string | null): ActivityKind {
  if (type && activityTypesByFilter.road.includes(type)) return "road";
  if (type && activityTypesByFilter.trail.includes(type)) return "trail";
  return "other";
}

export function activityTitle(activity: Activity) {
  const label = (activity.type && typeLabels[activity.type]) || "Activité";
  return activity.routeName ? `${label} · ${activity.routeName}` : label;
}

export function formatDistance(meters: number) {
  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 2 : 1;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(kilometers);
}

export function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

export function formatPace(meters: number, seconds: number) {
  const perKilometer = Math.round(seconds / (meters / 1000));
  return `${Math.floor(perKilometer / 60)}:${String(perKilometer % 60).padStart(2, "0")}`;
}

function metric(
  activity: Activity,
  key: ActivityMetricKey,
): ActivityMetric | null {
  const label = metricLabels[key];
  const {
    distanceMeters,
    durationSeconds,
    elevationGainMeters,
    averageHeartRate,
  } = activity;
  switch (key) {
    case "distance":
      return distanceMeters
        ? { key, label, value: formatDistance(distanceMeters), unit: "km" }
        : null;
    case "duration":
      return durationSeconds
        ? { key, label, value: formatDuration(durationSeconds) }
        : null;
    case "pace":
      return distanceMeters &&
        distanceMeters >= 100 &&
        durationSeconds &&
        activityKind(activity.type) !== "other"
        ? {
            key,
            label,
            value: formatPace(distanceMeters, durationSeconds),
            unit: "/km",
          }
        : null;
    case "elevation":
      return elevationGainMeters
        ? { key, label, value: integer.format(elevationGainMeters), unit: "m" }
        : null;
    case "heartRate":
      return averageHeartRate
        ? { key, label, value: integer.format(averageHeartRate), unit: "bpm" }
        : null;
  }
}

function present(keys: ActivityMetricKey[], activity: Activity) {
  return keys
    .map((key) => metric(activity, key))
    .filter((item): item is ActivityMetric => item !== null);
}

export function listMetrics(activity: Activity) {
  const metrics = present(
    listMetricOrder[activityKind(activity.type)],
    activity,
  );
  return metrics.length > 0 ? metrics : present(["duration"], activity);
}

export function detailMetrics(activity: Activity) {
  return present(detailMetricOrder, activity);
}

function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / dayMs;
}

function mondayNumber(date: string) {
  const day = dayNumber(date);
  return day - ((new Date(day * dayMs).getUTCDay() + 6) % 7);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatActivityDate(date: string, today: string) {
  const value = new Date(`${date}T00:00:00Z`);
  return (
    date.slice(0, 4) === today.slice(0, 4) ? shortDay : shortDayYear
  ).format(value);
}

export function activityPeriod(date: string, today: string) {
  const weeks = (mondayNumber(today) - mondayNumber(date)) / 7;
  if (weeks <= 0) return "Cette semaine";
  if (weeks === 1) return "Semaine dernière";
  const value = new Date(`${date}T00:00:00Z`);
  return capitalize(
    (date.slice(0, 4) === today.slice(0, 4) ? monthName : monthYear).format(
      value,
    ),
  );
}

export function groupActivities(activities: Activity[], today: string) {
  const groups: ActivityGroup[] = [];
  for (const activity of activities) {
    const label = activityPeriod(activity.date, today);
    const last = groups.at(-1);
    if (last?.label === label) last.activities.push(activity);
    else groups.push({ label, activities: [activity] });
  }
  return groups;
}

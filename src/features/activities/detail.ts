import { z } from "zod";
import {
  activityKind,
  formatDistance,
  formatDuration,
  formatPace,
  positiveMeasure,
  type ActivityKind,
} from "./activities";

export const activityDetailColumns =
  "id, activity_type, activity_name, route_name, started_at, local_started_at, distance_meters, duration_seconds, elevation_gain_meters, elevation_loss_meters, average_heart_rate, max_heart_rate, average_cadence, average_power_watts, max_power_watts, aerobic_training_effect, anaerobic_training_effect, calories, workout_rpe, workout_feel, detail_imported_at";
export const segmentColumns =
  "segment_type, segment_index, started_at, distance_meters, duration_seconds, average_heart_rate, average_cadence, average_power_watts, elevation_gain_meters, elevation_loss_meters";

export const activityDetailRowSchema = z
  .object({
    id: z.string(),
    activity_type: z.string().nullable(),
    activity_name: z.string().nullable().optional(),
    route_name: z.string().nullable(),
    started_at: z.string(),
    local_started_at: z.string().nullable(),
    distance_meters: positiveMeasure,
    duration_seconds: positiveMeasure,
    elevation_gain_meters: positiveMeasure,
    elevation_loss_meters: positiveMeasure,
    average_heart_rate: positiveMeasure,
    max_heart_rate: positiveMeasure,
    average_cadence: positiveMeasure,
    average_power_watts: positiveMeasure,
    max_power_watts: positiveMeasure,
    aerobic_training_effect: positiveMeasure,
    anaerobic_training_effect: positiveMeasure,
    calories: positiveMeasure.optional().default(null),
    workout_rpe: positiveMeasure.optional().default(null),
    workout_feel: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .transform((value) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
          ? parsed
          : null;
      }),
    detail_imported_at: z.string().nullable(),
  })
  .transform((row) => {
    const local = row.local_started_at ?? row.started_at;
    return {
      id: row.id,
      type: row.activity_type,
      name: row.activity_name?.trim() || null,
      routeName: row.route_name?.trim() || null,
      date: local.slice(0, 10),
      localTime: row.local_started_at
        ? row.local_started_at.slice(11, 16)
        : null,
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
      elevationGainMeters: row.elevation_gain_meters,
      elevationLossMeters: row.elevation_loss_meters,
      averageHeartRate: row.average_heart_rate,
      maxHeartRate: row.max_heart_rate,
      averageCadence: row.average_cadence,
      averagePowerWatts: row.average_power_watts,
      maxPowerWatts: row.max_power_watts,
      aerobicTrainingEffect: row.aerobic_training_effect,
      anaerobicTrainingEffect: row.anaerobic_training_effect,
      calories: row.calories,
      perceivedEffort: row.workout_rpe,
      feel: row.workout_feel,
      detailImportedAt: row.detail_imported_at,
    };
  });

export const segmentRowSchema = z
  .object({
    segment_type: z.enum(["lap", "split"]),
    segment_index: z.number().int(),
    distance_meters: positiveMeasure,
    duration_seconds: positiveMeasure,
    average_heart_rate: positiveMeasure,
    average_cadence: positiveMeasure,
    average_power_watts: positiveMeasure,
    elevation_gain_meters: positiveMeasure,
    elevation_loss_meters: positiveMeasure,
  })
  .transform((row) => ({
    type: row.segment_type,
    index: row.segment_index,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    averageHeartRate: row.average_heart_rate,
    averageCadence: row.average_cadence,
    averagePowerWatts: row.average_power_watts,
    elevationGainMeters: row.elevation_gain_meters,
  }));

export type ActivityDetailData = z.output<typeof activityDetailRowSchema>;
export type ActivitySegment = z.output<typeof segmentRowSchema>;
export type DetailStat = {
  key: string;
  label: string;
  value: string;
  unit?: string;
};
export type LapColumnKey =
  "duration" | "distance" | "pace" | "heartRate" | "cadence" | "elevation";
export type LapColumn = { key: LapColumnKey; label: string; compact: boolean };
export type LapRow = {
  key: string;
  label: string;
  cells: Record<LapColumnKey, string | null>;
};
export type LapTable = {
  title: string;
  columns: LapColumn[];
  rows: LapRow[];
};

export const minimumTableSegments = 2;

const effect = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const columnDefinitions: Record<LapColumnKey, LapColumn> = {
  duration: { key: "duration", label: "Temps", compact: true },
  distance: { key: "distance", label: "Dist.", compact: true },
  pace: { key: "pace", label: "Allure", compact: true },
  heartRate: { key: "heartRate", label: "FC moy.", compact: true },
  cadence: { key: "cadence", label: "Cad.", compact: false },
  elevation: { key: "elevation", label: "D+", compact: false },
};
const columnOrder: LapColumnKey[] = [
  "duration",
  "distance",
  "pace",
  "heartRate",
  "cadence",
  "elevation",
];

function paceOf(
  kind: ActivityKind,
  distanceMeters: number | null,
  durationSeconds: number | null,
) {
  return kind !== "other" &&
    distanceMeters !== null &&
    distanceMeters >= 100 &&
    durationSeconds !== null
    ? formatPace(distanceMeters, durationSeconds)
    : null;
}

function cell(segment: ActivitySegment, kind: ActivityKind) {
  const {
    durationSeconds,
    distanceMeters,
    averageHeartRate,
    averageCadence,
    elevationGainMeters,
  } = segment;
  return {
    duration: durationSeconds !== null ? formatDuration(durationSeconds) : null,
    distance: distanceMeters !== null ? formatDistance(distanceMeters) : null,
    pace: paceOf(kind, distanceMeters, durationSeconds),
    heartRate:
      averageHeartRate !== null ? integer.format(averageHeartRate) : null,
    cadence: averageCadence !== null ? integer.format(averageCadence) : null,
    elevation:
      elevationGainMeters !== null ? integer.format(elevationGainMeters) : null,
  } satisfies Record<LapColumnKey, string | null>;
}

export function lapTable(
  activity: ActivityDetailData,
  segments: ActivitySegment[],
): LapTable | null {
  const laps = segments.filter((segment) => segment.type === "lap");
  const chosen =
    laps.length >= minimumTableSegments
      ? laps
      : segments.filter((segment) => segment.type === "split");
  if (chosen.length < minimumTableSegments) return null;
  const kind = activityKind(activity.type);
  const ordered = [...chosen].sort((a, b) => a.index - b.index);
  const rows = ordered.map((segment, position) => ({
    key: `${segment.type}-${segment.index}`,
    label: String(position + 1),
    cells: cell(segment, kind),
  }));
  const columns = columnOrder
    .filter((key) => rows.some((row) => row.cells[key] !== null))
    .map((key) => columnDefinitions[key]);
  if (columns.length === 0) return null;
  return {
    title: chosen === laps ? "Tours" : "Segments",
    columns,
    rows,
  };
}

export function effortStats(activity: ActivityDetailData): DetailStat[] {
  const stats: (DetailStat | null)[] = [
    activity.calories !== null
      ? {
          key: "calories",
          label: "Energy",
          value: integer.format(activity.calories),
          unit: "kcal",
        }
      : null,
    activity.perceivedEffort !== null && activity.perceivedEffort <= 10
      ? {
          key: "perceivedEffort",
          label: "Perceived effort",
          value: effect.format(activity.perceivedEffort),
          unit: "/10",
        }
      : null,
    activity.feel !== null
      ? {
          key: "feel",
          label: "Workout feel",
          value: integer.format(activity.feel),
          unit: "/100",
        }
      : null,
    activity.aerobicTrainingEffect !== null
      ? {
          key: "aerobic",
          label: "Effet aérobie",
          value: effect.format(activity.aerobicTrainingEffect),
        }
      : null,
    activity.anaerobicTrainingEffect !== null
      ? {
          key: "anaerobic",
          label: "Effet anaérobie",
          value: effect.format(activity.anaerobicTrainingEffect),
        }
      : null,
    activity.averageCadence !== null
      ? {
          key: "cadence",
          label: "Cadence moy.",
          value: integer.format(activity.averageCadence),
          unit: "spm",
        }
      : null,
    activity.maxHeartRate !== null
      ? {
          key: "maxHeartRate",
          label: "FC max",
          value: integer.format(activity.maxHeartRate),
          unit: "bpm",
        }
      : null,
    activity.averagePowerWatts !== null
      ? {
          key: "power",
          label: "Puissance moy.",
          value: integer.format(activity.averagePowerWatts),
          unit: "W",
        }
      : null,
    activity.maxPowerWatts !== null
      ? {
          key: "maxPower",
          label: "Puissance max",
          value: integer.format(activity.maxPowerWatts),
          unit: "W",
        }
      : null,
    activity.elevationLossMeters !== null
      ? {
          key: "elevationLoss",
          label: "D−",
          value: integer.format(activity.elevationLossMeters),
          unit: "m",
        }
      : null,
  ];
  return stats.filter((stat): stat is DetailStat => stat !== null);
}

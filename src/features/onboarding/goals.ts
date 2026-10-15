import { z } from "zod";

export const goalFocuses = [
  "general_fitness",
  "faster",
  "short_distance",
  "half_marathon_marathon",
  "trail",
  "ultra_trail",
] as const;
export type GoalFocus = (typeof goalFocuses)[number];
export const racePriorities = ["A", "B", "C"] as const;
export type RacePriority = (typeof racePriorities)[number];
export const raceKinds = ["road", "trail"] as const;
export type RaceKind = (typeof raceKinds)[number];
export const roadDistancePresets = [5, 10, 21.1, 42.2] as const;
export const maxRaces = 10;
export const maxTargetSeconds = 1_209_599;

export type GoalValues = { focus: GoalFocus | null };
export type RaceValues = {
  race_kind: RaceKind;
  name: string | null;
  race_date: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  priority: RacePriority;
  target_duration_seconds: number | null;
};
export type RowSnapshot<V> = { values: V; revision: number | null };
export type RaceSnapshot = RowSnapshot<RaceValues> & {
  id: string;
  updatedAt: string;
};
export type GoalsSnapshot = {
  goal: RowSnapshot<GoalValues> & { updatedAt: string | null };
  races: RaceSnapshot[];
};
export type RowSaveResult<V> =
  | { status: "saved"; snapshot: RowSnapshot<V> }
  | { status: "conflict"; snapshot: RowSnapshot<V> }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "error" }
  | { status: "session-expired" };

export const goalSaveSchema = z.strictObject({
  values: z.strictObject({ focus: z.enum(goalFocuses).nullable().optional() }),
  revision: z.number().int().positive().nullable(),
});

export const raceValueSchemas = {
  race_kind: z.enum(raceKinds),
  name: z.string().trim().min(1).max(120),
  race_date: z.iso.date(),
  distance_km: z.number().gt(0).max(1000).multipleOf(0.01),
  elevation_gain_m: z.number().int().min(0).max(30_000),
  priority: z.enum(racePriorities),
  target_duration_seconds: z.number().int().min(1).max(maxTargetSeconds),
};

export const raceSaveSchema = z.strictObject({
  id: z.uuid(),
  values: z.strictObject({
    race_kind: raceValueSchemas.race_kind.optional(),
    name: raceValueSchemas.name.nullable().optional(),
    race_date: raceValueSchemas.race_date.nullable().optional(),
    distance_km: raceValueSchemas.distance_km.nullable().optional(),
    elevation_gain_m: raceValueSchemas.elevation_gain_m.nullable().optional(),
    priority: raceValueSchemas.priority.optional(),
    target_duration_seconds: raceValueSchemas.target_duration_seconds
      .nullable()
      .optional(),
  }),
  revision: z.number().int().positive(),
});
export const raceIdsSchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(maxRaces),
});

const numeric = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)));
export const goalRowSchema = z.object({
  user_id: z.uuid(),
  focus: z.enum(goalFocuses),
  revision: z.number().int().positive(),
  updated_at: z.string(),
});
export const raceRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().nullable(),
  race_kind: z.enum(raceKinds),
  race_date: z.string().nullable(),
  distance_km: numeric,
  elevation_gain_m: z.number().nullable(),
  priority: z.enum(racePriorities),
  target_duration_seconds: z.number().nullable(),
  revision: z.number().int().positive(),
  updated_at: z.string(),
});

export function raceSnapshot(
  row: z.output<typeof raceRowSchema>,
): RaceSnapshot {
  return {
    id: row.id,
    revision: row.revision,
    updatedAt: row.updated_at,
    values: {
      race_kind: row.race_kind,
      name: row.name,
      race_date: row.race_date,
      distance_km: row.distance_km,
      elevation_gain_m: row.elevation_gain_m,
      priority: row.priority,
      target_duration_seconds: row.target_duration_seconds,
    },
  };
}

export type RaceCourseValues = {
  distanceM: number;
  elevationGainM: number | null;
};

export function withRaceCourse<
  T extends Pick<RaceValues, "distance_km" | "elevation_gain_m">,
>(values: T, course: RaceCourseValues | null | undefined): T {
  if (!course) return values;
  return {
    ...values,
    distance_km: Math.round(course.distanceM / 10) / 100,
    elevation_gain_m: course.elevationGainM ?? values.elevation_gain_m,
  };
}

export function resolveRaceSnapshots<
  T extends { id: string; values: RaceValues },
>(races: T[], courses: ReadonlyMap<string, RaceCourseValues>): T[] {
  return races.map((race) => ({
    ...race,
    values: withRaceCourse(race.values, courses.get(race.id)),
  }));
}

export const requiredRaceFields = ["name", "race_date", "distance_km"] as const;
export type RequiredRaceField = (typeof requiredRaceFields)[number];

export function missingRaceFields(race: RaceValues): RequiredRaceField[] {
  return requiredRaceFields.filter((field) => {
    const value = race[field];
    return value === null || value === "";
  });
}

export function parseDuration(input: string): number | null | undefined {
  const text = input.trim().replace(/h/i, ":");
  if (text === "") return null;
  const match = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(text);
  if (!match) return undefined;
  const seconds =
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
  return seconds >= 1 && seconds <= maxTargetSeconds ? seconds : undefined;
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const base = `${hours}:${String(minutes).padStart(2, "0")}`;
  return rest ? `${base}:${String(rest).padStart(2, "0")}` : base;
}

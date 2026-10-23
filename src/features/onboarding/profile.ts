import { z } from "zod";

export const profileFields = [
  "first_name",
  "birth_date",
  "sex",
  "height_cm",
  "weight_kg",
  "primary_terrain",
  "available_weekdays",
  "long_run_day",
  "weekday_session_minutes",
  "training_access",
] as const;
export type ProfileField = (typeof profileFields)[number];
export const requiredProfileFields: ProfileField[] = profileFields.filter(
  (field) => field !== "training_access",
);
export const cachedProfileFields: ProfileField[] = [
  "primary_terrain",
  "available_weekdays",
  "long_run_day",
  "weekday_session_minutes",
  "training_access",
];
export const trainingAccess = [
  "hills",
  "incline_treadmill",
  "gym",
  "track",
] as const;

const sortedUnique = <T extends string | number>(values: T[]) =>
  [...new Set(values)].sort();

export const profileValueSchemas = {
  first_name: z.string().trim().min(1).max(80),
  birth_date: z.iso.date().refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1900 && value <= new Date().toISOString().slice(0, 10);
  }),
  sex: z.enum(["female", "male", "unspecified"]),
  height_cm: z.number().min(100).max(250).multipleOf(0.1),
  weight_kg: z.number().min(25).max(250).multipleOf(0.1),
  primary_terrain: z.enum(["road", "trail", "mixed"]),
  available_weekdays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .transform((days) => sortedUnique(days).map(Number)),
  long_run_day: z.enum(["saturday", "sunday", "flexible"]),
  weekday_session_minutes: z.union([
    z.literal(45),
    z.literal(60),
    z.literal(75),
    z.literal(90),
  ]),
  training_access: z
    .array(z.enum(trainingAccess))
    .max(4)
    .transform((values) => sortedUnique(values)),
};

export const valueSourceSchema = z.discriminatedUnion("source", [
  z.strictObject({ source: z.literal("athlete") }),
  z.strictObject({ source: z.literal("garmin"), observed_on: z.iso.date() }),
]);
export type ValueSource = z.output<typeof valueSourceSchema>;
export const valueSourcesSchema = z.partialRecord(
  z.enum(profileFields),
  valueSourceSchema,
);

export const profilePatchSchema = z.strictObject(
  Object.fromEntries(
    profileFields.map((field) => [
      field,
      profileValueSchemas[field].nullable().optional(),
    ]),
  ) as {
    [K in ProfileField]: z.ZodOptional<
      z.ZodNullable<(typeof profileValueSchemas)[K]>
    >;
  },
);
export type ProfilePatch = z.output<typeof profilePatchSchema>;

export const profileSaveSchema = z.strictObject({
  values: profilePatchSchema,
  sources: valueSourcesSchema,
  revision: z.number().int().positive().nullable(),
});

const numeric = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)));
export const profileColumns =
  "user_id, first_name, birth_date, sex, height_cm, weight_kg, primary_terrain, available_weekdays, long_run_day, weekday_session_minutes, training_access, value_sources, revision, updated_at";
export const profileRowSchema = z.object({
  user_id: z.uuid(),
  first_name: z.string().nullable(),
  birth_date: z.string().nullable(),
  sex: z.enum(["female", "male", "unspecified"]).nullable(),
  height_cm: numeric,
  weight_kg: numeric,
  primary_terrain: z.enum(["road", "trail", "mixed"]).nullable(),
  available_weekdays: z.array(z.number()).nullable(),
  long_run_day: z.enum(["saturday", "sunday", "flexible"]).nullable(),
  weekday_session_minutes: z.number().nullable(),
  training_access: z.array(z.enum(trainingAccess)).nullable(),
  value_sources: z.record(z.string(), z.unknown()),
  revision: z.number().int().positive(),
  updated_at: z.string(),
});
export type ProfileRow = z.output<typeof profileRowSchema>;

export type ProfileValues = {
  first_name: string | null;
  birth_date: string | null;
  sex: "female" | "male" | "unspecified" | null;
  height_cm: number | null;
  weight_kg: number | null;
  primary_terrain: "road" | "trail" | "mixed" | null;
  available_weekdays: number[] | null;
  long_run_day: "saturday" | "sunday" | "flexible" | null;
  weekday_session_minutes: number | null;
  training_access: string[] | null;
  value_sources: Partial<Record<ProfileField, ValueSource>>;
};

export const emptyProfile: ProfileValues = {
  first_name: null,
  birth_date: null,
  sex: null,
  height_cm: null,
  weight_kg: null,
  primary_terrain: null,
  available_weekdays: null,
  long_run_day: null,
  weekday_session_minutes: null,
  training_access: null,
  value_sources: {},
};

export function profileValues(row: ProfileRow | null): ProfileValues {
  if (!row) return emptyProfile;
  const sources = valueSourcesSchema.safeParse(row.value_sources);
  return {
    first_name: row.first_name,
    birth_date: row.birth_date,
    sex: row.sex,
    height_cm: row.height_cm,
    weight_kg: row.weight_kg,
    primary_terrain: row.primary_terrain,
    available_weekdays: row.available_weekdays,
    long_run_day: row.long_run_day,
    weekday_session_minutes: row.weekday_session_minutes,
    training_access: row.training_access,
    value_sources: sources.success ? sources.data : {},
  };
}

export function isAnswered(values: ProfileValues, field: ProfileField) {
  const value = values[field];
  return Array.isArray(value)
    ? value.length > 0
    : value !== null && value !== "";
}

export function missingRequiredFields(values: ProfileValues) {
  return requiredProfileFields.filter((field) => !isAnswered(values, field));
}

export function answeredCount(values: ProfileValues) {
  return profileFields.filter((field) => isAnswered(values, field)).length;
}

export type ProfileSnapshot = {
  values: ProfileValues;
  revision: number | null;
};
export type ProfileSaveResult =
  | { status: "saved"; snapshot: ProfileSnapshot }
  | { status: "conflict"; snapshot: ProfileSnapshot }
  | { status: "invalid" }
  | { status: "error" }
  | { status: "session-expired" };

import { z } from "zod";
import {
  garminConnectionStatuses,
  garminErrorCodes,
  type GarminAuthOutcome,
  type GarminConnection,
  type GarminFailure,
} from "@/features/garmin/connection";
import { sleepStages, type WellnessDay } from "@/features/garmin/wellness";
import {
  watchRowStatuses,
  type WatchReconcileResult,
} from "@/features/garmin/watch";
import {
  garminJobPhases,
  garminJobStates,
  garminSyncStates,
  type GarminJobPhase,
  type GarminJobStatus,
  type GarminSyncCategoryStatus,
  type GarminSyncStatus,
} from "@/features/garmin/sync";

const timestamp = z.iso.datetime({ offset: true }).nullable().optional();

export const connectionSchema = z
  .object({
    status: z.enum(garminConnectionStatuses),
    connected_at: timestamp,
    last_sync_at: timestamp,
  })
  .transform((value): GarminConnection => ({
    status: value.status,
    connectedAt: value.connected_at ?? null,
    lastSyncAt: value.last_sync_at ?? null,
  }));

export const authOutcomeSchema = z
  .discriminatedUnion("status", [
    z.object({ status: z.literal("connected") }),
    z.object({
      status: z.literal("mfa_required"),
      challenge_id: z.uuid(),
    }),
  ])
  .transform((value): GarminAuthOutcome =>
    value.status === "connected"
      ? { status: "connected" }
      : { status: "mfa_required", challengeId: value.challenge_id },
  );

const categorySchema = z
  .object({
    state: z.enum(garminSyncStates),
    oldest_synchronized_date: z.iso.date().nullable().optional(),
    last_success_at: timestamp,
    last_error_code: z.string().nullable().optional(),
    activity_count: z.number().int().nonnegative().nullable().optional(),
  })
  .transform((value): GarminSyncCategoryStatus => ({
    state: value.state,
    oldestSynchronizedDate: value.oldest_synchronized_date ?? null,
    lastSuccessAt: value.last_success_at ?? null,
    lastErrorCode: value.last_error_code ?? null,
    activityCount: value.activity_count ?? null,
  }));

const jobSchema = z
  .object({
    state: z.enum(garminJobStates),
    phase: z.enum(garminJobPhases),
    updated_at: timestamp,
  })
  .transform((value): GarminJobStatus => ({
    state: value.state,
    updatedAt: value.updated_at ?? null,
  }));

const phasesSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .transform((value) => {
    const phases: Partial<Record<GarminJobPhase, GarminJobStatus>> = {};
    for (const phase of garminJobPhases) {
      const parsed = jobSchema.safeParse(value?.[phase]);
      if (parsed.success) phases[phase] = parsed.data;
    }
    return phases;
  });

export const syncSchema = z
  .object({
    state: z.literal("not_started").optional(),
    connection_id: z.uuid().optional(),
    categories: z.object({
      activities: categorySchema,
      recovery: categorySchema,
      fitness: categorySchema,
      patterns: categorySchema,
    }),
    last_sync_at: timestamp,
    updated_at: timestamp,
    incremental_phases: phasesSchema,
    manual_sync_available_at: timestamp,
  })
  .refine((value) => value.state === "not_started" || value.connection_id, {
    message: "A started sync must identify its connection",
  })
  .transform((value): GarminSyncStatus => ({
    started: value.state !== "not_started",
    categories: value.categories,
    lastSyncAt: value.last_sync_at ?? null,
    updatedAt: value.updated_at ?? null,
    phases: value.incremental_phases,
    manualSyncAvailableAt: value.manual_sync_available_at ?? null,
  }));

export const syncRequestSchema = z
  .object({ request: z.enum(["queued", "already_running"]) })
  .and(syncSchema);

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    retry_after_seconds: z.number().int().positive().optional(),
    attempts_remaining: z.number().int().nonnegative().optional(),
    challenge_consumed: z.boolean().optional(),
  }),
});

const knownCodes = new Set<string>(garminErrorCodes);

function codeForStatus(status: number): GarminFailure["code"] {
  if (status === 401) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "service_unavailable";
  return "unknown";
}

const measure = z.number().finite().nullable().catch(null);
const series = z
  .array(z.tuple([z.number().int(), measure]))
  .max(2000)
  .catch([]);

export const wellnessDaySchema = z
  .object({
    date: z.iso.date(),
    sleep: z
      .object({
        start: z.number().int(),
        end: z.number().int(),
        stages: z
          .array(
            z.object({
              start: z.number().int(),
              end: z.number().int(),
              stage: z.enum(sleepStages),
            }),
          )
          .max(500)
          .catch([]),
        deep_seconds: measure,
        light_seconds: measure,
        rem_seconds: measure,
        awake_seconds: measure,
        awake_count: measure,
        score: measure,
        respiration_average: measure,
        spo2_average: measure,
        spo2_lowest: measure,
        hrv_average: measure,
      })
      .nullable()
      .catch(null),
    heart_rate: series,
    stress: series,
    body_battery: series,
    steps: series,
    summary: z.object({
      resting_heart_rate: measure,
      steps_total: measure,
      steps_goal: measure,
      stress_average: measure,
      stress_max: measure,
      body_battery_wake: measure,
      body_battery_charged: measure,
      body_battery_drained: measure,
      body_battery_highest: measure,
      body_battery_lowest: measure,
      body_battery_latest: measure,
    }),
  })
  .transform((day): WellnessDay => ({
    date: day.date,
    sleep: day.sleep && {
      start: day.sleep.start,
      end: day.sleep.end,
      stages: day.sleep.stages,
      deepSeconds: day.sleep.deep_seconds,
      lightSeconds: day.sleep.light_seconds,
      remSeconds: day.sleep.rem_seconds,
      awakeSeconds: day.sleep.awake_seconds,
      awakeCount: day.sleep.awake_count,
      score: day.sleep.score,
      respirationAverage: day.sleep.respiration_average,
      spo2Average: day.sleep.spo2_average,
      spo2Lowest: day.sleep.spo2_lowest,
      hrvAverage: day.sleep.hrv_average,
    },
    heartRate: day.heart_rate,
    stress: day.stress,
    bodyBattery: day.body_battery,
    steps: day.steps,
    summary: {
      restingHeartRate: day.summary.resting_heart_rate,
      stepsTotal: day.summary.steps_total,
      stepsGoal: day.summary.steps_goal,
      stressAverage: day.summary.stress_average,
      stressMax: day.summary.stress_max,
      bodyBatteryWake: day.summary.body_battery_wake,
      bodyBatteryCharged: day.summary.body_battery_charged,
      bodyBatteryDrained: day.summary.body_battery_drained,
      bodyBatteryHighest: day.summary.body_battery_highest,
      bodyBatteryLowest: day.summary.body_battery_lowest,
      bodyBatteryLatest: day.summary.body_battery_latest,
    },
  }));

export function parseFailure(
  body: unknown,
  status: number,
  retryAfterHeader: string | null,
): GarminFailure {
  const parsed = errorSchema.safeParse(body);
  const { code, retry_after_seconds, attempts_remaining, challenge_consumed } =
    parsed.success ? parsed.data.error : { code: codeForStatus(status) };
  const headerSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  const retryAfterSeconds =
    retry_after_seconds ??
    (Number.isInteger(headerSeconds) && headerSeconds > 0
      ? headerSeconds
      : undefined);
  return {
    code: knownCodes.has(code) ? (code as GarminFailure["code"]) : "unknown",
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
    ...(attempts_remaining !== undefined && {
      attemptsRemaining: attempts_remaining,
    }),
    ...(challenge_consumed !== undefined && {
      challengeConsumed: challenge_consumed,
    }),
  };
}

export const watchReconcileSchema = z
  .object({
    workouts: z.array(
      z.object({
        key: z.string(),
        date: z.iso.date(),
        status: z.enum(watchRowStatuses),
        changed: z.boolean(),
        simplifications: z.array(z.string()),
        error_code: z.string().optional(),
      }),
    ),
    removed: z.array(z.string()),
  })
  .transform((value): WatchReconcileResult => ({
    workouts: value.workouts.map((workout) => ({
      key: workout.key,
      status: workout.status,
      errorCode: workout.error_code ?? null,
    })),
    removed: value.removed,
  }));

export const watchRemovalSchema = z.object({
  removed: z.number().int().nonnegative(),
});

export const gearRowSchema = z
  .object({
    gear_uuid: z.string().regex(/^[0-9a-f]{32}$/),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    display_name: z.string().nullable(),
    status: z.enum(["active", "retired"]),
    first_use_date: z.iso.date().nullable(),
    maximum_meters: z.number().nullable(),
    total_distance_meters: z.number(),
    total_activities: z.number().int(),
  })
  .transform((value) => ({
    gearUuid: value.gear_uuid,
    status: value.status,
    maximumMeters: value.maximum_meters,
    totalDistanceMeters: value.total_distance_meters,
  }));

export const gearResponseSchema = z.object({ gear: gearRowSchema });

export const activityGearResponseSchema = z
  .object({
    provider_activity_id: z.string(),
    gear_uuid: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .nullable(),
  })
  .transform((value) => ({
    providerActivityId: value.provider_activity_id,
    gearUuid: value.gear_uuid,
  }));

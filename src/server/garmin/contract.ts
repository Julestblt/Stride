import { z } from "zod";
import {
  garminConnectionStatuses,
  garminErrorCodes,
  type GarminAuthOutcome,
  type GarminConnection,
  type GarminFailure,
} from "@/features/garmin/connection";
import {
  garminSyncStates,
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
  })
  .refine((value) => value.state === "not_started" || value.connection_id, {
    message: "A started sync must identify its connection",
  })
  .transform((value): GarminSyncStatus => ({
    started: value.state !== "not_started",
    categories: value.categories,
    lastSyncAt: value.last_sync_at ?? null,
    updatedAt: value.updated_at ?? null,
  }));

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

import "server-only";
import type { z } from "zod";
import type {
  GarminAuthOutcome,
  GarminConnection,
  GarminResult,
} from "@/features/garmin/connection";
import type {
  GarminSyncRequest,
  GarminSyncStatus,
} from "@/features/garmin/sync";
import {
  authOutcomeSchema,
  connectionSchema,
  parseFailure,
  syncRequestSchema,
  syncSchema,
  watchReconcileSchema,
  watchRemovalSchema,
  wellnessDaySchema,
} from "./contract";
import type {
  WatchReconcileResult,
  WatchRequest,
} from "@/features/garmin/watch";
import type { WellnessDay } from "@/features/garmin/wellness";

export type GarminRequestContext = { accessToken: string };

type GarminClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  readTimeoutMs?: number;
  authTimeoutMs?: number;
  wellnessTimeoutMs?: number;
  workoutTimeoutMs?: number;
};

export type GarminClient = ReturnType<typeof createGarminClient>;

export function createGarminClient({
  baseUrl,
  fetch: send = fetch,
  readTimeoutMs = 10_000,
  authTimeoutMs = 60_000,
  wellnessTimeoutMs = 25_000,
  workoutTimeoutMs = 120_000,
}: GarminClientOptions) {
  async function request<Schema extends z.ZodType>(
    context: GarminRequestContext,
    path: string,
    schema: Schema,
    timeoutMs: number,
    body?: unknown,
    method: "GET" | "POST" | "PUT" | "DELETE" = body ? "POST" : "GET",
  ): Promise<GarminResult<z.output<Schema>>> {
    let response: Response;
    try {
      response = await send(new URL(path, baseUrl), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${context.accessToken}`,
          "X-Request-Id": crypto.randomUUID(),
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";
      return { ok: false, failure: { code: timedOut ? "timeout" : "network" } };
    }
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok)
      return {
        ok: false,
        failure: parseFailure(
          payload,
          response.status,
          response.headers.get("Retry-After"),
        ),
      };
    const parsed = schema.safeParse(payload);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, failure: { code: "malformed" } };
  }

  return {
    getConnection(
      context: GarminRequestContext,
    ): Promise<GarminResult<GarminConnection>> {
      return request(
        context,
        "/v1/connections/garmin",
        connectionSchema,
        readTimeoutMs,
      );
    },
    startConnection(
      context: GarminRequestContext,
      credentials: {
        email: string;
        password: string;
        historyStartDate?: string;
      },
    ): Promise<GarminResult<GarminAuthOutcome>> {
      return request(
        context,
        "/v1/connections/garmin/start",
        authOutcomeSchema,
        authTimeoutMs,
        {
          email: credentials.email,
          password: credentials.password,
          ...(credentials.historyStartDate && {
            history_start_date: credentials.historyStartDate,
          }),
        },
      );
    },
    continueMfa(
      context: GarminRequestContext,
      challenge: { challengeId: string; otp: string },
    ): Promise<GarminResult<GarminAuthOutcome>> {
      return request(
        context,
        "/v1/connections/garmin/mfa",
        authOutcomeSchema,
        authTimeoutMs,
        { challenge_id: challenge.challengeId, otp: challenge.otp },
      );
    },
    getSync(
      context: GarminRequestContext,
    ): Promise<GarminResult<GarminSyncStatus>> {
      return request(
        context,
        "/v1/connections/garmin/sync",
        syncSchema,
        readTimeoutMs,
      );
    },
    requestSync(
      context: GarminRequestContext,
    ): Promise<GarminResult<GarminSyncRequest>> {
      return request(
        context,
        "/v1/connections/garmin/sync",
        syncRequestSchema,
        readTimeoutMs,
        {},
      );
    },
    getWellnessDay(
      context: GarminRequestContext,
      date: string,
    ): Promise<GarminResult<WellnessDay>> {
      return request(
        context,
        `/v1/wellness/days/${encodeURIComponent(date)}`,
        wellnessDaySchema,
        wellnessTimeoutMs,
      );
    },
    reconcileWorkouts(
      context: GarminRequestContext,
      body: WatchRequest,
    ): Promise<GarminResult<WatchReconcileResult>> {
      return request(
        context,
        "/v1/connections/garmin/workouts",
        watchReconcileSchema,
        workoutTimeoutMs,
        body,
        "PUT",
      );
    },
    removeWorkouts(
      context: GarminRequestContext,
    ): Promise<GarminResult<{ removed: number }>> {
      return request(
        context,
        "/v1/connections/garmin/workouts",
        watchRemovalSchema,
        workoutTimeoutMs,
        undefined,
        "DELETE",
      );
    },
  };
}

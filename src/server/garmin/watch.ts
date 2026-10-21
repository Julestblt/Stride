import "server-only";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  buildWatchRequest,
  watchRowStatuses,
  watchSyncKey,
  type WatchIntent,
  type WatchRow,
} from "@/features/garmin/watch";
import { addDays } from "@/features/plans/model/dates";
import { localToday } from "@/features/plans/constraints";
import { getPublicEnvironment } from "@/lib/env";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readActivePlan, type StoredPlan } from "@/server/plans/stored";
import type { Database } from "@/server/supabase/database.types";
import { getGarminClient } from "./session";

export type WatchContext = Pick<
  OnboardingContext,
  "client" | "userId" | "accessToken"
>;

export type WatchSetting = {
  enabled: boolean;
  syncedKey: string | null;
  syncedAt: string | null;
};

export type WatchSyncOutcome =
  | { status: "synced" | "disabled" }
  | { status: "reconnect" | "session-expired" | "unavailable" };

const retryAfterMs = 10 * 60_000;
const failedRetryAfterMs = 60 * 60_000;

const rowSchema = z.object({
  external_key: z.string(),
  scheduled_on: z.iso.date(),
  status: z.enum(watchRowStatuses),
  error_code: z.string().nullable(),
  simplifications: z.array(z.string()),
  sent_at: z.string().nullable(),
});

export async function readWatchSetting(
  context: Pick<WatchContext, "client" | "userId">,
): Promise<WatchSetting> {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .select(
      "watch_workouts_enabled, watch_workouts_synced_key, watch_workouts_synced_at",
    )
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read the watch setting");
  return {
    enabled: data?.watch_workouts_enabled ?? false,
    syncedKey: data?.watch_workouts_synced_key ?? null,
    syncedAt: data?.watch_workouts_synced_at ?? null,
  };
}

export async function readWatchRows(
  context: Pick<WatchContext, "client" | "userId">,
  from: string,
): Promise<WatchRow[]> {
  const { data, error } = await context.client
    .from("provider_workouts")
    .select(
      "external_key, scheduled_on, status, error_code, simplifications, sent_at",
    )
    .eq("user_id", context.userId)
    .gte("scheduled_on", from)
    .order("scheduled_on");
  if (error) throw new Error("Unable to read the watch workouts");
  return data.flatMap((row) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        key: parsed.data.external_key,
        scheduledOn: parsed.data.scheduled_on,
        status: parsed.data.status,
        errorCode: parsed.data.error_code,
        simplifications: parsed.data.simplifications,
        sentAt: parsed.data.sent_at,
      },
    ];
  });
}

async function recordSync(
  context: WatchContext,
  values: { key: string | null; at: string },
) {
  await context.client
    .from("athlete_profiles")
    .update({
      watch_workouts_synced_key: values.key,
      watch_workouts_synced_at: values.at,
    })
    .eq("user_id", context.userId);
}

async function claimSync(context: WatchContext, staleBefore: Date | null) {
  let query = context.client
    .from("athlete_profiles")
    .update({ watch_workouts_synced_at: new Date().toISOString() })
    .eq("user_id", context.userId);
  if (staleBefore)
    query = query.or(
      `watch_workouts_synced_at.is.null,watch_workouts_synced_at.lt.${staleBefore.toISOString()}`,
    );
  const { data, error } = await query.select("user_id");
  return !error && data.length > 0;
}

function failureOutcome(code: string): WatchSyncOutcome {
  if (code === "unauthorized") return { status: "session-expired" };
  if (code === "reconnect_required" || code === "disconnected")
    return { status: "reconnect" };
  return { status: "unavailable" };
}

export async function syncWatch(
  context: WatchContext,
  intent?: WatchIntent,
): Promise<WatchSyncOutcome> {
  const setting = await readWatchSetting(context);
  if (!setting.enabled) return { status: "disabled" };
  const plan = await readActivePlan(context);
  const today = localToday(plan?.state.plan.timeZone ?? "Europe/Paris");
  const body = plan
    ? buildWatchRequest({
        planId: plan.planId,
        sessions: plan.state.sessions,
        today,
        rows: await readWatchRows(context, today),
        intent,
      })
    : { from: today, to: addDays(today, 6), workouts: [] };
  const result = await getGarminClient()
    .reconcileWorkouts({ accessToken: context.accessToken }, body)
    .catch(() => null);
  const at = new Date().toISOString();
  if (!result?.ok) {
    await recordSync(context, { key: null, at });
    return result
      ? failureOutcome(result.failure.code)
      : { status: "unavailable" };
  }
  if (!(await readWatchSetting(context)).enabled) {
    await removeWatchWorkouts(context);
    return { status: "disabled" };
  }
  await recordSync(context, {
    key: plan ? watchSyncKey(plan.planId, plan.activeVersion, today) : null,
    at,
  });
  return { status: "synced" };
}

export async function removeWatchWorkouts(
  context: WatchContext,
): Promise<WatchSyncOutcome> {
  const result = await getGarminClient()
    .removeWorkouts({ accessToken: context.accessToken })
    .catch(() => null);
  if (!result) return { status: "unavailable" };
  if (!result.ok) return failureOutcome(result.failure.code);
  await recordSync(context, { key: null, at: new Date().toISOString() });
  return { status: "synced" };
}

export function watchNeedsSync({
  setting,
  plan,
  rows,
  now = new Date(),
}: {
  setting: WatchSetting;
  plan: Pick<StoredPlan, "planId" | "activeVersion"> & {
    timeZone: string;
  };
  rows: WatchRow[];
  now?: Date;
}) {
  if (!setting.enabled) return false;
  const age = setting.syncedAt
    ? now.getTime() - new Date(setting.syncedAt).getTime()
    : Infinity;
  const current = watchSyncKey(
    plan.planId,
    plan.activeVersion,
    localToday(plan.timeZone, now),
  );
  if (setting.syncedKey !== current) return age > retryAfterMs;
  return (
    rows.some((row) => row.status === "failed") && age > failedRetryAfterMs
  );
}

export function tokenContext(context: WatchContext): WatchContext {
  const environment = getPublicEnvironment();
  if (
    !environment.NEXT_PUBLIC_SUPABASE_URL ||
    !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("Supabase is not configured");
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${context.accessToken}` } },
    },
  );
  return { client, userId: context.userId, accessToken: context.accessToken };
}

export async function syncWatchAfterResponse(
  context: WatchContext,
  staleBefore: Date | null = null,
) {
  let detached: WatchContext;
  try {
    detached = tokenContext(context);
  } catch {
    return;
  }
  if (!(await claimSync(context, staleBefore).catch(() => false))) return;
  after(async () => {
    await syncWatch(detached).catch(() => undefined);
  });
}

export type WatchView = { enabled: boolean; rows: WatchRow[] };

export async function loadWatchView(
  context: WatchContext,
  plan: StoredPlan | null,
): Promise<WatchView> {
  const setting = await readWatchSetting(context).catch(() => null);
  if (!setting?.enabled || !plan)
    return { enabled: setting?.enabled ?? false, rows: [] };
  const now = new Date();
  const timeZone = plan.state.plan.timeZone;
  const rows = await readWatchRows(context, localToday(timeZone, now)).catch(
    () => [],
  );
  if (watchNeedsSync({ setting, plan: { ...plan, timeZone }, rows, now }))
    await syncWatchAfterResponse(
      context,
      new Date(now.getTime() - retryAfterMs),
    );
  return { enabled: true, rows };
}

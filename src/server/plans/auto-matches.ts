import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import {
  matchSessions,
  type MatchActivity,
  type MatchOverride,
} from "@/features/plans/matching/matching";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readSessionMatches, type SessionMatch } from "./matches";
import type { StoredPlan } from "./stored";

type PlanContext = Pick<OnboardingContext, "client" | "userId">;

export type MatchFreshness = {
  computedAt: string | null;
  version: number | null;
  activitiesThrough: string | null;
  latestChangeAt: string | null;
};

const maxActivities = 2000;
const dayMs = 86_400_000;

const markerSchema = z.object({
  matches_computed_at: z.string().nullable(),
  matches_version: z.number().int().nullable(),
  matches_activities_through: z.string().nullable(),
});

const changeSchema = z.object({
  updated_at: z.string().nullable().catch(null),
});

const measure = z.coerce.number().finite().nullable().catch(null);

const activitySchema = z
  .object({
    id: z.uuid(),
    activity_type: z.string().nullable(),
    started_at: z.string(),
    local_started_at: z.string().nullable(),
    duration_seconds: measure,
    distance_meters: measure,
    average_heart_rate: measure,
    updated_at: z.string().nullable().catch(null),
  })
  .transform((row) => ({
    updatedAt: row.updated_at,
    activity: {
      id: row.id,
      type: row.activity_type ?? "",
      startedAt: row.local_started_at ?? row.started_at,
      durationSeconds: row.duration_seconds,
      distanceMeters: row.distance_meters,
      averageHeartRate: row.average_heart_rate,
    } satisfies MatchActivity,
  }));

export function matchesAreStale(
  freshness: MatchFreshness,
  plan: { activeVersion: number; timeZone: string },
  now: Date,
) {
  if (!freshness.computedAt || freshness.version !== plan.activeVersion)
    return true;
  const computed = Date.parse(freshness.computedAt);
  if (Number.isNaN(computed)) return true;
  if (
    freshness.latestChangeAt &&
    (!freshness.activitiesThrough ||
      Date.parse(freshness.latestChangeAt) >
        Date.parse(freshness.activitiesThrough))
  )
    return true;
  return (
    localToday(plan.timeZone, new Date(computed)) <
    localToday(plan.timeZone, now)
  );
}

function windowStart(startsOn: string) {
  return new Date(Date.parse(`${startsOn}T00:00:00Z`) - dayMs).toISOString();
}

async function readFreshness(
  context: PlanContext,
  stored: StoredPlan,
): Promise<MatchFreshness> {
  const [marker, latest] = await Promise.all([
    context.client
      .from("training_plans")
      .select(
        "matches_computed_at, matches_version, matches_activities_through",
      )
      .eq("user_id", context.userId)
      .eq("id", stored.planId)
      .maybeSingle(),
    context.client
      .from("provider_activities")
      .select("updated_at")
      .eq("user_id", context.userId)
      .gte("started_at", windowStart(stored.state.plan.startsOn))
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (marker.error || latest.error)
    throw new Error("Unable to read the match freshness");
  const plan = markerSchema.parse(marker.data);
  return {
    computedAt: plan.matches_computed_at,
    version: plan.matches_version,
    activitiesThrough: plan.matches_activities_through,
    latestChangeAt: latest.data
      ? changeSchema.parse(latest.data).updated_at
      : null,
  };
}

async function readMatchActivities(
  context: PlanContext,
  stored: StoredPlan,
): Promise<{ activities: MatchActivity[]; through: string | null }> {
  const { data, error } = await context.client
    .from("provider_activities")
    .select(
      "id, activity_type, started_at, local_started_at, duration_seconds, distance_meters, average_heart_rate, updated_at",
    )
    .eq("user_id", context.userId)
    .gte("started_at", windowStart(stored.state.plan.startsOn))
    .not("started_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(maxActivities);
  if (error) throw new Error("Unable to read the activities to match");
  const rows = z.array(activitySchema).parse(data ?? []);
  const through = rows
    .flatMap((row) => (row.updatedAt ? [row.updatedAt] : []))
    .reduce<string | null>(
      (latest, value) =>
        latest === null || Date.parse(value) > Date.parse(latest)
          ? value
          : latest,
      null,
    );
  return {
    activities: rows.map((row) => row.activity),
    through,
  };
}

const overrideSchema = z
  .object({ session_key: z.string(), activity_id: z.uuid().nullable() })
  .transform((row): MatchOverride => ({
    sessionKey: row.session_key,
    activityId: row.activity_id,
  }));

async function readAthleteOverrides(
  context: PlanContext,
  planId: string,
): Promise<MatchOverride[]> {
  const { data, error } = await context.client
    .from("session_activity_matches")
    .select("session_key, activity_id")
    .eq("user_id", context.userId)
    .eq("plan_id", planId)
    .eq("method", "athlete");
  if (error) throw new Error("Unable to read the athlete matches");
  return z.array(overrideSchema).parse(data ?? []);
}

export async function refreshSessionMatches(
  context: PlanContext,
  stored: StoredPlan,
  now = new Date(),
): Promise<boolean> {
  if (stored.status !== "active") return false;
  const freshness = await readFreshness(context, stored);
  const plan = {
    activeVersion: stored.activeVersion,
    timeZone: stored.state.plan.timeZone,
  };
  if (!matchesAreStale(freshness, plan, now)) return false;
  const [{ activities, through }, overrides] = await Promise.all([
    readMatchActivities(context, stored),
    readAthleteOverrides(context, stored.planId),
  ]);
  const result = matchSessions({
    sessions: stored.state.sessions,
    activities,
    overrides,
    today: localToday(plan.timeZone, now),
  });
  const { error } = await context.client.rpc("refresh_session_matches", {
    p_plan_id: stored.planId,
    p_version: stored.activeVersion,
    p_matches: result.matches,
    p_algorithm_version: result.algorithmVersion,
    ...(through && { p_activities_through: through }),
  });
  if (error) throw new Error("Unable to record the session matches");
  return true;
}

export async function readFreshSessionMatches(
  context: PlanContext,
  stored: StoredPlan,
): Promise<SessionMatch[]> {
  await refreshSessionMatches(context, stored).catch(() => false);
  return readSessionMatches(context, stored.planId);
}

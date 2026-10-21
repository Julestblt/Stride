import "server-only";
import { after } from "next/server";
import { cache } from "react";
import { z } from "zod";
import {
  pairCheck,
  pairDecisions,
  type PairCheck,
  type PairDecision,
} from "@/features/gear/check";
import type { ShoeInput } from "@/features/gear/view";
import { getGarminClient } from "@/server/garmin/session";
import { tokenContext } from "@/server/garmin/watch";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview } from "@/server/plans/overview";
import { loadGear } from "./load";
import { loadPlanShoes } from "./planned";
import { readGarminGear } from "./shoes";

type GearContext = Pick<OnboardingContext, "client" | "userId">;

export type ActivityPairCheck = PairCheck & {
  activityId: string;
  providerActivityId: string;
  day: string;
  distanceM: number;
  sessionKey: string | null;
  sessionTitle: string | null;
  garminName: string | null;
};

export type PairChecks = {
  checks: Map<string, ActivityPairCheck>;
  shoes: ShoeInput[];
  today: string;
};

const recentDays = 14;

const activitySchema = z.object({
  id: z.uuid(),
  provider_activity_id: z.string().min(1).max(64),
  started_at: z.string(),
  local_started_at: z.string().nullable(),
  distance_meters: z.coerce.number().nullable(),
});

const linkSchema = z.object({
  provider_activity_id: z.string(),
  gear_uuid: z.string(),
});

const decisionSchema = z.object({
  provider_activity_id: z.string(),
  decision: z.enum(pairDecisions),
  shoe_id: z.uuid().nullable(),
});

function daysBefore(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

async function readActivities(context: GearContext, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await context.client
    .from("provider_activities")
    .select(
      "id, provider_activity_id, started_at, local_started_at, distance_meters",
    )
    .eq("user_id", context.userId)
    .in("id", ids);
  if (error) throw new Error("Unable to read activities");
  return data.flatMap((row) => {
    const parsed = activitySchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function readLinks(context: GearContext, providerIds: string[]) {
  const links = new Map<string, string>();
  if (providerIds.length === 0) return links;
  const { data, error } = await context.client
    .from("provider_activity_gear")
    .select("provider_activity_id, gear_uuid")
    .eq("user_id", context.userId)
    .in("provider_activity_id", providerIds);
  if (error) throw new Error("Unable to read activity pairs");
  for (const row of data) {
    const parsed = linkSchema.safeParse(row);
    if (parsed.success)
      links.set(parsed.data.provider_activity_id, parsed.data.gear_uuid);
  }
  return links;
}

async function readDecisions(context: GearContext, providerIds: string[]) {
  const decisions = new Map<
    string,
    { decision: PairDecision; shoeId: string | null }
  >();
  if (providerIds.length === 0) return decisions;
  const { data, error } = await context.client
    .from("activity_shoe_decisions")
    .select("provider_activity_id, decision, shoe_id")
    .eq("user_id", context.userId)
    .in("provider_activity_id", providerIds);
  if (error) throw new Error("Unable to read pair decisions");
  for (const row of data) {
    const parsed = decisionSchema.safeParse(row);
    if (parsed.success)
      decisions.set(parsed.data.provider_activity_id, {
        decision: parsed.data.decision,
        shoeId: parsed.data.shoe_id,
      });
  }
  return decisions;
}

async function buildChecks(
  context: OnboardingContext,
  extraActivityIds: string[],
): Promise<PairChecks | null> {
  const [overview, planned, gear] = await Promise.all([
    loadPlanOverview(context),
    loadPlanShoes(context),
    loadGear(context),
  ]);
  const today = overview?.today ?? gear.today;
  const from = daysBefore(today, recentDays).slice(0, 10);
  const sessions = new Map(
    (overview?.plan.state.sessions ?? []).map((session) => [
      session.sessionKey,
      session,
    ]),
  );
  const sessionOf = new Map(
    (overview?.matches ?? []).flatMap((match) =>
      match.activityId &&
      (sessions.get(match.sessionKey)?.scheduledOn ?? "") >= from
        ? [[match.activityId, match.sessionKey] as const]
        : [],
    ),
  );
  const ids = [...new Set([...sessionOf.keys(), ...extraActivityIds])];
  const activities = await readActivities(context, ids);
  const providerIds = activities.map((row) => row.provider_activity_id);
  const [links, decisions, garminGear] = await Promise.all([
    readLinks(context, providerIds),
    readDecisions(context, providerIds),
    readGarminGear(context).catch(() => []),
  ]);
  const pairs = gear.stored.map((shoe) => ({
    id: shoe.id,
    garminGearUuid: shoe.garminGearUuid,
    firstUseDate: shoe.firstUseDate,
  }));
  const garminNames = new Map(
    garminGear.map((row) => [
      row.gear_uuid,
      row.display_name ?? row.model ?? null,
    ]),
  );
  const checks = new Map<string, ActivityPairCheck>();
  for (const activity of activities) {
    const sessionKey = sessionOf.get(activity.id) ?? null;
    const garminGearUuid = links.get(activity.provider_activity_id) ?? null;
    const day = (activity.local_started_at ?? activity.started_at).slice(0, 10);
    const check = pairCheck({
      day,
      sessionKey,
      plannedPairId: sessionKey
        ? (planned?.results.get(sessionKey)?.chosen?.pairId ?? null)
        : null,
      garminGearUuid,
      decision: decisions.get(activity.provider_activity_id) ?? null,
      pairs,
    });
    checks.set(activity.id, {
      ...check,
      activityId: activity.id,
      providerActivityId: activity.provider_activity_id,
      day,
      distanceM: activity.distance_meters ?? 0,
      sessionKey,
      sessionTitle: sessionKey
        ? (sessions.get(sessionKey)?.title ?? null)
        : null,
      garminName: garminGearUuid
        ? (garminNames.get(garminGearUuid) ?? null)
        : null,
    });
  }
  return { checks, shoes: gear.shoes, today };
}

export const loadPairChecks = cache(
  async (
    context: OnboardingContext,
    activityId: string | null = null,
  ): Promise<PairChecks | null> => {
    try {
      const checks = await buildChecks(
        context,
        activityId && z.uuid().safeParse(activityId).success
          ? [activityId]
          : [],
      );
      if (checks) assignMissingPairsAfterResponse(context, checks);
      return checks;
    } catch {
      return null;
    }
  },
);

export async function recordDecision(
  context: GearContext,
  providerActivityId: string,
  decision: PairDecision,
  shoeId: string | null,
) {
  return context.client.from("activity_shoe_decisions").upsert(
    {
      user_id: context.userId,
      provider_activity_id: providerActivityId,
      decision,
      shoe_id: shoeId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider_activity_id" },
  );
}

async function assignPair(
  context: OnboardingContext,
  check: ActivityPairCheck,
) {
  if (!check.assign) return;
  const { error, count } = await context.client
    .from("activity_shoe_decisions")
    .upsert(
      {
        user_id: context.userId,
        provider_activity_id: check.providerActivityId,
        decision: "assigned",
        shoe_id: check.assign.pairId,
      },
      {
        onConflict: "user_id,provider_activity_id",
        ignoreDuplicates: true,
        count: "exact",
      },
    );
  if (error || count === 0) return;
  const result = await getGarminClient()
    .setActivityGear(
      { accessToken: context.accessToken },
      check.providerActivityId,
      check.assign.gearUuid,
    )
    .catch(() => null);
  if (!result?.ok)
    await recordDecision(
      context,
      check.providerActivityId,
      "unassignable",
      check.assign.pairId,
    );
}

export function assignMissingPairsAfterResponse(
  context: OnboardingContext,
  { checks }: PairChecks,
) {
  const pending = [...checks.values()].filter((check) => check.assign);
  if (pending.length === 0) return;
  let detached: OnboardingContext;
  try {
    detached = { ...context, ...tokenContext(context) };
  } catch {
    return;
  }
  after(async () => {
    for (const check of pending)
      await assignPair(detached, check).catch(() => undefined);
  });
}

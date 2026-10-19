import "server-only";
import { cache } from "react";
import {
  localToday,
  readinessBadge,
  shellAccount,
  shellAthlete,
  shellGoal,
  shellRaces,
  syncLabel,
} from "@/features/app-shell/shell";
import { profileRowSchema, profileValues } from "@/features/onboarding/profile";
import { buildProgram, programNavigation } from "@/features/plans/view/program";
import { loadPlanOverview, programInput } from "@/server/plans/overview";
import { staffFacesOf } from "@/features/coach/staff";
import { countCoachAttention } from "@/server/coaching/managed/store";
import { countPlanProposals } from "@/server/plans/proposals";
import { readDataActivity } from "./data-activity";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "./session";

async function readTodayReadiness(context: OnboardingContext, now: Date) {
  const { data, error } = await context.client
    .from("provider_observations")
    .select("value_numeric")
    .eq("user_id", context.userId)
    .eq("metric", "training_readiness")
    .eq("observed_on", localToday(now))
    .in("availability", ["available", "partial"])
    .limit(1);
  if (error || !data?.[0]) return null;
  const value = Number(data[0].value_numeric);
  return data[0].value_numeric !== null && Number.isFinite(value)
    ? value
    : null;
}

export async function loadShell(context: OnboardingContext, now: Date) {
  const [
    profile,
    goals,
    activity,
    plan,
    planHistoryCount,
    coachAttention,
    readiness,
  ] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle(),
    readGoals(context).catch(() => null),
    readDataActivity({ accessToken: context.accessToken }),
    loadPlanOverview(context).catch(() => null),
    countPlanProposals(context).catch(() => null),
    countCoachAttention(context).catch(() => null),
    readTodayReadiness(context, now).catch(() => null),
  ]);
  const parsed = profileRowSchema.safeParse(profile.data);
  const values = profileValues(parsed.success ? parsed.data : null);
  return {
    athlete: shellAthlete(profile.data?.first_name ?? null, context.email),
    account: shellAccount(
      values,
      goals ? goals.goal.values.focus === null : false,
      activity.ok ? activity.value.sync.lastSyncAt : null,
      now,
    ),
    goal: goals
      ? shellGoal(
          goals.races.map(({ values }) => ({
            name: values.name,
            priority: values.priority,
            raceDate: values.race_date,
          })),
          goals.goal.values.focus,
          localToday(now),
        )
      : null,
    races: goals
      ? shellRaces(
          goals.races.map(({ id, values }) => ({
            id,
            name: values.name ?? "Course sans nom",
            priority: values.priority,
            date: values.race_date,
          })),
          localToday(now),
        )
      : [],
    sync: syncLabel(activity.ok ? activity.value.sync.lastSyncAt : null, now),
    initialActivity: activity.ok ? activity.value : null,
    planNav: plan ? programNavigation(buildProgram(programInput(plan))) : null,
    planHistoryCount,
    coachAttention,
    todayBadge: readinessBadge(readiness),
    staffFaces: staffFacesOf(profile.data),
  };
}

export const getShell = cache(async () =>
  loadShell(await requireAthlete(), new Date()),
);

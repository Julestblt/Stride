import "server-only";
import { cache } from "react";
import {
  localToday,
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

export async function loadShell(context: OnboardingContext, now: Date) {
  const [profile, goals, activity, plan, planHistoryCount, coachAttention] =
    await Promise.all([
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
    staffFaces: staffFacesOf(profile.data),
  };
}

export const getShell = cache(async () =>
  loadShell(await requireAthlete(), new Date()),
);

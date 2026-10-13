import "server-only";
import { cache } from "react";
import {
  localToday,
  shellAthlete,
  shellGoal,
  shellRaces,
  syncLabel,
} from "@/features/app-shell/shell";
import { readDataActivity } from "./data-activity";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "./session";

export async function loadShell(context: OnboardingContext, now: Date) {
  const [profile, goals, activity] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("first_name")
      .eq("user_id", context.userId)
      .maybeSingle(),
    readGoals(context).catch(() => null),
    readDataActivity({ accessToken: context.accessToken }),
  ]);
  return {
    athlete: shellAthlete(profile.data?.first_name ?? null, context.email),
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
  };
}

export const getShell = cache(async () =>
  loadShell(await requireAthlete(), new Date()),
);

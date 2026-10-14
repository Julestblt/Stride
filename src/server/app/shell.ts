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
import { readDataActivity } from "./data-activity";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "./session";

export async function loadShell(context: OnboardingContext, now: Date) {
  const [profile, goals, activity] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle(),
    readGoals(context).catch(() => null),
    readDataActivity({ accessToken: context.accessToken }),
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
  };
}

export const getShell = cache(async () =>
  loadShell(await requireAthlete(), new Date()),
);

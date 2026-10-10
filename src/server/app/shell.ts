import "server-only";
import { cache } from "react";
import {
  localToday,
  shellAthlete,
  shellGoal,
  syncLabel,
} from "@/features/app-shell/shell";
import { getGarminClient } from "@/server/garmin/session";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "./session";

async function readLastSync(context: OnboardingContext) {
  try {
    const result = await getGarminClient().getSync({
      accessToken: context.accessToken,
    });
    return result.ok ? result.value.lastSyncAt : null;
  } catch {
    return null;
  }
}

export async function loadShell(context: OnboardingContext, now: Date) {
  const [profile, goals, lastSyncAt] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("first_name")
      .eq("user_id", context.userId)
      .maybeSingle(),
    readGoals(context).catch(() => null),
    readLastSync(context),
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
    sync: syncLabel(lastSyncAt, now),
  };
}

export const getShell = cache(async () =>
  loadShell(await requireAthlete(), new Date()),
);

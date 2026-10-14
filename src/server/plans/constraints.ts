import "server-only";
import {
  toPlanningConstraints,
  type PlanningConstraints,
} from "@/features/plans/constraints";
import type { OnboardingContext } from "@/server/onboarding/context";

export type PlanningSettings = PlanningConstraints & {
  profileRevision: number | null;
};

export async function readPlanningConstraints(
  context: Pick<OnboardingContext, "client" | "userId">,
): Promise<PlanningSettings> {
  const [profile, periods] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("time_zone, max_weekly_minutes, revision")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.client
      .from("athlete_unavailability")
      .select("id, starts_on, ends_on, kind, reason, revision")
      .eq("user_id", context.userId)
      .order("starts_on"),
  ]);
  if (profile.error || periods.error)
    throw new Error("Unable to read planning constraints");
  return {
    ...toPlanningConstraints(profile.data, periods.data ?? []),
    profileRevision: profile.data?.revision ?? null,
  };
}

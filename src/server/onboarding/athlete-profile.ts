import "server-only";
import {
  buildAthleteProfile,
  type AthleteProfileView,
} from "@/features/onboarding/athlete-profile";
import { resolveRaceSnapshots } from "@/features/onboarding/goals";
import { readRaceCourses } from "@/server/races/courses";
import type { OnboardingContext } from "./context";
import { readGoals } from "./goals";
import { loadGarminSignals } from "./known-values";
import { readProfile } from "./profile";

const recoveryMetrics = [
  "hrv_last_night_ms",
  "resting_heart_rate_bpm",
  "sleep_duration_seconds",
];

export async function loadAthleteProfile(
  context: OnboardingContext,
  today: Date,
): Promise<AthleteProfileView> {
  const nights = new Date(today.getTime() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [profile, goals, courses, signals, count, first, observations] =
    await Promise.all([
      readProfile(context),
      readGoals(context),
      readRaceCourses(context),
      loadGarminSignals(context, today),
      context.client
        .from("provider_activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      context.client
        .from("provider_activities")
        .select("started_at")
        .eq("user_id", context.userId)
        .order("started_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      context.client
        .from("provider_observations")
        .select("metric, observed_on, value_numeric")
        .eq("user_id", context.userId)
        .eq("availability", "available")
        .in("metric", recoveryMetrics)
        .gte("observed_on", nights)
        .limit(1000),
    ]);
  if (count.error || first.error || observations.error)
    throw new Error("Unable to read athlete history");
  return buildAthleteProfile({
    today,
    profile: profile.values,
    goal: goals.goal.values,
    races: resolveRaceSnapshots(goals.races, courses).map(
      (race) => race.values,
    ),
    activityCount: count.count ?? 0,
    firstActivityAt: first.data?.started_at ?? null,
    activities: signals.activities,
    observations: (observations.data ?? []).flatMap((row) => {
      const value =
        row.value_numeric === null ? NaN : Number(row.value_numeric);
      return row.metric && row.observed_on && Number.isFinite(value)
        ? [{ metric: row.metric, observedOn: row.observed_on, value }]
        : [];
    }),
    vo2Max: signals.vo2Max,
    maxHeartRate: signals.maxHeartRate,
  });
}

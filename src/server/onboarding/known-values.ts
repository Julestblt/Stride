import "server-only";
import {
  buildKnownValues,
  buildSuggestions,
} from "@/features/onboarding/known-values";
import { loadHistoryContext } from "@/server/ai/context/history";
import type { OnboardingContext } from "./context";

const runningTypes = [
  "running",
  "treadmill_running",
  "track_running",
  "trail_running",
  "ultra_run",
];

export async function loadKnownValues(context: OnboardingContext, today: Date) {
  const year = new Date(today.getTime() - 365 * 86_400_000).toISOString();
  const [history, firstRun, vo2, maxHr] = await Promise.all([
    loadHistoryContext(context, today),
    context.client
      .from("provider_activities")
      .select("started_at")
      .eq("user_id", context.userId)
      .in("activity_type", runningTypes)
      .order("started_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("observed_on, value_numeric")
      .eq("user_id", context.userId)
      .eq("metric", "vo2_max")
      .eq("availability", "available")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_activities")
      .select("max_heart_rate, started_at, distance_meters")
      .eq("user_id", context.userId)
      .gte("started_at", year)
      .not("max_heart_rate", "is", null)
      .order("max_heart_rate", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const inputs = {
    today,
    activities: history.activities,
    observations: history.observations,
    firstRunAt: firstRun.data?.started_at ?? null,
    vo2Max:
      vo2.data?.observed_on && vo2.data.value_numeric !== null
        ? {
            value: Number(vo2.data.value_numeric),
            observedOn: vo2.data.observed_on,
          }
        : null,
    maxHeartRate:
      maxHr.data?.max_heart_rate && maxHr.data.started_at
        ? {
            value: Number(maxHr.data.max_heart_rate),
            startedAt: maxHr.data.started_at,
            distanceMeters:
              maxHr.data.distance_meters === null
                ? null
                : Number(maxHr.data.distance_meters),
          }
        : null,
  };
  return {
    known: buildKnownValues(inputs),
    suggestions: buildSuggestions(inputs),
  };
}

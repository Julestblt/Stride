import "server-only";
import { readRunningMaximum } from "@/server/heart-rate/maximum";
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

export async function loadGarminSignals(
  context: OnboardingContext,
  today: Date,
) {
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
    readRunningMaximum(context, today),
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
      maxHr.value === null
        ? null
        : {
            value: maxHr.value,
            manual: maxHr.override !== null,
            startedAt: maxHr.observed?.startedAt ?? today.toISOString(),
            distanceMeters:
              maxHr.override === null
                ? (maxHr.observed?.distanceMeters ?? null)
                : null,
          },
  };
  return inputs;
}

export async function loadKnownValues(context: OnboardingContext, today: Date) {
  const inputs = await loadGarminSignals(context, today);
  return {
    known: buildKnownValues(inputs),
    suggestions: buildSuggestions(inputs),
  };
}

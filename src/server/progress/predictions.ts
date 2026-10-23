import "server-only";
import {
  garminPredictionMetrics,
  predictionDeltaDays,
  type PredictionRow,
} from "@/features/progress/garmin-predictions";
import { addDays } from "@/features/progress/period";
import type { OnboardingContext } from "@/server/onboarding/context";

const metrics = Object.keys(garminPredictionMetrics);
export const previousWindowDays = 60;

function predictionRows(context: OnboardingContext) {
  return context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", metrics);
}

export async function readPredictions(
  context: OnboardingContext,
  today: string,
): Promise<PredictionRow[]> {
  const latest = await predictionRows(context)
    .lte("observed_on", today)
    .order("observed_on", { ascending: false })
    .limit(metrics.length * 4);
  if (latest.error) throw new Error("Unable to read the race predictions");
  const days = (latest.data ?? []).flatMap((row) =>
    row.observed_on ? [row.observed_on] : [],
  );
  if (days.length === 0) return [];
  const newest = days.reduce((a, b) => (a > b ? a : b));
  const oldest = days.reduce((a, b) => (a < b ? a : b));
  const previous = await predictionRows(context)
    .lte("observed_on", addDays(newest, -predictionDeltaDays))
    .gte(
      "observed_on",
      addDays(oldest, -(predictionDeltaDays + previousWindowDays)),
    )
    .order("observed_on", { ascending: false })
    .limit(1000);
  if (previous.error) throw new Error("Unable to read the race predictions");
  return [...(latest.data ?? []), ...(previous.data ?? [])];
}

import "server-only";
import {
  garminPredictionMetrics,
  type PredictionRow,
} from "@/features/progress/garmin-predictions";
import { addDays } from "@/features/progress/period";
import type { OnboardingContext } from "@/server/onboarding/context";

export const predictionHistoryDays = 120;

export async function readPredictions(
  context: OnboardingContext,
  today: string,
): Promise<PredictionRow[]> {
  const { data, error } = await context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", Object.keys(garminPredictionMetrics))
    .gte("observed_on", addDays(today, -predictionHistoryDays))
    .lte("observed_on", today)
    .order("observed_on", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Unable to read the race predictions");
  return data ?? [];
}

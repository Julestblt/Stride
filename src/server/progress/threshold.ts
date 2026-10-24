import "server-only";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

const thresholdMetrics = [
  "lactate_threshold_speed_mps",
  "lactate_threshold_heart_rate_bpm",
];

export async function readGarminThreshold(context: OnboardingContext) {
  const { data, error } = await context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", thresholdMetrics)
    .order("observed_on", { ascending: false })
    .limit(20);
  if (error) return null;
  const latest = (metric: string) =>
    (data ?? []).find(
      (row) =>
        row.metric === metric &&
        row.observed_on !== null &&
        row.value_numeric !== null &&
        Number(row.value_numeric) > 0,
    ) ?? null;
  const speed = latest("lactate_threshold_speed_mps");
  const heartRate = latest("lactate_threshold_heart_rate_bpm");
  const asOf = [speed?.observed_on, heartRate?.observed_on]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!asOf) return null;
  const speedValue = speed ? Number(speed.value_numeric) : null;
  const heartRateValue = heartRate ? Number(heartRate.value_numeric) : null;
  return {
    speedMps:
      speedValue !== null && speedValue > 1 && speedValue < 8
        ? speedValue
        : null,
    heartRateBpm:
      heartRateValue !== null && heartRateValue >= 100 && heartRateValue <= 230
        ? Math.round(heartRateValue)
        : null,
    asOf,
  };
}

const overrideSchema = z.object({
  threshold_heart_rate_override: z.number().int().positive().nullable(),
});

export async function readThresholdOverride(context: OnboardingContext) {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .select("threshold_heart_rate_override")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = overrideSchema.safeParse(data);
  return parsed.success ? parsed.data.threshold_heart_rate_override : null;
}

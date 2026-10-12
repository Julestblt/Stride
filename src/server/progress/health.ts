import "server-only";
import { z } from "zod";
import {
  healthDays,
  healthMetrics,
  healthModel,
  type HealthView,
} from "@/features/progress/health";
import { addDays } from "@/features/progress/period";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readAll } from "./history";

const observationSchema = z.object({
  metric: z.string(),
  observed_on: z.string(),
  value_numeric: z.union([z.number(), z.string()]).nullable(),
});

export async function loadHealth(
  context: OnboardingContext,
  today: string,
  view: Exclude<HealthView, "day">,
) {
  const rows = await readAll((from, to) =>
    context.client
      .from("provider_observations")
      .select("metric, observed_on, value_numeric")
      .eq("user_id", context.userId)
      .in("metric", [...healthMetrics])
      .in("availability", ["available", "partial"])
      .gte("observed_on", addDays(today, -75))
      .order("observed_on", { ascending: true })
      .order("metric", { ascending: true })
      .range(from, to),
  );
  const observations = rows.flatMap((row) => {
    const parsed = observationSchema.safeParse(row);
    if (!parsed.success) return [];
    const value =
      parsed.data.value_numeric === null
        ? NaN
        : Number(parsed.data.value_numeric);
    return [
      {
        metric: parsed.data.metric,
        day: parsed.data.observed_on,
        value: Number.isFinite(value) ? value : null,
      },
    ];
  });
  return healthModel({ days: healthDays(observations), view, today });
}

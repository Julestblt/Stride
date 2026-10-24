import "server-only";
import { z } from "zod";
import { parseHeartRateHistogram } from "@/features/activities/track";
import type { IntensityRun } from "@/features/progress/intensity";
import { intensityDays } from "@/features/progress/intensity";
import { isRunning, type ProgressHistory } from "@/features/progress/history";
import { addDays } from "@/features/progress/period";
import { loadHeartRateZones } from "@/server/activities/activities";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadIntensityPaces } from "@/server/plans/paces";
import { loadGoalInputs } from "./goal";
import { loadProgressHistory } from "./history";
import { readPredictions } from "./predictions";

const histogramRowSchema = z.object({
  activity_id: z.string(),
  heart_rate_histogram: z.unknown(),
});

async function readIntensityRuns(
  context: OnboardingContext,
  history: ProgressHistory,
  today: string,
): Promise<IntensityRun[]> {
  const from = addDays(today, -(intensityDays - 1));
  const runs = history.activities.filter(
    (activity) =>
      isRunning(activity.type) && activity.day >= from && activity.day <= today,
  );
  if (runs.length === 0) return [];
  const { data, error } = await context.client
    .from("provider_activity_tracks")
    .select("activity_id, heart_rate_histogram")
    .eq("user_id", context.userId)
    .eq("status", "available")
    .in(
      "activity_id",
      runs.map((run) => run.id),
    );
  if (error) return [];
  const days = new Map(runs.map((run) => [run.id, run.day]));
  return (data ?? []).flatMap((row) => {
    const parsed = histogramRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const day = days.get(parsed.data.activity_id);
    const histogram = parseHeartRateHistogram(parsed.data.heart_rate_histogram);
    return day && histogram.length
      ? [{ activityId: parsed.data.activity_id, day, histogram }]
      : [];
  });
}

export async function loadFitness(
  context: OnboardingContext,
  today: string,
  now: Date,
) {
  const historyRead = loadProgressHistory(context, today);
  const [history, zones, goal, paces, predictions, runs] = await Promise.all([
    historyRead,
    loadHeartRateZones(context, now),
    loadGoalInputs(context, today),
    loadIntensityPaces(context).catch(() => null),
    readPredictions(context, today).catch(() => []),
    historyRead.then((history) => readIntensityRuns(context, history, today)),
  ]);
  return { history, zones, paces, predictions, runs, ...goal };
}

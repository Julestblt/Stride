import "server-only";
import { z } from "zod";
import {
  recordsModel,
  type RecordTrack,
} from "@/features/progress/record-history";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadGoalInputs } from "./goal";
import { loadProgressHistory, readAll } from "./history";
import { readPredictions } from "./predictions";
import { readGarminThreshold, readThresholdOverride } from "./threshold";

const trackSchema = z.object({
  activity_id: z.string(),
  status: z.string(),
  elapsed_s: z.array(z.number().finite().nullable()).max(240).nullable(),
  distance_m: z.array(z.number().finite().nullable()).max(240).nullable(),
  elevation_m: z.array(z.number().finite().nullable()).max(240).nullable(),
});

export async function loadRecords(context: OnboardingContext, today: string) {
  const [history, rows, predictions, threshold, override, goal] =
    await Promise.all([
      loadProgressHistory(context, today, true),
      readAll((from, to) =>
        context.client
          .from("provider_activity_tracks")
          .select(
            "activity_id, status, elapsed_s:series->elapsed_s, distance_m:series->distance_m, elevation_m:series->elevation_m",
          )
          .eq("user_id", context.userId)
          .eq("status", "available")
          .order("activity_id", { ascending: true })
          .range(from, to),
      ),
      readPredictions(context, today).catch(() => []),
      readGarminThreshold(context),
      readThresholdOverride(context),
      loadGoalInputs(context, today),
    ]);
  const tracks = rows.flatMap((row): RecordTrack[] => {
    const parsed = trackSchema.safeParse(row);
    return parsed.success &&
      parsed.data.status === "available" &&
      parsed.data.elapsed_s &&
      parsed.data.distance_m &&
      parsed.data.elevation_m
      ? [
          {
            activityId: parsed.data.activity_id,
            series: {
              elapsed_s: parsed.data.elapsed_s,
              distance_m: parsed.data.distance_m,
              elevation_m: parsed.data.elevation_m,
            },
          },
        ]
      : [];
  });
  return {
    model: recordsModel(history, tracks, today),
    history,
    predictions,
    threshold: {
      speedMps: threshold?.speedMps ?? null,
      heartRateBpm: threshold?.heartRateBpm ?? null,
      override,
    },
    goal,
  };
}

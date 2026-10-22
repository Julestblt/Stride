import "server-only";
import { z } from "zod";
import type { AthleteFeeling } from "@/features/plans/debrief/debrief";
import type { OnboardingContext } from "@/server/onboarding/context";

const feelingRowSchema = z.object({
  activity_id: z.string(),
  effort: z.number().int().min(1).max(10),
  feel: z.number().int().min(0).max(100).nullable(),
});

export async function readActivityFeelings(
  context: OnboardingContext,
  activityIds: string[],
): Promise<Map<string, AthleteFeeling>> {
  const feelings = new Map<string, AthleteFeeling>();
  if (activityIds.length === 0) return feelings;
  const { data, error } = await context.client
    .from("activity_feelings")
    .select("activity_id, effort, feel")
    .eq("user_id", context.userId)
    .in("activity_id", activityIds);
  if (error) return feelings;
  for (const row of data ?? []) {
    const parsed = feelingRowSchema.safeParse(row);
    if (parsed.success)
      feelings.set(parsed.data.activity_id, {
        effort: parsed.data.effort,
        feel: parsed.data.feel,
      });
  }
  return feelings;
}

export async function readActivityFeeling(
  context: OnboardingContext,
  activityId: string,
) {
  const feelings = await readActivityFeelings(context, [activityId]);
  return feelings.get(activityId) ?? null;
}

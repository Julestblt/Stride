"use server";

import { revalidatePath } from "next/cache";
import { activityFeelingSchema } from "@/features/plans/debrief/debrief";
import { getOnboardingContext } from "@/server/onboarding/context";

export type ActivityFeelingResult =
  { status: "saved" } | { status: "invalid" | "error" | "session-expired" };

export async function saveActivityFeeling(
  input: unknown,
): Promise<ActivityFeelingResult> {
  const parsed = activityFeelingSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { activityId, effort, feel } = parsed.data;
  const { error } = await context.client
    .from("activity_feelings")
    .upsert(
      { user_id: context.userId, activity_id: activityId, effort, feel },
      { onConflict: "user_id,activity_id" },
    );
  if (error) return { status: "error" };
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath(`/activities/${activityId}`);
  return { status: "saved" };
}

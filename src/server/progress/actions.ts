"use server";

import { revalidatePath } from "next/cache";
import { localToday } from "@/features/app-shell/shell";
import { bodyPath } from "@/features/progress/health";
import { checkinFieldSchema } from "@/features/progress/recovery";
import { getOnboardingContext } from "@/server/onboarding/context";

export type CheckinResult =
  | { status: "saved"; updatedAt: string | null }
  | { status: "invalid" | "error" | "session-expired" };

export async function saveCheckin(input: unknown): Promise<CheckinResult> {
  const parsed = checkinFieldSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { data, error } = await context.client
    .from("athlete_wellness_checkins")
    .upsert(
      {
        user_id: context.userId,
        checkin_date: localToday(new Date()),
        ...(parsed.data.field === "legs" && { legs: parsed.data.value }),
        ...(parsed.data.field === "soreness" && {
          soreness: parsed.data.value,
        }),
        ...(parsed.data.field === "stress" && { stress: parsed.data.value }),
      },
      { onConflict: "user_id,checkin_date" },
    )
    .select("updated_at")
    .single();
  if (error) return { status: "error" };
  revalidatePath(bodyPath);
  revalidatePath("/today");
  return { status: "saved", updatedAt: data?.updated_at ?? null };
}

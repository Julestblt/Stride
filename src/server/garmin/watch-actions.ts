"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { watchIntent } from "@/features/garmin/watch";
import { getOnboardingContext } from "@/server/onboarding/context";
import { removeWatchWorkouts, syncWatch, type WatchSyncOutcome } from "./watch";

export type WatchActionResult =
  WatchSyncOutcome | { status: "invalid" | "error" };

const enabledSchema = z.strictObject({ enabled: z.boolean() });
const sendSchema = z.strictObject({
  sessionKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  action: z.enum(["send", "resend", "retry", "confirm"]),
});

function refresh() {
  revalidatePath("/plan", "layout");
  revalidatePath("/today");
  revalidatePath("/settings/connections/garmin");
}

export async function setWatchWorkoutsEnabled(
  input: unknown,
): Promise<WatchActionResult> {
  const parsed = enabledSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { enabled } = parsed.data;
  if (!enabled) {
    const removed = await removeWatchWorkouts(context);
    if (removed.status !== "synced" && removed.status !== "reconnect")
      return removed;
  }
  const { error } = await context.client
    .from("athlete_profiles")
    .update({ watch_workouts_enabled: enabled })
    .eq("user_id", context.userId);
  if (error) return { status: "error" };
  const result = enabled
    ? await syncWatch(context)
    : { status: "disabled" as const };
  refresh();
  return result;
}

export async function sendSessionToWatch(
  input: unknown,
): Promise<WatchActionResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const result = await syncWatch(
    context,
    watchIntent(parsed.data.sessionKey, parsed.data.action),
  );
  refresh();
  return result;
}

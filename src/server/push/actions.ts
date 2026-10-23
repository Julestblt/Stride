"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  pushPreferenceChangeSchema,
  pushSubscriptionSchema,
  type PushPreferences,
} from "@/features/notifications/push";
import { getOnboardingContext } from "@/server/onboarding/context";
import { pushEnvironment } from "./environment";

export type PushActionResult = {
  status: "saved" | "invalid" | "error" | "session-expired" | "unavailable";
};

const endpointSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
});

function refresh() {
  revalidatePath("/settings/training");
}

export async function subscribePush(input: unknown): Promise<PushActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  if (!pushEnvironment()) return { status: "unavailable" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { endpoint, keys, label } = parsed.data;
  const { error } = await context.client.rpc("register_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    ...(label ? { p_label: label } : {}),
  });
  if (error) return { status: "error" };
  refresh();
  return { status: "saved" };
}

export async function unsubscribePush(
  input: unknown,
): Promise<PushActionResult> {
  const parsed = endpointSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { error } = await context.client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", context.userId)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return { status: "error" };
  refresh();
  return { status: "saved" };
}

export async function setPushPreference(
  input: unknown,
): Promise<PushActionResult> {
  const parsed = pushPreferenceChangeSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { category, enabled } = parsed.data;
  const change: Partial<PushPreferences> = { [category]: enabled };
  const { error } = await context.client.from("push_preferences").upsert(
    {
      user_id: context.userId,
      ...change,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { status: "error" };
  refresh();
  return { status: "saved" };
}

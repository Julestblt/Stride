import "server-only";
import {
  defaultPushPreferences,
  pushPreferencesSchema,
  type PushPreferences,
} from "@/features/notifications/push";
import type { OnboardingContext } from "@/server/onboarding/context";
import { pushEnvironment } from "./environment";

export type PushSettings = {
  publicKey: string | null;
  preferences: PushPreferences;
  endpoints: string[];
};

export async function readPushSettings(
  context: OnboardingContext,
): Promise<PushSettings> {
  const [preferences, devices] = await Promise.all([
    context.client
      .from("push_preferences")
      .select("session_reminder, plan_staff, debrief, garmin_issues")
      .eq("user_id", context.userId)
      .limit(1),
    context.client
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", context.userId),
  ]);
  const row = preferences.data?.[0];
  return {
    publicKey: pushEnvironment()?.publicKey ?? null,
    preferences: row
      ? pushPreferencesSchema.parse(row)
      : defaultPushPreferences,
    endpoints: devices.data?.map(({ endpoint }) => endpoint) ?? [],
  };
}

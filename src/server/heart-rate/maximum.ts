import "server-only";
import { z } from "zod";
import {
  runningActivityTypes,
  effectiveRunningMaximum,
  eligibleRunningMaximum,
} from "@/features/settings/heart-rate";
import type { OnboardingContext } from "@/server/onboarding/context";

const observedSchema = z.object({
  provider: z.string(),
  activity_type: z.string(),
  max_heart_rate: z.coerce.number().int().min(100).max(230),
  started_at: z.iso.datetime({ offset: true }),
  distance_meters: z.coerce.number().nullable(),
});

export async function readRunningMaximum(
  context: OnboardingContext,
  now = new Date(),
) {
  const [profile, activity] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("running_max_heart_rate_override")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.client
      .from("provider_activities")
      .select(
        "provider,activity_type,max_heart_rate,started_at,distance_meters",
      )
      .eq("user_id", context.userId)
      .eq("provider", "garmin")
      .in("activity_type", runningActivityTypes)
      .gte(
        "started_at",
        new Date(now.getTime() - 365 * 86_400_000).toISOString(),
      )
      .lte("started_at", now.toISOString())
      .gte("max_heart_rate", 100)
      .lte("max_heart_rate", 230)
      .order("max_heart_rate", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile.error || activity.error)
    throw new Error("Unable to read running maximum");
  const parsed = observedSchema.safeParse(activity.data);
  const observed =
    parsed.success &&
    eligibleRunningMaximum(
      {
        provider: parsed.data.provider,
        activityType: parsed.data.activity_type,
        startedAt: parsed.data.started_at,
        maximum: parsed.data.max_heart_rate,
      },
      now,
    )
      ? {
          value: parsed.data.max_heart_rate,
          startedAt: parsed.data.started_at,
          distanceMeters: parsed.data.distance_meters,
        }
      : null;
  const override = z
    .number()
    .int()
    .min(100)
    .max(230)
    .nullable()
    .parse(profile.data?.running_max_heart_rate_override ?? null);
  return {
    value: effectiveRunningMaximum(override, observed?.value ?? null),
    override,
    observed,
  };
}

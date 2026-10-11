import "server-only";

import type { OnboardingContext } from "@/server/onboarding/context";
import { getGarminClient } from "@/server/garmin/session";

export async function readSettingsConnection(context: OnboardingContext) {
  try {
    const [connection, sync] = await Promise.all([
      getGarminClient().getConnection({ accessToken: context.accessToken }),
      getGarminClient().getSync({ accessToken: context.accessToken }),
    ]);
    return {
      connection: connection.ok ? connection.value : null,
      sync: sync.ok ? sync.value : null,
    };
  } catch {
    return { connection: null, sync: null };
  }
}

export async function readStoredCounts(context: OnboardingContext) {
  const [activities, observations] = await Promise.all([
    context.client
      .from("provider_activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId),
    context.client
      .from("provider_observations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId),
  ]);
  return {
    activities: activities.error ? null : activities.count,
    observations: observations.error ? null : observations.count,
  };
}

export async function readGarminRecentData(context: OnboardingContext) {
  const [activity, observation] = await Promise.all([
    context.client
      .from("provider_activities")
      .select("activity_name,started_at,imported_at")
      .eq("user_id", context.userId)
      .eq("provider", "garmin")
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("metric,observed_on,imported_at")
      .eq("user_id", context.userId)
      .eq("provider", "garmin")
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    activity: activity.error ? null : activity.data,
    observation: observation.error ? null : observation.data,
  };
}

export async function readProfileMetrics(context: OnboardingContext) {
  const [maximum, vo2, resting, hrv] = await Promise.all([
    context.client
      .from("provider_activities")
      .select("max_heart_rate,started_at")
      .eq("user_id", context.userId)
      .not("max_heart_rate", "is", null)
      .order("max_heart_rate", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("value_numeric,observed_on")
      .eq("user_id", context.userId)
      .eq("metric", "vo2_max")
      .eq("availability", "available")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("value_numeric,observed_on")
      .eq("user_id", context.userId)
      .eq("metric", "resting_heart_rate_bpm")
      .eq("availability", "available")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("value_numeric,observed_on")
      .eq("user_id", context.userId)
      .eq("metric", "hrv_last_night_ms")
      .eq("availability", "available")
      .order("observed_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return [
    {
      label: "Fréquence cardiaque maximale",
      value: maximum.error ? null : maximum.data?.max_heart_rate,
      unit: "bpm",
      date: maximum.data?.started_at,
    },
    {
      label: "Fréquence cardiaque au repos",
      value: resting.error ? null : resting.data?.value_numeric,
      unit: "bpm",
      date: resting.data?.observed_on,
    },
    {
      label: "VFC",
      value: hrv.error ? null : hrv.data?.value_numeric,
      unit: "ms",
      date: hrv.data?.observed_on,
    },
    {
      label: "VO₂ max",
      value: vo2.error ? null : vo2.data?.value_numeric,
      unit: "",
      date: vo2.data?.observed_on,
    },
  ].filter((item) => item.value !== null && item.value !== undefined);
}

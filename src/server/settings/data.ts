import "server-only";
import { z } from "zod";
import type { ProfileMetric } from "@/features/settings/profile";
import { readRunningMaximum } from "@/server/heart-rate/maximum";
import { readSettingsProfile } from "./profile";

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

export async function readProfileMetrics(
  context: OnboardingContext,
): Promise<ProfileMetric[]> {
  const [maximum, profile, observations] = await Promise.all([
    readRunningMaximum(context),
    readSettingsProfile(context),
    context.client
      .from("provider_observations")
      .select("metric,value_numeric,observed_on")
      .eq("user_id", context.userId)
      .eq("provider", "garmin")
      .eq("availability", "available")
      .in("metric", [
        "vo2_max",
        "resting_heart_rate_bpm",
        "hrv_last_night_ms",
        "lactate_threshold_heart_rate_bpm",
      ])
      .lte("observed_on", new Date().toISOString().slice(0, 10))
      .order("observed_on", { ascending: false })
      .limit(1000),
  ]);
  const observationSchema = z.object({
    metric: z.string(),
    value_numeric: z.coerce.number().finite().positive(),
    observed_on: z.iso.date(),
  });
  const rows = observations.error
    ? []
    : (observations.data ?? []).flatMap((row) => {
        if (row.value_numeric === null) return [];
        const parsed = observationSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      });
  const latest = (metric: string) =>
    rows.find((row) => row.metric === metric) ?? null;
  const candidate = latest("lactate_threshold_heart_rate_bpm");
  const threshold =
    candidate &&
    Number.isInteger(candidate.value_numeric) &&
    candidate.value_numeric >= 100 &&
    candidate.value_numeric <= 230
      ? candidate
      : null;
  const metrics: ProfileMetric[] = [
    {
      key: "maximum",
      label: "FC max",
      value: maximum.value,
      unit: "bpm",
      date: maximum.observed?.startedAt ?? null,
      source: maximum.override === null ? "estimate" : "manual",
      detail:
        maximum.override === null
          ? "Observée en course · 365 derniers jours"
          : "Ta valeur",
    },
    {
      key: "threshold",
      providerValue: threshold ? Number(threshold.value_numeric) : null,
      label: "FC au seuil",
      value:
        profile.thresholdOverride ??
        (threshold ? Number(threshold.value_numeric) : null),
      unit: "bpm",
      date: threshold?.observed_on ?? null,
      source: profile.thresholdOverride === null ? "provider" : "manual",
      detail: profile.thresholdOverride === null ? "Garmin" : "Ta valeur",
    },
  ];
  for (const item of [
    {
      key: "resting",
      label: "FC au repos",
      metric: "resting_heart_rate_bpm",
      unit: "bpm",
    },
    {
      key: "hrv",
      label: "VFC nocturne",
      metric: "hrv_last_night_ms",
      unit: "ms",
    },
    { key: "vo2", label: "VO₂ max", metric: "vo2_max", unit: "" },
  ] as const) {
    const row = latest(item.metric);
    metrics.push({
      key: item.key,
      label: item.label,
      value: row ? Number(row.value_numeric) : null,
      unit: item.unit,
      date: row?.observed_on ?? null,
      source: "provider",
      detail:
        item.key === "hrv" ? "Garmin · dernière nuit disponible" : "Garmin",
    });
  }
  return metrics;
}

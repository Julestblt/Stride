import "server-only";
import { z } from "zod";
import { loadPoints } from "@/features/progress/history";
import { addDays } from "@/features/progress/period";
import {
  checkinRowSchema,
  recoveryMetrics,
  recoveryModel,
  recoveryNights,
  type Checkin,
} from "@/features/progress/recovery";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readAll, readRaces } from "./history";

const observationSchema = z.object({
  metric: z.string(),
  observed_on: z.string(),
  value_numeric: z.union([z.number(), z.string()]).nullable(),
  value_text: z.string().nullable().optional(),
});

function number(value: number | string | null) {
  const parsed = value === null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function readCheckin(
  context: OnboardingContext,
  today: string,
): Promise<Checkin | null> {
  const { data, error } = await context.client
    .from("athlete_wellness_checkins")
    .select("checkin_date, legs, soreness, stress, updated_at")
    .eq("user_id", context.userId)
    .eq("checkin_date", today)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = checkinRowSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function loadRecovery(context: OnboardingContext, today: string) {
  const since = addDays(today, -150);
  const [rows, checkin, races] = await Promise.all([
    readAll((from, to) =>
      context.client
        .from("provider_observations")
        .select("metric, observed_on, value_numeric, value_text")
        .eq("user_id", context.userId)
        .in("metric", [
          ...recoveryMetrics,
          "training_load_acute",
          "training_load_chronic",
        ])
        .in("availability", ["available", "partial"])
        .gte("observed_on", since)
        .order("observed_on", { ascending: true })
        .order("metric", { ascending: true })
        .range(from, to),
    ),
    readCheckin(context, today),
    readRaces(context),
  ]);
  const observations = rows.flatMap((row) => {
    const parsed = observationSchema.safeParse(row);
    return parsed.success
      ? [
          {
            metric: parsed.data.metric,
            day: parsed.data.observed_on,
            value: number(parsed.data.value_numeric),
            text: parsed.data.value_text ?? null,
          },
        ]
      : [];
  });
  return recoveryModel({
    nights: recoveryNights(observations),
    load: loadPoints(
      observations.flatMap((item) =>
        item.value === null ? [] : [{ ...item, value: item.value }],
      ),
    ),
    checkin,
    races,
    today,
  });
}

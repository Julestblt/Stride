import "server-only";
import { z } from "zod";
import { activityTitle } from "@/features/activities/activities";
import type { WellnessDay } from "@/features/garmin/wellness";
import { healthModel } from "@/features/progress/health";
import {
  dayWindow,
  healthDayModel,
  type DayActivity,
} from "@/features/progress/health-day";
import { addDays } from "@/features/progress/period";
import { getGarminClient } from "@/server/garmin/session";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadHealthDays } from "./health";

const activitySchema = z.object({
  activity_name: z.string().nullable(),
  activity_type: z.string().nullable(),
  route_name: z.string().nullable(),
  started_at: z.string(),
  duration_seconds: z.union([z.number(), z.string()]).nullable(),
});

export type DayFailure = "unavailable" | "reconnect" | "rate-limited";

async function readWellness(
  context: OnboardingContext,
  day: string,
): Promise<{ day: WellnessDay | null; failure: DayFailure | null }> {
  try {
    const result = await getGarminClient().getWellnessDay(
      { accessToken: context.accessToken },
      day,
    );
    if (result.ok) return { day: result.value, failure: null };
    const code = result.failure.code;
    return {
      day: null,
      failure:
        code === "reconnect_required"
          ? "reconnect"
          : code === "rate_limited"
            ? "rate-limited"
            : "unavailable",
    };
  } catch {
    return { day: null, failure: "unavailable" };
  }
}

async function readActivities(
  context: OnboardingContext,
  day: string,
): Promise<DayActivity[]> {
  const window = dayWindow(day);
  const { data, error } = await context.client
    .from("provider_activities")
    .select(
      "activity_name, activity_type, route_name, started_at, duration_seconds",
    )
    .eq("user_id", context.userId)
    .gte("started_at", new Date(window.start).toISOString())
    .lt("started_at", new Date(window.end).toISOString())
    .order("started_at", { ascending: true })
    .limit(20);
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    const parsed = activitySchema.safeParse(row);
    if (!parsed.success) return [];
    const startedAt = Date.parse(parsed.data.started_at);
    const duration = Number(parsed.data.duration_seconds);
    return Number.isFinite(startedAt)
      ? [
          {
            startedAt,
            name: activityTitle({
              name: parsed.data.activity_name?.trim() || null,
              type: parsed.data.activity_type,
              routeName: parsed.data.route_name,
            }),
            durationSeconds: Number.isFinite(duration) ? duration : null,
          },
        ]
      : [];
  });
}

export async function loadHealthStrip(
  context: OnboardingContext,
  day: string,
  today: string,
) {
  const stripEnd = day === today ? today : [addDays(day, 3), today].sort()[0];
  const days = await loadHealthDays(context, stripEnd);
  const reference = healthModel({
    days: days.filter((item) => item.day <= day),
    view: "week",
    today: day,
  });
  const strip = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(stripEnd, index - 6);
    const night = days.find((item) => item.day === date);
    const average = reference.sleep?.average ?? null;
    return {
      date,
      tone:
        !night || night.sleep === null
          ? null
          : average !== null && night.sleep < average - 45 * 60
            ? ("warning" as const)
            : ("success" as const),
    };
  });
  return { reference, strip };
}

export async function loadHealthDay(context: OnboardingContext, day: string) {
  const [current, previous, activities] = await Promise.all([
    readWellness(context, day),
    readWellness(context, addDays(day, -1)),
    readActivities(context, day),
  ]);
  return {
    failure: current.failure,
    model: current.day
      ? healthDayModel({
          day,
          current: current.day,
          previous: previous.day,
          activities,
          now: Date.now(),
        })
      : null,
  };
}

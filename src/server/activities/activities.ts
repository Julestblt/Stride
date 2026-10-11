import "server-only";
import {
  activityColumns,
  activityNamePattern,
  activityNameRegex,
  activityRowSchema,
  activityTypesByFilter,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
import {
  activityDetailColumns,
  activityDetailRowSchema,
  segmentColumns,
  segmentRowSchema,
} from "@/features/activities/detail";
import { parseTrack, trackColumns } from "@/features/activities/track";
import {
  calculateHeartRateZones,
  type HeartRateZones,
} from "@/features/onboarding/heart-rate-zones";
import type { OnboardingContext } from "@/server/onboarding/context";

export async function listActivities(
  context: OnboardingContext,
  filter: ActivityFilter,
  limit: number,
  search = "",
): Promise<{ activities: Activity[]; total: number }> {
  let query = context.client
    .from("provider_activities")
    .select(activityColumns, { count: "exact" })
    .eq("user_id", context.userId)
    .not("started_at", "is", null);
  if (filter !== "all")
    query = query.in("activity_type", [...activityTypesByFilter[filter]]);
  if (search)
    query = search.includes("*")
      ? query.filter("activity_name", "imatch", activityNameRegex(search))
      : query.ilike("activity_name", activityNamePattern(search));
  const { data, error, count } = await query
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to read activities");
  const activities = (data ?? []).map((row) => activityRowSchema.parse(row));
  return { activities, total: Math.max(count ?? 0, activities.length) };
}

export async function readActivity(
  context: OnboardingContext,
  id: string,
): Promise<Activity | null> {
  const { data, error } = await context.client
    .from("provider_activities")
    .select(activityColumns)
    .eq("user_id", context.userId)
    .eq("id", id)
    .not("started_at", "is", null)
    .maybeSingle();
  if (error) throw new Error("Unable to read activity");
  return data ? activityRowSchema.parse(data) : null;
}

export async function readActivityDetail(
  context: OnboardingContext,
  id: string,
) {
  const [activity, segments, track] = await Promise.all([
    context.client
      .from("provider_activities")
      .select(activityDetailColumns)
      .eq("user_id", context.userId)
      .eq("id", id)
      .not("started_at", "is", null)
      .maybeSingle(),
    context.client
      .from("provider_activity_segments")
      .select(segmentColumns)
      .eq("user_id", context.userId)
      .eq("activity_id", id)
      .order("segment_type", { ascending: true })
      .order("segment_index", { ascending: true }),
    context.client
      .from("provider_activity_tracks")
      .select(trackColumns)
      .eq("user_id", context.userId)
      .eq("activity_id", id)
      .maybeSingle(),
  ]);
  if (activity.error || segments.error)
    throw new Error("Unable to read activity detail");
  if (!activity.data) return null;
  return {
    activity: activityDetailRowSchema.parse(activity.data),
    segments: (segments.data ?? []).map((row) => segmentRowSchema.parse(row)),
    track: track.error || !track.data ? null : parseTrack(track.data),
  };
}

const dayMs = 86_400_000;

export async function loadHeartRateZones(
  context: OnboardingContext,
  now: Date,
): Promise<HeartRateZones | null> {
  const year = new Date(now.getTime() - 365 * dayMs).toISOString();
  const month = new Date(now.getTime() - 28 * dayMs).toISOString().slice(0, 10);
  const [maximum, resting] = await Promise.all([
    context.client
      .from("provider_activities")
      .select("max_heart_rate")
      .eq("user_id", context.userId)
      .gte("started_at", year)
      .not("max_heart_rate", "is", null)
      .order("max_heart_rate", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("metric, observed_on, value_numeric")
      .eq("user_id", context.userId)
      .eq("availability", "available")
      .eq("metric", "resting_heart_rate_bpm")
      .gte("observed_on", month)
      .limit(100),
  ]);
  if (maximum.error || resting.error) return null;
  return calculateHeartRateZones({
    maximum: maximum.data?.max_heart_rate
      ? Number(maximum.data.max_heart_rate)
      : null,
    observations: (resting.data ?? []).flatMap((row) =>
      row.metric && row.observed_on && row.value_numeric !== null
        ? [
            {
              metric: row.metric,
              observedOn: row.observed_on,
              value: Number(row.value_numeric),
            },
          ]
        : [],
    ),
    today: now,
  });
}

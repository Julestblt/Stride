import "server-only";
import {
  activityColumns,
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
import type { OnboardingContext } from "@/server/onboarding/context";

export async function listActivities(
  context: OnboardingContext,
  filter: ActivityFilter,
  limit: number,
): Promise<{ activities: Activity[]; total: number }> {
  let query = context.client
    .from("provider_activities")
    .select(activityColumns, { count: "exact" })
    .eq("user_id", context.userId)
    .not("started_at", "is", null);
  if (filter !== "all")
    query = query.in("activity_type", [...activityTypesByFilter[filter]]);
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
  const [activity, segments] = await Promise.all([
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
  ]);
  if (activity.error || segments.error)
    throw new Error("Unable to read activity detail");
  if (!activity.data) return null;
  return {
    activity: activityDetailRowSchema.parse(activity.data),
    segments: (segments.data ?? []).map((row) => segmentRowSchema.parse(row)),
  };
}

import "server-only";
import {
  activityColumns,
  activityRowSchema,
  activityTitle,
} from "@/features/activities/activities";
import type { CourseActivity } from "@/features/races/race";
import type { OnboardingContext } from "@/server/onboarding/context";

export async function listCourseActivities(
  context: OnboardingContext,
): Promise<CourseActivity[]> {
  const tracks = await context.client
    .from("provider_activity_tracks")
    .select("activity_id")
    .eq("user_id", context.userId)
    .eq("status", "available")
    .gt("route_point_count", 1)
    .order("imported_at", { ascending: false })
    .limit(200);
  if (tracks.error || !tracks.data?.length) return [];
  const { data, error } = await context.client
    .from("provider_activities")
    .select(activityColumns)
    .eq("user_id", context.userId)
    .in(
      "id",
      tracks.data.map((row) => row.activity_id),
    )
    .order("started_at", { ascending: false })
    .limit(40);
  if (error) return [];
  return (data ?? []).map((row) => {
    const activity = activityRowSchema.parse(row);
    return {
      id: activity.id,
      title: activityTitle(activity),
      date: activity.date,
      distanceM: activity.distanceMeters,
      elevationGainM: activity.elevationGainMeters,
    };
  });
}

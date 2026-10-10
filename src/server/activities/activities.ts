import "server-only";
import {
  activityColumns,
  activityRowSchema,
  activityTypesByFilter,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
import type { OnboardingContext } from "@/server/onboarding/context";

export const activityListLimit = 100;

export async function listActivities(
  context: OnboardingContext,
  filter: ActivityFilter,
): Promise<Activity[]> {
  let query = context.client
    .from("provider_activities")
    .select(activityColumns)
    .eq("user_id", context.userId)
    .not("started_at", "is", null);
  if (filter !== "all")
    query = query.in("activity_type", [...activityTypesByFilter[filter]]);
  const { data, error } = await query
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(activityListLimit);
  if (error) throw new Error("Unable to read activities");
  return (data ?? []).map((row) => activityRowSchema.parse(row));
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

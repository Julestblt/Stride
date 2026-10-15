import "server-only";
import { cache } from "react";
import { raceRowSchema, withRaceCourse } from "@/features/onboarding/goals";
import {
  checklistColumns,
  checklistRowSchema,
  type ChecklistItem,
} from "@/features/races/checklists";
import {
  courseColumns,
  courseRowSchema,
  defaultPlan,
  planColumns,
  planRowSchema,
  type RacePlan,
  type RaceSummary,
  type StoredCourse,
} from "@/features/races/race";
import {
  sortWaypoints,
  waypointColumns,
  waypointRowSchema,
  type Waypoint,
} from "@/features/races/waypoints";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readRaceCourses } from "./courses";

export type RaceWorkspaceData = {
  race: RaceSummary;
  plan: RacePlan;
  course: StoredCourse | null;
  waypoints: Waypoint[];
  checklist: ChecklistItem[];
};

function summary(row: unknown): RaceSummary {
  const race = raceRowSchema.parse(row);
  return {
    id: race.id,
    name: race.name ?? "Course sans nom",
    kind: race.race_kind,
    date: race.race_date,
    distanceKm: race.distance_km,
    elevationGainM: race.elevation_gain_m,
    priority: race.priority,
    targetSeconds: race.target_duration_seconds,
    revision: race.revision,
  };
}

export const listRaces = cache(async (context: OnboardingContext) => {
  const [{ data, error }, courses] = await Promise.all([
    context.client
      .from("athlete_races")
      .select("*")
      .eq("user_id", context.userId)
      .order("race_date", { ascending: true, nullsFirst: false }),
    readRaceCourses(context),
  ]);
  if (error) throw new Error("Unable to read races");
  return (data ?? []).map((row) => {
    const race = summary(row);
    const resolved = withRaceCourse(
      { distance_km: race.distanceKm, elevation_gain_m: race.elevationGainM },
      courses.get(race.id),
    );
    return {
      ...race,
      distanceKm: resolved.distance_km,
      elevationGainM: resolved.elevation_gain_m,
    };
  });
});

export const readWorkspace = cache(
  async (
    context: OnboardingContext,
    raceId: string,
  ): Promise<RaceWorkspaceData | null> => {
    const [race, plan, course, waypoints, checklist] = await Promise.all([
      context.client
        .from("athlete_races")
        .select("*")
        .eq("user_id", context.userId)
        .eq("id", raceId)
        .maybeSingle(),
      context.client
        .from("race_plans")
        .select(planColumns)
        .eq("user_id", context.userId)
        .eq("race_id", raceId)
        .maybeSingle(),
      context.client
        .from("race_courses")
        .select(courseColumns)
        .eq("user_id", context.userId)
        .eq("race_id", raceId)
        .maybeSingle(),
      context.client
        .from("race_waypoints")
        .select(waypointColumns)
        .eq("user_id", context.userId)
        .eq("race_id", raceId)
        .order("distance_m", { ascending: true }),
      context.client
        .from("race_checklist_items")
        .select(checklistColumns)
        .eq("user_id", context.userId)
        .eq("race_id", raceId)
        .order("list", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (
      race.error ||
      plan.error ||
      course.error ||
      waypoints.error ||
      checklist.error
    )
      throw new Error("Unable to read race workspace");
    if (!race.data) return null;
    return {
      race: summary(race.data),
      plan: plan.data ? planRowSchema.parse(plan.data) : defaultPlan,
      course: course.data ? courseRowSchema.parse(course.data) : null,
      waypoints: sortWaypoints(
        (waypoints.data ?? []).map((row) => waypointRowSchema.parse(row)),
      ),
      checklist: (checklist.data ?? []).map((row) =>
        checklistRowSchema.parse(row),
      ),
    };
  },
);

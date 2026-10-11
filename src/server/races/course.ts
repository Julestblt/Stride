import "server-only";
import { z } from "zod";
import {
  buildRouteView,
  parseTrack,
  trackColumns,
} from "@/features/activities/track";
import {
  buildCourse,
  nearestDistance,
  type Course,
  type RawPoint,
} from "@/features/races/course";
import { parseGpx, type GpxWaypoint } from "@/features/races/gpx";
import { guessKind } from "@/features/races/waypoints";
import type { OnboardingContext } from "@/server/onboarding/context";

export const maximumUploadBytes = 20 * 1024 * 1024;
const offCourseM = 250;
const fallbackTimeZone = "Europe/Paris";

export type CourseImportResult =
  | { status: "saved"; waypoints: number }
  | {
      status:
        | "invalid-file"
        | "no-track"
        | "too-large"
        | "missing"
        | "error"
        | "session-expired";
    };

async function timeZoneAt(lat: number, lon: number) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lon.toFixed(3),
      timezone: "auto",
      forecast_days: "1",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 2_592_000 },
      },
    );
    if (!response.ok) return fallbackTimeZone;
    const body = z
      .object({ timezone: z.string().min(1).max(64) })
      .safeParse(await response.json());
    if (!body.success) return fallbackTimeZone;
    new Intl.DateTimeFormat("fr-FR", { timeZone: body.data.timezone });
    return body.data.timezone;
  } catch {
    return fallbackTimeZone;
  }
}

function gpxWaypointRows(course: Course, waypoints: GpxWaypoint[]) {
  return waypoints.flatMap((waypoint) => {
    const { distanceM, offsetM } = nearestDistance(
      course,
      waypoint.lat,
      waypoint.lon,
    );
    if (offsetM > offCourseM) return [];
    const guessed = guessKind(
      waypoint.name,
      waypoint.type,
      waypoint.description,
    );
    if (guessed === "start" || guessed === "finish") return [];
    return [
      {
        kind: guessed ?? "instruction",
        name: waypoint.name,
        distance_m: Math.round(distanceM * 10) / 10,
        todo: waypoint.description?.slice(0, 400) ?? null,
        needs_review: guessed === null,
      },
    ];
  });
}

export async function storeCourse(
  context: OnboardingContext,
  raceId: string,
  course: Course,
  source:
    | { kind: "gpx"; fileName: string }
    | { kind: "activity"; activityId: string; name: string },
  gpxWaypoints: GpxWaypoint[] = [],
): Promise<CourseImportResult> {
  const [lat, lon] = course.points[0];
  const timeZone = await timeZoneAt(lat, lon);
  const { data, error } = await context.client.rpc("replace_race_course", {
    p_race_id: raceId,
    p_source: source.kind,
    p_file_name:
      source.kind === "gpx"
        ? source.fileName.slice(0, 200)
        : source.name.slice(0, 200),
    p_source_activity_id:
      source.kind === "activity" ? source.activityId : undefined,
    p_time_zone: timeZone,
    p_distance_m: course.distanceM,
    p_elevation_gain_m: course.elevationGainM ?? undefined,
    p_elevation_loss_m: course.elevationLossM ?? undefined,
    p_step_m: course.stepM,
    p_points: course.points as unknown as [number, number, number | null][],
    p_waypoints: gpxWaypointRows(course, gpxWaypoints),
  });
  if (error) return { status: error.code === "42501" ? "missing" : "error" };
  return { status: "saved", waypoints: data };
}

export async function importGpx(
  context: OnboardingContext,
  raceId: string,
  file: File,
): Promise<CourseImportResult> {
  if (file.size > maximumUploadBytes) return { status: "too-large" };
  const parsed = parseGpx(await file.text());
  if (parsed === "not-gpx") return { status: "invalid-file" };
  if (parsed === "no-track") return { status: "no-track" };
  const course = buildCourse(parsed.points);
  if (!course) return { status: "no-track" };
  return storeCourse(
    context,
    raceId,
    course,
    { kind: "gpx", fileName: file.name || "parcours.gpx" },
    parsed.waypoints,
  );
}

export async function importActivity(
  context: OnboardingContext,
  raceId: string,
  activityId: string,
): Promise<CourseImportResult> {
  const [activity, track] = await Promise.all([
    context.client
      .from("provider_activities")
      .select("id, activity_name")
      .eq("user_id", context.userId)
      .eq("id", activityId)
      .maybeSingle(),
    context.client
      .from("provider_activity_tracks")
      .select(trackColumns)
      .eq("user_id", context.userId)
      .eq("activity_id", activityId)
      .maybeSingle(),
  ]);
  if (activity.error || track.error) return { status: "error" };
  if (!activity.data) return { status: "missing" };
  const parsed = track.data ? parseTrack(track.data) : null;
  const view = parsed
    ? buildRouteView(parsed, { zones: null, bands: [], running: false })
    : null;
  if (!view) return { status: "no-track" };
  const raw: RawPoint[] = view.route.map(([lat, lon], index) => ({
    lat,
    lon,
    ele: view.elevation[index],
  }));
  const course = buildCourse(raw);
  if (!course) return { status: "no-track" };
  return storeCourse(context, raceId, course, {
    kind: "activity",
    activityId,
    name: activity.data.activity_name ?? "Activité Garmin",
  });
}

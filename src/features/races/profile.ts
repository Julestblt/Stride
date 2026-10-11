import { pointDistance, positionAt, type Course } from "./course";
import { formatClock, formatElapsed, formatKm } from "./format";
import type { WalkPortion } from "./grade";
import { glyphFor, rainWindows, type Glyph, type RaceWeather } from "./weather";
import {
  isSegmentBoundary,
  type Waypoint,
  type WaypointMark,
} from "./waypoints";
import type { RacePlanModel } from "./workspace";

export type ProfileMarker = {
  id: string;
  distanceM: number;
  ele: number | null;
  mark: WaypointMark;
  name: string;
  boundary: boolean;
  clock: string | null;
  cutoff: string | null;
  needsReview: boolean;
};

export type ProfileData = {
  distanceM: number;
  elevation: [distanceM: number, ele: number][];
  walk: WalkPortion[];
  night: { fromM: number; toM: number; label: string | null }[];
  rain: { fromM: number; toM: number }[];
  markers: ProfileMarker[];
  segments: { fromM: number; toM: number; km: string; detail: string }[];
  weather:
    | {
        distanceM: number;
        hour: string;
        glyph: Glyph;
        temperature: number;
        precipitation: number;
      }[]
    | null;
};

const profilePoints = 700;

export function profileData({
  course,
  waypoints,
  marks,
  portions,
  planned,
  weather,
}: {
  course: Course;
  waypoints: Waypoint[];
  marks: WaypointMark[];
  portions: WalkPortion[];
  planned: RacePlanModel | null;
  weather: RaceWeather | null;
}): ProfileData {
  const stride = Math.max(1, Math.floor(course.points.length / profilePoints));
  const elevation = course.points.flatMap((point, index) =>
    point[2] !== null &&
    (index % stride === 0 || index === course.points.length - 1)
      ? [[pointDistance(course, index), point[2]] as [number, number]]
      : [],
  );
  const start = planned?.simulation.passages[0]?.clockMinutes ?? null;
  const night = (planned?.nightKm ?? []).map((range, index) => {
    const window = planned!.night!.windows[index];
    return {
      ...range,
      label:
        window.fromSeconds > 0 && start !== null
          ? `Nuit · ${formatClock(start + window.fromSeconds / 60)}`
          : null,
    };
  });
  const rain = weather
    ? rainWindows(weather.slots).map((window) => {
        const next = weather.slots[weather.slots.indexOf(window.to) + 1];
        return {
          fromM: window.from.distanceM,
          toM: next ? next.distanceM : course.distanceM,
        };
      })
    : [];
  const markers = waypoints.map((waypoint, index): ProfileMarker => {
    const passage = planned?.simulation.passages[index];
    return {
      id: waypoint.id,
      distanceM: waypoint.distanceM,
      ele: positionAt(course, waypoint.distanceM).ele,
      mark: marks[index],
      name: waypoint.name,
      boundary: isSegmentBoundary(waypoint.kind),
      clock: passage ? formatClock(passage.clockMinutes) : null,
      cutoff:
        passage?.cutoffSeconds != null && start !== null
          ? formatClock(start + passage.cutoffSeconds / 60)
          : null,
      needsReview: waypoint.needsReview,
    };
  });
  const segments = (planned?.simulation.segments ?? []).map((segment) => ({
    fromM: segment.fromM,
    toM: segment.toM,
    km: `${formatKm(segment.toM - segment.fromM)} km`,
    detail: `${segment.gainM !== null ? `+${segment.gainM} m · ` : ""}${formatElapsed(segment.movingSeconds)}`,
  }));
  return {
    distanceM: course.distanceM,
    elevation,
    walk: portions,
    night,
    rain,
    markers,
    segments,
    weather: weather
      ? weather.slots.map((slot) => ({
          distanceM: slot.distanceM,
          hour: `${String(Math.floor((((slot.clockMinutes % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}h`,
          glyph: glyphFor(slot.code, slot.night),
          temperature: Math.round(slot.temperature),
          precipitation: Math.round(slot.precipitationProbability),
        }))
      : null,
  };
}

import { activityKind } from "./activities";
import { buildChartsView, type ChartsView } from "./charts";
import type { ActivityDetailData, ActivitySegment } from "./detail";
import {
  buildRouteView,
  effortBands,
  timeInZones,
  type ActivityTrack,
  type RouteView,
  type ZoneBounds,
} from "./track";

export type ActivityView = {
  route: RouteView | null;
  charts: ChartsView | null;
  zoneTime: ReturnType<typeof timeInZones>;
};

export function buildActivityView({
  activity,
  segments,
  track,
  zones,
}: {
  activity: ActivityDetailData;
  segments: ActivitySegment[];
  track: ActivityTrack | null;
  zones: ZoneBounds | null;
}): ActivityView {
  if (!track) return { route: null, charts: null, zoneTime: null };
  const laps = segments
    .filter((segment) => segment.type === "lap")
    .sort((a, b) => a.index - b.index);
  const running = activityKind(activity.type) !== "other";
  const overallPace =
    running && activity.distanceMeters && activity.durationSeconds
      ? activity.durationSeconds / (activity.distanceMeters / 1000)
      : null;
  const bands = effortBands(laps, overallPace);
  return {
    route: buildRouteView(track, { zones, bands: bands.distance, running }),
    charts: buildChartsView(track, { zones, bands: bands.time, running }),
    zoneTime: timeInZones(track.histogram, zones),
  };
}

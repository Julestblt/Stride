import "server-only";
import type { DebriefLap } from "@/features/plans/debrief/debrief";
import {
  buildDebriefView,
  type DebriefView,
} from "@/features/plans/debrief/view";
import type { ActivitySegment } from "@/features/activities/detail";
import { readActivityDetail } from "@/server/activities/activities";
import { readActivityFeeling } from "@/server/activities/feelings";
import type { OnboardingContext } from "@/server/onboarding/context";
import type { SessionMatch } from "./matches";
import { loadPlanOverview } from "./overview";
import { loadIntensityPaceRanges } from "./paces";

export type DebriefTarget = { sessionKey: string } | { activityId: string };

export function debriefLaps(segments: ActivitySegment[]): DebriefLap[] {
  return segments
    .filter((segment) => segment.type === "lap")
    .map((segment) => ({
      index: segment.index,
      durationSeconds: segment.durationSeconds,
      distanceMeters: segment.distanceMeters,
      averageHeartRate: segment.averageHeartRate,
    }));
}

export function isDebriefMatch(
  match: SessionMatch | undefined,
): match is SessionMatch & { activityId: string } {
  return (
    !!match?.activityId &&
    (match.status === "completed" || match.status === "partial")
  );
}

export async function loadSessionDebrief(
  context: OnboardingContext,
  target: DebriefTarget,
): Promise<DebriefView | null> {
  const overview = await loadPlanOverview(context);
  if (!overview) return null;
  const match = overview.matches.find((item) =>
    "sessionKey" in target
      ? item.sessionKey === target.sessionKey && isDebriefMatch(item)
      : item.activityId === target.activityId,
  );
  if (!isDebriefMatch(match)) return null;
  const session = overview.plan.state.sessions.find(
    (item) => item.sessionKey === match.sessionKey,
  );
  if (!session) return null;
  const [detail, paceRanges, athlete] = await Promise.all([
    readActivityDetail(context, match.activityId).catch(() => null),
    loadIntensityPaceRanges(context),
    readActivityFeeling(context, match.activityId),
  ]);
  if (!detail) return null;
  return buildDebriefView({
    session,
    activityId: match.activityId,
    laps: debriefLaps(detail.segments),
    paceRanges,
    match,
    garmin: {
      rpe: detail.activity.perceivedEffort,
      feel: detail.activity.feel,
    },
    athlete,
    averageHeartRate: detail.activity.averageHeartRate,
  });
}

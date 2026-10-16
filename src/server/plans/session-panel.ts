import "server-only";
import { buildSessionPanel } from "@/features/plans/view/session-panel";
import { readActivityDetail } from "@/server/activities/activities";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview } from "./overview";
import { loadIntensityPaceRanges } from "./paces";

export async function loadSessionPanel(
  context: OnboardingContext,
  sessionKey: string,
) {
  const [overview, paceRanges] = await Promise.all([
    loadPlanOverview(context),
    loadIntensityPaceRanges(context),
  ]);
  if (!overview) return null;
  const match = overview.matches.find((item) => item.sessionKey === sessionKey);
  const detail = match?.activityId
    ? await readActivityDetail(context, match.activityId).catch(() => null)
    : null;
  return buildSessionPanel({
    state: overview.plan.state,
    today: overview.today,
    sessionKey,
    matches: overview.matches,
    proposals: overview.proposals,
    activity: detail?.activity ?? null,
    laps: (detail?.segments ?? []).filter((segment) => segment.type === "lap"),
    series: detail?.track?.series ?? null,
    paceRanges,
  });
}

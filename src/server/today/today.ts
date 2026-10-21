import "server-only";
import { localToday } from "@/features/app-shell/shell";
import { buildProgram } from "@/features/plans/view/program";
import { buildToday, todaySessionKey } from "@/features/today/today";
import { listActivities } from "@/server/activities/activities";
import { pairQuestion } from "@/features/gear/check-view";
import { loadWatchView } from "@/server/garmin/watch";
import { loadPairChecks } from "@/server/gear/checks";
import { reconcileGearNotificationsAfterResponse } from "@/server/notifications/garmin";
import type { OnboardingContext } from "@/server/onboarding/context";
import {
  loadPlanOverview,
  programInput,
  readPlanRaces,
} from "@/server/plans/overview";
import { loadIntensityPaces } from "@/server/plans/paces";
import { loadSessionPanel } from "@/server/plans/session-panel";
import { loadRecovery } from "@/server/progress/recovery";

export async function loadToday(context: OnboardingContext, now: Date) {
  const [overview, paces, recovery, latest] = await Promise.all([
    loadPlanOverview(context),
    loadIntensityPaces(context),
    loadRecovery(context, localToday(now)),
    listActivities(context, "all", 1)
      .then(({ activities }) => activities[0] ?? null)
      .catch(() => null),
  ]);
  const today = overview?.today ?? localToday(now);
  const plan = overview?.plan.state ?? null;
  const sessionKey = todaySessionKey(plan, today);
  const [panel, races, , checks] = await Promise.all([
    sessionKey ? loadSessionPanel(context, sessionKey) : null,
    overview ? overview.races : readPlanRaces(context),
    loadWatchView(context, overview?.plan ?? null),
    loadPairChecks(context, latest?.id ?? null),
  ]);
  reconcileGearNotificationsAfterResponse(context, checks);
  const latestCheck = latest ? checks?.checks.get(latest.id) : null;
  return {
    checkin: recovery.checkin,
    pairQuestion:
      latestCheck && checks ? pairQuestion(latestCheck, checks.shoes) : null,
    view: buildToday({
      today,
      plan,
      program: overview ? buildProgram(programInput(overview, paces)) : null,
      races,
      matches: overview?.matches ?? [],
      panel,
      recovery,
      latest,
    }),
  };
}

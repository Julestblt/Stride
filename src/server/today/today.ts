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
import { loadSessionDebrief } from "@/server/plans/debrief";
import { loadSessionPanel } from "@/server/plans/session-panel";
import { readConditionReports } from "@/server/plans/health";
import { loadRecovery } from "@/server/progress/recovery";

export async function loadToday(context: OnboardingContext, now: Date) {
  const overviewRead = loadPlanOverview(context);
  const latestRead = listActivities(context, "all", 1)
    .then(({ activities }) => activities[0] ?? null)
    .catch(() => null);
  const [
    overview,
    paces,
    recovery,
    latest,
    panel,
    races,
    ,
    checks,
    debrief,
    conditions,
  ] = await Promise.all([
    overviewRead,
    loadIntensityPaces(context),
    loadRecovery(context, localToday(now)),
    latestRead,
    overviewRead.then((overview) => {
      const sessionKey = todaySessionKey(
        overview?.plan.state ?? null,
        overview?.today ?? localToday(now),
      );
      return sessionKey ? loadSessionPanel(context, sessionKey) : null;
    }),
    overviewRead.then((overview) =>
      overview ? overview.races : readPlanRaces(context),
    ),
    overviewRead.then((overview) =>
      loadWatchView(context, overview?.plan ?? null),
    ),
    latestRead.then((latest) => loadPairChecks(context, latest?.id ?? null)),
    latestRead.then((latest) =>
      latest
        ? loadSessionDebrief(context, { activityId: latest.id }).catch(
            () => null,
          )
        : null,
    ),
    readConditionReports(context, null).catch(() => []),
  ]);
  const today = overview?.today ?? localToday(now);
  const plan = overview?.plan.state ?? null;
  reconcileGearNotificationsAfterResponse(context, checks);
  const latestCheck = latest ? checks?.checks.get(latest.id) : null;
  return {
    view: buildToday({
      today,
      plan,
      program: overview ? buildProgram(programInput(overview, paces)) : null,
      races,
      matches: overview?.matches ?? [],
      panel,
      recovery,
      latest,
      debrief,
      pairQuestion:
        latestCheck && checks ? pairQuestion(latestCheck, checks.shoes) : null,
      pain: conditions.some(
        (condition) =>
          condition.kind === "pain" && condition.status === "active",
      ),
    }),
  };
}

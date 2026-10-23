import "server-only";
import { checkinHistoryDays } from "@/features/progress/body";
import { addDays } from "@/features/progress/period";
import { isQuality } from "@/features/plans/validation/input";
import { todaySessionKey } from "@/features/today/today";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview } from "@/server/plans/overview";
import { loadHealthDays } from "./health";
import { loadRecovery, readCheckinHistory } from "./recovery";

export async function loadBody(context: OnboardingContext, today: string) {
  const [recovery, days, checkins, overview] = await Promise.all([
    loadRecovery(context, today),
    loadHealthDays(context, today),
    readCheckinHistory(context, addDays(today, -(checkinHistoryDays - 1))),
    loadPlanOverview(context).catch(() => null),
  ]);
  const state = overview?.plan.state ?? null;
  const key = todaySessionKey(state, today);
  const session = key
    ? state?.sessions.find((item) => item.sessionKey === key)
    : undefined;
  return {
    recovery,
    days,
    checkins,
    session: session
      ? {
          sessionKey: session.sessionKey,
          title: session.title,
          hard: isQuality(session),
        }
      : null,
  };
}

import type { PlanSession } from "./plan";
import { structureTotals, type IntensityPaces } from "./structure";

export type SessionDistance = { meters: number; estimated: boolean };

const runningSports = new Set<PlanSession["sport"]>(["run", "trail"]);
const nonRunningKinds = new Set<PlanSession["kind"]>([
  "strength",
  "mobility",
  "cross",
  "rest",
]);

export function isRunningSession(session: PlanSession) {
  return runningSports.has(session.sport) && !nonRunningKinds.has(session.kind);
}

export function sessionDistance(
  session: PlanSession,
  paces: IntensityPaces | null = null,
): SessionDistance | null {
  if (!isRunningSession(session)) return null;
  if (session.targets.distanceMeters !== null)
    return { meters: session.targets.distanceMeters, estimated: false };
  const totals = structureTotals(session.structure, paces);
  return totals.distanceComplete && totals.distanceMeters > 0
    ? {
        meters: Math.round(totals.distanceMeters),
        estimated: totals.distanceEstimated,
      }
    : null;
}

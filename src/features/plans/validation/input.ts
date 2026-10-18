import { mondayOf } from "../model/dates";
import type { PlanSession, PlanState } from "../model/plan";
import { structureTotals } from "../model/structure";
import { thresholds } from "./thresholds";

export type ConstraintSpec =
  | { kind: "no_running"; from: string; to: string; source: string }
  | { kind: "no_quality"; from: string; to: string; source: string }
  | {
      kind: "max_session_minutes";
      from: string;
      to: string;
      minutes: number;
      source: string;
    };

export type ConditionReport = {
  kind: "pain" | "illness" | "fatigue" | "other";
  severity: number;
  status: "active" | "monitoring" | "resolved";
  worsening: boolean;
  systemicSymptoms: boolean;
  redFlag: boolean;
};

export type ReadinessDay = {
  date: string;
  level: "green" | "amber" | "red" | "unknown";
};

export type AthleteRace = {
  id: string;
  date: string;
  priority: "A" | "B" | "C";
  distanceKm: number | null;
};

export type ValidationInput = {
  candidate: PlanState;
  base: PlanState | null;
  versions: { expected: number; current: number } | null;
  today: string;
  matchedSessionKeys: ReadonlySet<string>;
  athlete: {
    availableWeekdays: number[] | null;
    weekdaySessionMinutes: number | null;
    maxWeeklyMinutes: number | null;
    unavailablePeriods: { startsOn: string; endsOn: string }[];
  };
  races: AthleteRace[];
  history: {
    runs: {
      date: string;
      durationSeconds: number;
      distanceMeters: number | null;
    }[];
    weeks: {
      weekStart: string;
      durationSeconds: number;
      elevationGainMeters: number | null;
    }[];
    provenWeeklySeconds?: number;
  };
  health: { conditions: ConditionReport[]; readiness: ReadinessDay[] } | null;
  load: { acuteChronicRatio: number | null; days: number } | null;
  demands: {
    longestRunMeters: number | null;
    weeklyElevationMeters: number | null;
    weeklyDurationSeconds: number | null;
    longBlockSeconds: number | null;
  } | null;
  specialistConstraints: ConstraintSpec[];
};

export const qualityKinds = new Set<PlanSession["kind"]>([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
]);

export function isRunning(session: PlanSession) {
  return session.sport === "run" || session.sport === "trail";
}

export function isQuality(session: PlanSession) {
  return isRunning(session) && qualityKinds.has(session.kind);
}

export function isUltraProfile(input: ValidationInput) {
  const primary = input.races.find(
    (race) => race.id === input.candidate.plan.primaryRaceId,
  );
  const painful = (input.health?.conditions ?? []).some(
    (condition) =>
      condition.kind === "pain" &&
      condition.status !== "resolved" &&
      condition.severity >= thresholds.painCautionSeverity,
  );
  return (primary?.distanceKm ?? 0) >= thresholds.ultraProfileKm && !painful;
}

export function sessionDistance(session: PlanSession) {
  if (session.targets.distanceMeters !== null)
    return session.targets.distanceMeters;
  const totals = structureTotals(session.structure);
  return totals.distanceComplete && totals.distanceMeters > 0
    ? totals.distanceMeters
    : null;
}

export function hardSeconds(session: PlanSession) {
  const { secondsByIntensity } = structureTotals(session.structure);
  return (
    secondsByIntensity.threshold +
    secondsByIntensity.interval +
    secondsByIntensity.repetition
  );
}

export type WeekLoad = {
  weekStart: string;
  durationSeconds: number;
  elevationGainMeters: number | null;
  planned: boolean;
};

export function plannedWeeks(state: PlanState): Map<string, PlanSession[]> {
  const weeks = new Map<string, PlanSession[]>();
  for (const session of state.sessions) {
    const weekStart = mondayOf(session.scheduledOn);
    weeks.set(weekStart, [...(weeks.get(weekStart) ?? []), session]);
  }
  return weeks;
}

export function weekLoads(input: ValidationInput): WeekLoad[] {
  const loads = new Map<string, WeekLoad>();
  for (const week of input.history.weeks)
    loads.set(week.weekStart, { ...week, planned: false });
  for (const [weekStart, sessions] of plannedWeeks(input.candidate)) {
    if (weekStart < mondayOf(input.today)) continue;
    const running = sessions.filter(
      (session) => isRunning(session) && session.kind !== "race",
    );
    const elevations = running.map(
      (session) => session.targets.elevationGainMeters,
    );
    loads.set(weekStart, {
      weekStart,
      durationSeconds: running.reduce(
        (total, session) => total + session.targets.durationSeconds,
        0,
      ),
      elevationGainMeters: elevations.some((value) => value !== null)
        ? elevations.reduce<number>((total, value) => total + (value ?? 0), 0)
        : null,
      planned: true,
    });
  }
  return [...loads.values()].sort((first, second) =>
    first.weekStart.localeCompare(second.weekStart),
  );
}

import type { PlanningConstraints } from "../constraints";
import {
  assessFeasibility,
  longestRunTargetMeters,
  type Feasibility,
} from "../feasibility/feasibility";
import {
  historyForValidation,
  summarizeHistory,
  type HistoryActivity,
} from "../history/summary";
import type { PlanState } from "../model/plan";
import {
  resolveObjective,
  type Objective,
  type ObjectiveRace,
} from "../skeleton/objective";
import { buildSkeleton, type SkeletonWarning } from "../skeleton/skeleton";
import {
  trainingTargets,
  type TargetsInput,
  type TrainingTargets,
} from "../targets/targets";
import type { ValidationReport } from "../validation/report";
import { validatePlan } from "../validation/validate";
import { detailPlan, type DetailingAvailability } from "./detailing";

export type DeterministicPlanInput = {
  today: string;
  races: ObjectiveRace[];
  activities: HistoryActivity[];
  availability: DetailingAvailability;
  constraints: PlanningConstraints;
  targets: Omit<TargetsInput, "today">;
  declaredWeeklyMinutes?: number | null;
  optimisticSeconds?: number | null;
};

export type DeterministicPlan =
  | {
      status: "ready";
      state: PlanState;
      report: ValidationReport;
      feasibility: Feasibility;
      targets: TrainingTargets;
      objective: Objective;
      warnings: SkeletonWarning[];
    }
  | {
      status: "too_short" | "no_history";
      feasibility: Feasibility;
      targets: TrainingTargets;
      objective: Objective;
    };

export function buildDeterministicPlan(
  input: DeterministicPlanInput,
): DeterministicPlan {
  const { today } = input;
  const summary = summarizeHistory(input.activities, today);
  const objective = resolveObjective({
    races: input.races,
    today,
    history: summary,
  });
  const targets = trainingTargets({ ...input.targets, today });
  const skeleton = buildSkeleton({
    today,
    objective,
    summary,
    availability: input.availability,
    constraints: input.constraints,
    declaredWeeklyMinutes: input.declaredWeeklyMinutes,
  });
  const feasibility = assessFeasibility({
    objective,
    skeleton,
    today,
    optimisticSeconds: input.optimisticSeconds,
  });
  if (skeleton.status !== "ready")
    return { status: skeleton.status, feasibility, targets, objective };

  const state = detailPlan({
    skeleton,
    targets,
    availability: input.availability,
    constraints: input.constraints,
  });
  const race = objective.race;
  const report = validatePlan({
    candidate: state,
    base: null,
    versions: null,
    today,
    matchedSessionKeys: new Set(),
    athlete: {
      availableWeekdays: input.availability.availableWeekdays,
      weekdaySessionMinutes: input.availability.weekdaySessionMinutes,
      maxWeeklyMinutes: input.constraints.maxWeeklyMinutes,
      unavailablePeriods: input.constraints.unavailablePeriods,
    },
    races: [...(race ? [race] : []), ...objective.otherRaces].map((item) => ({
      id: item.id,
      date: item.date,
      priority: item.priority,
      distanceKm: item.distanceKm,
    })),
    history: historyForValidation(input.activities, summary, today),
    health: null,
    load: null,
    demands: race
      ? {
          longestRunMeters: longestRunTargetMeters(race.distanceKm),
          weeklyElevationMeters: null,
          weeklyDurationSeconds: null,
        }
      : null,
    specialistConstraints: [],
  });
  return {
    status: "ready",
    state,
    report,
    feasibility,
    targets,
    objective,
    warnings: skeleton.warnings,
  };
}

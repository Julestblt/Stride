import type { SessionBlock } from "@/components/stride/session-blocks";
import { formatPace } from "@/features/progress/format";
import { addDays } from "../model/dates";
import type { PlanSession, PlanState } from "../model/plan";
import {
  structureTotals,
  type Intensity,
  type SimpleStep,
  type StructureStep,
} from "../model/structure";
import type { TrainingTargets } from "../targets/targets";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatStepDuration,
  formatTarget,
  intensityLabels,
  intensityTimeLabels,
  intensityZone,
  terrainLabels,
} from "./format";

const sessionsOf = (state: PlanState, weekStart: string) =>
  state.sessions.filter(
    (session) =>
      session.scheduledOn >= weekStart &&
      session.scheduledOn <= addDays(weekStart, 6),
  );

const training = (sessions: PlanSession[]) =>
  sessions.filter((session) => session.kind !== "race");

function flattenSteps(structure: StructureStep[]): SimpleStep[] {
  return structure.flatMap((step) =>
    step.type === "repeat"
      ? Array.from({ length: step.count }, () => step.steps).flat()
      : [step],
  );
}

const stepSeconds = (step: SimpleStep) =>
  step.end.kind === "time"
    ? step.end.seconds
    : (step.end.estimatedSeconds ?? 0);

export function sessionBlocks(session: PlanSession): SessionBlock[] {
  return flattenSteps(session.structure).map((step) => ({
    minutes: stepSeconds(step) / 60,
    zone: intensityZone[step.intensity],
  }));
}

const qualityKinds = new Set<PlanSession["kind"]>([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
]);

function workTime(session: PlanSession, intensity: Intensity) {
  return structureTotals(session.structure).secondsByIntensity[intensity];
}

function mainWork(session: PlanSession) {
  const work = flattenSteps(session.structure).filter(
    (step) => step.type === "work",
  );
  const hard = qualityKinds.has(session.kind);
  return (
    work.reduce<SimpleStep | null>((best, step) => {
      if (!best) return step;
      return hard
        ? intensityZone[step.intensity] > intensityZone[best.intensity]
          ? step
          : best
        : workTime(session, step.intensity) > workTime(session, best.intensity)
          ? step
          : best;
    }, null) ?? null
  );
}

const easyIntensities = new Set<Intensity>(["recovery", "easy"]);

export function weekStats(state: PlanState, weekStart: string) {
  const sessions = training(sessionsOf(state, weekStart));
  let easy = 0;
  let total = 0;
  for (const session of sessions) {
    const { secondsByIntensity } = structureTotals(session.structure);
    for (const [intensity, seconds] of Object.entries(secondsByIntensity)) {
      total += seconds;
      if (easyIntensities.has(intensity as Intensity)) easy += seconds;
    }
  }
  const elevations = sessions
    .map((session) => session.targets.elevationGainMeters)
    .filter((value): value is number => value !== null);
  const easyPct = total > 0 ? Math.round((easy / total) * 100) : 100;
  return {
    durationSeconds: sessions.reduce(
      (sum, session) => sum + session.targets.durationSeconds,
      0,
    ),
    elevationGainMeters:
      elevations.length > 0
        ? elevations.reduce((sum, value) => sum + value, 0)
        : null,
    easyPct,
    hardPct: 100 - easyPct,
  };
}

const stepNames: Record<SimpleStep["type"], string> = {
  warmup: "Échauffement",
  work: "Effort",
  recovery: "Récupération",
  cooldown: "Retour au calme",
};

export type StepView = {
  key: string;
  name: string;
  cue: string | null;
  duration: string;
  target: string;
  zone: 1 | 2 | 3 | 4 | 5;
};

export function stepViews(session: PlanSession): StepView[] {
  return session.structure.flatMap((step, index): StepView[] => {
    if (step.type !== "repeat")
      return [
        {
          key: `${index}`,
          name:
            step.type === "work"
              ? intensityLabels[step.intensity]
              : stepNames[step.type],
          cue: step.cue ?? null,
          duration: formatStepDuration(stepSeconds(step)),
          target: formatTarget(step.target),
          zone: intensityZone[step.intensity],
        },
      ];
    return step.steps.map((inner, position) => ({
      key: `${index}-${position}`,
      name:
        inner.type === "work"
          ? `${step.count} × ${intensityLabels[inner.intensity].toLowerCase()}`
          : `${stepNames[inner.type]} × ${step.count}`,
      cue: inner.cue ?? null,
      duration: `${step.count} × ${formatStepDuration(stepSeconds(inner))}`,
      target: formatTarget(inner.target),
      zone: intensityZone[inner.intensity],
    }));
  });
}

export type ChartSegment = {
  seconds: number;
  zone: 1 | 2 | 3 | 4 | 5;
  label: string | null;
};

export function chartSegments(session: PlanSession): ChartSegment[] {
  return flattenSteps(session.structure).map((step) => ({
    seconds: stepSeconds(step),
    zone: intensityZone[step.intensity],
    label:
      step.type === "recovery" || stepSeconds(step) < 120
        ? null
        : formatDuration(stepSeconds(step)),
  }));
}

export function sessionStats(
  session: PlanSession,
  targets: TrainingTargets | null = null,
) {
  const totals = structureTotals(session.structure);
  const work = mainWork(session);
  const hard = work && work.intensity !== "easy" ? work.intensity : null;
  const pace =
    work?.target.kind === "pace_range"
      ? `${formatPace(work.target.fastSecondsPerKm)}–${formatPace(work.target.slowSecondsPerKm)}`
      : null;
  const heartRate =
    work && targets
      ? (targets.intensities[work.intensity].heartRateRange ?? null)
      : null;
  return {
    total: formatDuration(session.targets.durationSeconds),
    distance:
      session.targets.distanceMeters !== null
        ? formatDistance(session.targets.distanceMeters)
        : totals.distanceComplete && totals.distanceMeters > 0
          ? `≈ ${formatDistance(totals.distanceMeters)}`
          : null,
    intensityTime: hard
      ? {
          seconds: totals.secondsByIntensity[hard],
          value: formatDuration(totals.secondsByIntensity[hard]),
          label: intensityTimeLabels[hard],
        }
      : null,
    pace,
    heartRate: heartRate ? `${heartRate.minBpm}–${heartRate.maxBpm}` : null,
    elevation:
      session.targets.elevationGainMeters !== null
        ? `${formatElevation(session.targets.elevationGainMeters)}`
        : null,
    terrain: session.terrain ? (terrainLabels[session.terrain] ?? null) : null,
  };
}

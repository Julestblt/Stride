import type { SessionBlock } from "@/components/stride/session-blocks";
import { formatPace } from "@/features/progress/format";
import type { PlanSession } from "../model/plan";
import {
  structureTotals,
  type Intensity,
  type IntensityPaces,
  type SimpleStep,
  type StructureStep,
} from "../model/structure";
import { isRunningSession, sessionDistance } from "../model/volume";
import {
  intensityPaces,
  type IntensityPaceRanges,
  type TrainingTargets,
} from "../targets/targets";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPaceRange,
  formatStepDuration,
  formatTarget,
  intensityLabels,
  intensityTimeLabels,
  intensityZone,
  terrainLabels,
} from "./format";

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

export function isFreeStep(session: PlanSession, step: SimpleStep) {
  return session.kind === "fartlek" && step.type === "work";
}

export function sessionBlocks(session: PlanSession): SessionBlock[] {
  return flattenSteps(session.structure).map((step) => ({
    minutes: stepSeconds(step) / 60,
    zone: intensityZone[step.intensity],
    ...(isFreeStep(session, step) ? { free: true } : {}),
  }));
}

const qualityKinds = new Set<PlanSession["kind"]>([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "fartlek",
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
  pace: string | null;
  zone: 1 | 2 | 3 | 4 | 5;
};

function expectedPace(
  step: SimpleStep,
  ranges: IntensityPaceRanges | null,
): string | null {
  if (step.target.kind === "pace_range") return null;
  const range = ranges?.[step.intensity];
  return range ? `≈ ${formatPaceRange(range)}` : null;
}

export function stepViews(
  session: PlanSession,
  paceRanges: IntensityPaceRanges | null = null,
): StepView[] {
  const ranges = isRunningSession(session) ? paceRanges : null;
  return session.structure.flatMap((step, index): StepView[] => {
    if (step.type !== "repeat")
      return [
        {
          key: `${index}`,
          name: isFreeStep(session, step)
            ? "Bloc fartlek"
            : step.type === "work"
              ? intensityLabels[step.intensity]
              : stepNames[step.type],
          cue: step.cue ?? null,
          duration: formatStepDuration(stepSeconds(step)),
          target: formatTarget(step.target),
          pace: isFreeStep(session, step)
            ? "sans allure"
            : expectedPace(step, ranges),
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
      pace: expectedPace(inner, ranges),
      zone: intensityZone[inner.intensity],
    }));
  });
}

export type ChartSegment = {
  seconds: number;
  zone: 1 | 2 | 3 | 4 | 5;
  label: string | null;
  free: boolean;
};

export function chartSegments(session: PlanSession): ChartSegment[] {
  return flattenSteps(session.structure).map((step) => {
    const free = isFreeStep(session, step);
    return {
      seconds: stepSeconds(step),
      zone: intensityZone[step.intensity],
      label:
        step.type === "recovery" || stepSeconds(step) < 120
          ? null
          : `${formatDuration(stepSeconds(step))}${free ? " au feeling" : ""}`,
      free,
    };
  });
}

export function sessionStats(
  session: PlanSession,
  targets: TrainingTargets | null = null,
  paces: IntensityPaces | null = targets ? intensityPaces(targets) : null,
) {
  const totals = structureTotals(session.structure);
  const distance = sessionDistance(session, paces);
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
    distance: distance
      ? `${distance.estimated ? "≈ " : ""}${formatDistance(distance.meters)}`
      : null,
    intensityTime: hard
      ? {
          seconds: totals.secondsByIntensity[hard],
          value: formatDuration(totals.secondsByIntensity[hard]),
          label: intensityTimeLabels[hard],
        }
      : null,
    pace,
    effort:
      work && isFreeStep(session, work) && work.target.kind === "rpe"
        ? `${work.target.min}–${work.target.max}/10`
        : null,
    heartRate: heartRate ? `${heartRate.minBpm}–${heartRate.maxBpm}` : null,
    elevation:
      session.targets.elevationGainMeters !== null
        ? `${formatElevation(session.targets.elevationGainMeters)}`
        : null,
    terrain: session.terrain ? (terrainLabels[session.terrain] ?? null) : null,
  };
}

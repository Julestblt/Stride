import { formatClock, formatPace } from "@/features/progress/format";
import type { PlanSession } from "../model/plan";
import { flatten } from "../model/structure";
import type { IntensityPaceRanges } from "../targets/targets";
import {
  formatDistance,
  formatDuration,
  formatStepDuration,
  intensityLabels,
  intensityZone,
} from "../view/format";
import {
  buildDebrief,
  feelLabels,
  type AthleteFeeling,
  type DebriefFeeling,
  type DebriefLap,
  type DebriefMatch,
  type FeelingSource,
  type FeelValue,
  type StepRating,
  type StepResult,
  type Verdict,
} from "./debrief";

export type DebriefStatusTone = "success" | "warning" | "danger";

export type DebriefStepView = {
  key: string;
  compact: boolean;
  name: string;
  detail: string | null;
  target: string;
  actual: string;
  actualTone: "default" | "danger" | "warning";
  status: { label: string; tone: DebriefStatusTone; chip: boolean } | null;
  zone: 1 | 2 | 3 | 4 | 5;
};

export type DebriefFeelingView = {
  source: FeelingSource;
  sourceLabel: string;
  effort: string | null;
  effortLabel: string;
  feel: string | null;
  value: { effort: number | null; feel: FeelValue | null };
};

export type DebriefView = {
  sessionKey: string;
  activityId: string;
  sessionTitle: string;
  aligned: boolean;
  verdict: Verdict;
  alignment: string | null;
  note: string | null;
  steps: DebriefStepView[];
  feeling: DebriefFeelingView | null;
  coachHref: string;
  planHref: string;
};

export type DebriefViewInput = {
  session: PlanSession;
  activityId: string;
  laps: DebriefLap[];
  paceRanges: IntensityPaceRanges | null;
  match: DebriefMatch;
  garmin: { rpe: number | null; feel: number | null };
  athlete: AthleteFeeling | null;
  averageHeartRate?: number | null;
};

const stepNames = {
  warmup: "Échauffement",
  recovery: "Récupération",
  cooldown: "Retour au calme",
} as const;

const ratingStatus: Record<
  Exclude<StepRating, "unrated">,
  { label: string; tone: DebriefStatusTone }
> = {
  in_range: { label: "Dans la cible", tone: "success" },
  too_fast: { label: "Trop vite", tone: "danger" },
  too_slow: { label: "Trop lent", tone: "warning" },
  cut_short: { label: "Écourtée", tone: "warning" },
};

export function effortWord(effort: number) {
  if (effort <= 2) return "très facile";
  if (effort <= 4) return "facile";
  if (effort <= 6) return "modéré";
  if (effort <= 8) return "difficile";
  if (effort <= 9) return "très difficile";
  return "maximal";
}

function stepName(step: StepResult) {
  if (step.type !== "work") return stepNames[step.type];
  if (step.free) return "Bloc fartlek";
  const label = intensityLabels[step.intensity];
  return step.workCount > 1 ? `${label} ${step.workIndex}` : label;
}

function planned(step: StepResult) {
  if (step.end === "distance" && step.plannedMeters !== null)
    return formatDistance(step.plannedMeters);
  if (step.plannedSeconds === null) return "–";
  return step.plannedSeconds % 60 === 0
    ? formatDuration(step.plannedSeconds)
    : formatStepDuration(step.plannedSeconds);
}

function actualAmount(step: StepResult) {
  if (step.end === "distance" && step.actualMeters !== null)
    return formatDistance(step.actualMeters);
  return step.actualSeconds !== null ? formatClock(step.actualSeconds) : "–";
}

function workDetail(step: StepResult) {
  const plannedAmount =
    step.end === "distance"
      ? step.plannedMeters !== null
        ? formatDistance(step.plannedMeters)
        : null
      : step.plannedSeconds !== null
        ? formatStepDuration(step.plannedSeconds)
        : null;
  const done =
    step.rating === "cut_short" && plannedAmount
      ? `${actualAmount(step)} sur ${plannedAmount}`
      : actualAmount(step);
  return [
    done,
    step.averageHeartRate !== null
      ? `FC ${Math.round(step.averageHeartRate)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function stepView(step: StepResult): DebriefStepView {
  const zone = intensityZone[step.intensity];
  if (step.type !== "work")
    return {
      key: step.key,
      compact: step.type === "recovery",
      name: stepName(step),
      detail: null,
      target: planned(step),
      actual: actualAmount(step),
      actualTone: "default",
      status:
        step.type === "recovery"
          ? null
          : { label: "Fait", tone: "success", chip: false },
      zone,
    };
  const rating = step.rating ?? "unrated";
  const status =
    rating === "unrated"
      ? { label: "Fait", tone: "success" as const, chip: false }
      : { ...ratingStatus[rating], chip: true };
  if (step.target?.kind === "pace" && step.actualPace !== null)
    return {
      key: step.key,
      compact: false,
      name: stepName(step),
      detail: workDetail(step),
      target: `${formatPace(step.target.fastSecondsPerKm)}–${formatPace(step.target.slowSecondsPerKm)}`,
      actual: formatPace(step.actualPace),
      actualTone:
        rating === "too_fast"
          ? "danger"
          : rating === "too_slow"
            ? "warning"
            : "default",
      status,
      zone,
    };
  if (step.target?.kind === "heart_rate" && step.averageHeartRate !== null)
    return {
      key: step.key,
      compact: false,
      name: stepName(step),
      detail: actualAmount(step),
      target: `FC ${step.target.minBpm}–${step.target.maxBpm}`,
      actual: `FC ${Math.round(step.averageHeartRate)}`,
      actualTone:
        rating === "too_fast"
          ? "danger"
          : rating === "too_slow"
            ? "warning"
            : "default",
      status,
      zone,
    };
  return {
    key: step.key,
    compact: false,
    name: stepName(step),
    detail:
      step.averageHeartRate !== null
        ? `FC ${Math.round(step.averageHeartRate)}`
        : null,
    target: planned(step),
    actual: actualAmount(step),
    actualTone: "default",
    status,
    zone,
  };
}

export function feelingView(feeling: DebriefFeeling): DebriefFeelingView {
  return {
    source: feeling.source,
    sourceLabel:
      feeling.source === "garmin" ? "Saisi sur ta montre" : "Noté par toi",
    effort: feeling.effort !== null ? `${feeling.effort} / 10` : null,
    effortLabel:
      feeling.effort !== null
        ? `Effort perçu · ${effortWord(feeling.effort)}`
        : "Effort perçu",
    feel: feeling.feel !== null ? feelLabels[feeling.feel] : null,
    value: { effort: feeling.effort, feel: feeling.feel },
  };
}

export function buildDebriefView(input: DebriefViewInput): DebriefView | null {
  const debrief = buildDebrief(input);
  if (!debrief) return null;
  const stepCount = flatten(input.session.structure).length;
  const lapCount = input.laps.length;
  return {
    sessionKey: input.session.sessionKey,
    activityId: input.activityId,
    sessionTitle: input.session.title,
    aligned: debrief.aligned,
    verdict: debrief.verdict,
    alignment: !debrief.aligned
      ? null
      : debrief.steps.length === 1
        ? "1 tour aligné sur l’étape"
        : `${debrief.steps.length} tours alignés sur les ${debrief.steps.length} étapes`,
    note:
      debrief.aligned || stepCount <= 1
        ? null
        : lapCount === 0
          ? "Garmin n’a transmis aucun tour pour cette activité. Le débrief compare donc la séance dans son ensemble."
          : "Tes tours ne correspondent pas aux étapes de la séance. Le débrief compare donc la séance dans son ensemble.",
    steps: debrief.steps.map(stepView),
    feeling: debrief.feeling ? feelingView(debrief.feeling) : null,
    coachHref: `/coach/nouvelle?seance=${encodeURIComponent(input.session.sessionKey)}`,
    planHref: `/plan?seance=${encodeURIComponent(input.session.sessionKey)}`,
  };
}

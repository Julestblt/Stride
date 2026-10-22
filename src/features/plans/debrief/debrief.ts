import { z } from "zod";
import { formatClock, formatDecimal } from "@/features/progress/format";
import type { MatchStatus } from "../matching/adherence";
import type { PlanSession } from "../model/plan";
import { flatten, stepSeconds, type SimpleStep } from "../model/structure";
import { isRunningSession } from "../model/volume";
import type { IntensityPaceRanges } from "../targets/targets";

export const paceToleranceSeconds = 3;
export const cutShortRatio = 0.9;
export const trailingLapSeconds = 60;
export const intensityTolerance = 0.05;

export type DebriefLap = {
  index: number;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averageHeartRate: number | null;
};

export type StepRating =
  "in_range" | "too_fast" | "too_slow" | "cut_short" | "unrated";

export type StepTarget =
  | { kind: "pace"; fastSecondsPerKm: number; slowSecondsPerKm: number }
  | { kind: "heart_rate"; minBpm: number; maxBpm: number }
  | null;

export type StepResult = {
  key: string;
  type: SimpleStep["type"];
  intensity: SimpleStep["intensity"];
  workIndex: number | null;
  workCount: number;
  free: boolean;
  end: SimpleStep["end"]["kind"];
  target: StepTarget;
  plannedSeconds: number | null;
  plannedMeters: number | null;
  actualSeconds: number | null;
  actualMeters: number | null;
  actualPace: number | null;
  averageHeartRate: number | null;
  rating: StepRating | null;
};

export type VerdictTone = "success" | "warning";

export type Verdict = { tone: VerdictTone; title: string; body: string };

export const feelValues = [0, 25, 50, 75, 100] as const;
export type FeelValue = (typeof feelValues)[number];

export const activityFeelingSchema = z.strictObject({
  activityId: z.uuid(),
  effort: z.number().int().min(1).max(10),
  feel: z.union(feelValues.map((value) => z.literal(value))),
});

export const feelLabels: Record<FeelValue, string> = {
  0: "Très mal",
  25: "Mal",
  50: "Normal",
  75: "Bien",
  100: "Très bien",
};

export type FeelingSource = "garmin" | "athlete";

export type DebriefFeeling = {
  source: FeelingSource;
  effort: number | null;
  feel: FeelValue | null;
};

export type GarminFeeling = { rpe: number | null; feel: number | null };
export type AthleteFeeling = { effort: number; feel: number | null };

export type DebriefMatch = {
  status: MatchStatus;
  compliance: { duration: number | null; intensity: number | null };
};

export type Debrief = {
  aligned: boolean;
  steps: StepResult[];
  verdict: Verdict;
  feeling: DebriefFeeling | null;
};

export type DebriefInput = {
  session: PlanSession;
  laps: DebriefLap[];
  paceRanges: IntensityPaceRanges | null;
  match: DebriefMatch;
  garmin: GarminFeeling;
  athlete: AthleteFeeling | null;
  averageHeartRate?: number | null;
};

export function alignSteps(
  steps: readonly SimpleStep[],
  laps: readonly DebriefLap[],
): DebriefLap[] | null {
  if (steps.length === 0 || laps.length === 0) return null;
  const ordered = [...laps].sort((first, second) => first.index - second.index);
  if (ordered.length === steps.length) return ordered;
  const last = ordered.at(-1)!;
  if (
    ordered.length === steps.length + 1 &&
    last.durationSeconds !== null &&
    last.durationSeconds <= trailingLapSeconds
  )
    return ordered.slice(0, -1);
  return null;
}

function lapPace(lap: DebriefLap) {
  return lap.durationSeconds && lap.distanceMeters && lap.distanceMeters > 0
    ? lap.durationSeconds / (lap.distanceMeters / 1000)
    : null;
}

export function stepTarget(
  step: SimpleStep,
  paceRanges: IntensityPaceRanges | null,
): StepTarget {
  if (step.target.kind === "pace_range")
    return {
      kind: "pace",
      fastSecondsPerKm: step.target.fastSecondsPerKm,
      slowSecondsPerKm: step.target.slowSecondsPerKm,
    };
  if (step.target.kind === "heart_rate_range")
    return {
      kind: "heart_rate",
      minBpm: step.target.minBpm,
      maxBpm: step.target.maxBpm,
    };
  const range = paceRanges?.[step.intensity];
  return range ? { kind: "pace", ...range } : null;
}

function isCutShort(step: SimpleStep, lap: DebriefLap) {
  if (step.end.kind === "time")
    return (
      lap.durationSeconds !== null &&
      lap.durationSeconds < step.end.seconds * cutShortRatio
    );
  if (step.end.kind === "distance")
    return (
      lap.distanceMeters !== null &&
      lap.distanceMeters < step.end.meters * cutShortRatio
    );
  return false;
}

export function rateStep(
  step: SimpleStep,
  lap: DebriefLap,
  target: StepTarget,
): StepRating | null {
  if (step.type !== "work") return null;
  if (isCutShort(step, lap)) return "cut_short";
  if (target?.kind === "heart_rate") {
    const heartRate = lap.averageHeartRate;
    if (heartRate === null) return "unrated";
    if (heartRate > target.maxBpm) return "too_fast";
    if (heartRate < target.minBpm) return "too_slow";
    return "in_range";
  }
  if (target?.kind === "pace") {
    const pace = lapPace(lap);
    if (pace === null) return "unrated";
    if (pace < target.fastSecondsPerKm - paceToleranceSeconds)
      return "too_fast";
    if (pace > target.slowSecondsPerKm + paceToleranceSeconds)
      return "too_slow";
    return "in_range";
  }
  return "unrated";
}

function stepResults(
  session: PlanSession,
  steps: SimpleStep[],
  laps: DebriefLap[],
  paceRanges: IntensityPaceRanges | null,
): StepResult[] {
  const workCount = steps.filter((step) => step.type === "work").length;
  let work = 0;
  return steps.map((step, index) => {
    const lap = laps[index];
    const free = session.kind === "fartlek" && step.type === "work";
    const target = free ? null : stepTarget(step, paceRanges);
    if (step.type === "work") work += 1;
    return {
      key: `${index}`,
      type: step.type,
      intensity: step.intensity,
      workIndex: step.type === "work" ? work : null,
      workCount,
      free,
      end: step.end.kind,
      target,
      plannedSeconds: stepSeconds(step),
      plannedMeters: step.end.kind === "distance" ? step.end.meters : null,
      actualSeconds: lap.durationSeconds,
      actualMeters: lap.distanceMeters,
      actualPace: lapPace(lap),
      averageHeartRate: lap.averageHeartRate,
      rating: rateStep(step, lap, target),
    };
  });
}

function fractions(count: number, total: number) {
  return `${count} fraction${count > 1 ? "s" : ""} sur ${total}`;
}

function cutText(step: StepResult) {
  const reached =
    step.end === "distance"
      ? step.actualMeters !== null && step.plannedMeters !== null
        ? `${formatDecimal(step.actualMeters / 1000)} km sur ${formatDecimal(step.plannedMeters / 1000)} km`
        : null
      : step.actualSeconds !== null && step.plannedSeconds !== null
        ? `${formatClock(step.actualSeconds)} sur ${formatClock(step.plannedSeconds)}`
        : null;
  const subject =
    step.workCount > 1
      ? `La fraction ${step.workIndex} s’est arrêtée`
      : "L’effort s’est arrêté";
  return reached ? `${subject} à ${reached}.` : `${subject} avant la fin.`;
}

function alignedVerdict(steps: StepResult[]): Verdict {
  const work = steps.filter((step) => step.type === "work");
  const single = work.length === 1;
  const cut = work.filter((step) => step.rating === "cut_short");
  const rated = work.filter(
    (step) =>
      step.rating === "in_range" ||
      step.rating === "too_fast" ||
      step.rating === "too_slow",
  );
  const fast = rated.filter((step) => step.rating === "too_fast").length;
  const slow = rated.filter((step) => step.rating === "too_slow").length;
  const inRange = rated.length - fast - slow;
  if (cut.length > 0)
    return {
      tone: "warning",
      title: "Séance écourtée",
      body: [
        cut.length === 1
          ? cutText(cut[0])
          : `${fractions(cut.length, work.length)} écourtées.`,
        fast > 0 && !single
          ? `${fractions(fast, rated.length)} plus vite que la cible.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    };
  if (rated.length > 0 && fast * 2 >= rated.length)
    return {
      tone: "warning",
      title: single ? "Allure trop rapide" : "Fractions trop rapides",
      body: single
        ? "Effort plus rapide que la cible."
        : `${fractions(fast, rated.length)} plus vite que la cible.`,
    };
  if (rated.length > 0 && slow * 2 >= rated.length)
    return {
      tone: "warning",
      title: single ? "Allure trop lente" : "Fractions trop lentes",
      body: single
        ? "Effort plus lent que la cible."
        : `${fractions(slow, rated.length)} plus lentement que la cible.`,
    };
  return {
    tone: "success",
    title: "Séance réussie",
    body:
      rated.length === 0
        ? "Toutes les étapes faites comme prévu."
        : single
          ? "Effort dans la cible."
          : `${fractions(inRange, rated.length)} dans la cible.`,
  };
}

function overallVerdict(match: DebriefMatch, heartRate: boolean): Verdict {
  const { duration, intensity } = match.compliance;
  if (match.status === "partial")
    return {
      tone: "warning",
      title: "Séance écourtée",
      body:
        duration !== null
          ? `${Math.round(duration * 100)} % de la durée prévue.`
          : "Séance arrêtée avant la fin.",
    };
  if (heartRate && intensity !== null && intensity > 1 + intensityTolerance)
    return {
      tone: "warning",
      title: "Effort trop intense",
      body: "Fréquence cardiaque moyenne au-dessus de la cible.",
    };
  if (heartRate && intensity !== null && intensity < 1 - intensityTolerance)
    return {
      tone: "warning",
      title: "Effort trop facile",
      body: "Fréquence cardiaque moyenne sous la cible.",
    };
  if (!heartRate && intensity !== null && intensity < 1 - intensityTolerance)
    return {
      tone: "warning",
      title: "Allure trop rapide",
      body: "Allure moyenne plus rapide que prévu.",
    };
  if (!heartRate && intensity !== null && intensity > 1 + intensityTolerance)
    return {
      tone: "warning",
      title: "Allure trop lente",
      body: "Allure moyenne plus lente que prévu.",
    };
  return {
    tone: "success",
    title: "Séance réussie",
    body: "Durée et allure moyenne dans ce qui était prévu.",
  };
}

export function buildVerdict(
  steps: StepResult[] | null,
  match: DebriefMatch,
  heartRate = false,
): Verdict {
  return steps ? alignedVerdict(steps) : overallVerdict(match, heartRate);
}

export function nearestFeel(value: number): FeelValue {
  return feelValues.reduce((best, item) =>
    Math.abs(item - value) < Math.abs(best - value) ? item : best,
  );
}

function garminEffort(rpe: number | null) {
  if (rpe === null || !Number.isFinite(rpe) || rpe <= 0) return null;
  const value = Math.round(rpe > 10 ? rpe / 10 : rpe);
  return value >= 1 && value <= 10 ? value : null;
}

export function normalizeFeeling(
  garmin: GarminFeeling,
  athlete: AthleteFeeling | null,
): DebriefFeeling | null {
  const effort = garminEffort(garmin.rpe);
  const feel =
    garmin.feel !== null &&
    Number.isFinite(garmin.feel) &&
    garmin.feel >= 0 &&
    garmin.feel <= 100
      ? nearestFeel(garmin.feel)
      : null;
  if (effort !== null || feel !== null)
    return { source: "garmin", effort, feel };
  if (!athlete) return null;
  return {
    source: "athlete",
    effort: athlete.effort,
    feel: athlete.feel === null ? null : nearestFeel(athlete.feel),
  };
}

export function buildDebrief(input: DebriefInput): Debrief | null {
  const { session } = input;
  if (!isRunningSession(session)) return null;
  const steps = flatten(session.structure);
  const laps = alignSteps(steps, input.laps);
  const results = laps
    ? stepResults(session, steps, laps, input.paceRanges)
    : null;
  return {
    aligned: results !== null,
    steps: results ?? [],
    verdict: buildVerdict(
      results,
      input.match,
      steps.some((step) => step.target.kind === "heart_rate_range") &&
        input.averageHeartRate !== null &&
        input.averageHeartRate !== undefined,
    ),
    feeling: normalizeFeeling(input.garmin, input.athlete),
  };
}

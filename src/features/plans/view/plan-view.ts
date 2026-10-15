import type { SessionBlock } from "@/components/stride/session-blocks";
import { formatPace } from "@/features/progress/format";
import { addDays } from "../model/dates";
import type { PlanSession, PlanState, PlanWeek } from "../model/plan";
import {
  structureTotals,
  type Intensity,
  type SimpleStep,
  type StructureStep,
} from "../model/structure";
import type { TrainingTargets } from "../targets/targets";
import type { RuleId, ValidationReport } from "../validation/report";
import {
  formatDayLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatStepDuration,
  formatTarget,
  formatWeekdayShort,
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

export function defaultWeekStart(state: PlanState, today: string) {
  return (
    state.weeks.find(
      (week) => week.weekStart <= today && today <= addDays(week.weekStart, 6),
    )?.weekStart ??
    state.weeks.find((week) => week.weekStart > today)?.weekStart ??
    state.weeks[0].weekStart
  );
}

export function weekPosition(state: PlanState, weekStart: string) {
  const index = state.weeks.findIndex((week) => week.weekStart === weekStart);
  const week = state.weeks[index];
  const block = state.blocks.find((item) => item.blockKey === week.blockKey)!;
  const inBlock = state.weeks.filter(
    (item) => item.blockKey === block.blockKey,
  );
  return {
    week,
    block,
    number: inBlock.findIndex((item) => item.weekStart === weekStart) + 1,
    count: inBlock.length,
    previous: state.weeks[index - 1]?.weekStart ?? null,
    next: state.weeks[index + 1]?.weekStart ?? null,
    blockWeeks: inBlock.map((item) => item.weekStart),
  };
}

const weekTypeLabels: Partial<Record<PlanWeek["weekType"], string>> = {
  recovery: "allégée",
  race: "course",
  post_race: "récup",
};

export type PlanNavBlock = {
  blockKey: string;
  name: string;
  weeks: {
    weekStart: string;
    label: string;
    detail: string | null;
    durationSeconds: number;
    current: boolean;
  }[];
};

export function planNavigation(
  state: PlanState,
  today: string,
): PlanNavBlock[] {
  return state.blocks.map((block) => ({
    blockKey: block.blockKey,
    name: block.name,
    weeks: state.weeks
      .filter((week) => week.blockKey === block.blockKey)
      .map((week, index) => ({
        weekStart: week.weekStart,
        label: `Semaine ${index + 1}`,
        detail: weekTypeLabels[week.weekType] ?? null,
        durationSeconds: training(sessionsOf(state, week.weekStart)).reduce(
          (total, session) => total + session.targets.durationSeconds,
          0,
        ),
        current: week.weekStart <= today && today <= addDays(week.weekStart, 6),
      })),
  }));
}

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

export function sessionSummary(session: PlanSession) {
  const parts = [formatDuration(session.targets.durationSeconds)];
  if (session.kind === "race") {
    if (session.targets.distanceMeters)
      parts[0] = formatDistance(session.targets.distanceMeters);
  } else {
    const work = mainWork(session);
    if (work) parts.push(formatTarget(work.target));
  }
  if (session.targets.elevationGainMeters)
    parts.push(`${formatElevation(session.targets.elevationGainMeters)} D+`);
  return parts.join(" · ");
}

const ruleMessages: Partial<Record<RuleId, string>> = {
  E1: "Nettement plus longue que ta plus longue sortie des 30 derniers jours.",
  E2: "Plus longue que ta plus longue sortie des 30 derniers jours.",
  P3: "La sortie longue dépasse 35 % du volume de la semaine.",
  P4: "Séance de qualité rapprochée d’une autre ou de la sortie longue.",
  P7: "Séance placée trop près d’une course.",
  C1: "Placée un jour où tu n’es pas disponible.",
  C2: "Dépasse la durée que tu as déclarée.",
};

export function sessionWarnings(report: ValidationReport, key: string) {
  return report.results
    .filter(
      (result) =>
        result.outcome === "fail" &&
        result.keys.includes(key) &&
        ruleMessages[result.ruleId],
    )
    .map((result) => ruleMessages[result.ruleId]!);
}

export type SessionRowView = {
  key: string;
  date: string;
  dayLabel: string;
  title: string;
  summary: string;
  blocks: SessionBlock[];
  isRace: boolean;
  warnings: string[];
};

export function sessionRows(
  state: PlanState,
  weekStart: string,
  report: ValidationReport | null = null,
): SessionRowView[] {
  return sessionsOf(state, weekStart).map((session) => ({
    key: session.sessionKey,
    date: session.scheduledOn,
    dayLabel: formatDayLabel(session.scheduledOn),
    title: session.title,
    summary: sessionSummary(session),
    blocks: sessionBlocks(session),
    isRace: session.kind === "race",
    warnings: report ? sessionWarnings(report, session.sessionKey) : [],
  }));
}

export type DayBar = {
  date: string;
  label: string;
  isToday: boolean;
  isRace: boolean;
  totalSeconds: number;
  segments: { zone: 1 | 2 | 3 | 4 | 5; seconds: number }[];
};

export function weekDays(
  state: PlanState,
  weekStart: string,
  today: string,
): DayBar[] {
  const sessions = sessionsOf(state, weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const daySessions = sessions.filter((item) => item.scheduledOn === date);
    const segments = daySessions
      .filter((session) => session.kind !== "race")
      .flatMap((session) =>
        flattenSteps(session.structure).map((step) => ({
          zone: intensityZone[step.intensity],
          seconds: stepSeconds(step),
        })),
      );
    return {
      date,
      label: formatWeekdayShort(date).toUpperCase(),
      isToday: date === today,
      isRace: daySessions.some((session) => session.kind === "race"),
      totalSeconds: segments.reduce((total, item) => total + item.seconds, 0),
      segments,
    };
  });
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

const plural = (count: number, one: string, many: string) =>
  `${count === 1 ? "une" : count === 2 ? "deux" : count === 3 ? "trois" : String(count)} ${count === 1 ? one : many}`;

export function weekSummary(state: PlanState, weekStart: string) {
  const { week } = weekPosition(state, weekStart);
  const sessions = sessionsOf(state, weekStart);
  const race = sessions.find((session) => session.kind === "race");
  const quality = sessions.filter((session) => qualityKinds.has(session.kind));
  const long = sessions.find((session) => session.kind === "long");
  const parts: string[] = [];
  if (quality.length > 0)
    parts.push(
      plural(quality.length, "séance de qualité", "séances de qualité"),
    );
  if (long)
    parts.push(
      long.sport === "trail" ? "une sortie longue trail" : "une sortie longue",
    );
  if (race) parts.push(`la course : ${race.title}`);
  const lead =
    parts.length > 0
      ? `${parts.join(", ").replace(/^./, (letter) => letter.toUpperCase())}.`
      : sessions.length > 0
        ? "Footings faciles uniquement."
        : "Aucune séance prévue cette semaine.";
  const notes: Partial<Record<PlanWeek["weekType"], string>> = {
    recovery: "Semaine allégée pour assimiler le travail.",
    taper: "Affûtage : moins de volume, un peu d’intensité.",
    race: "Semaine de course : arrive frais.",
    post_race: "Récupération après la course.",
  };
  return [lead, notes[week.weekType]].filter(Boolean).join(" ");
}

export function restDays(state: PlanState, weekStart: string) {
  const used = new Set(
    sessionsOf(state, weekStart).map((session) => session.scheduledOn),
  );
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    .filter((date) => !used.has(date))
    .map(formatWeekdayShort);
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

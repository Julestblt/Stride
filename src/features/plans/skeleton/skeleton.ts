import type { PlanningConstraints } from "../constraints";
import type { HistorySummary } from "../history/summary";
import { minimumHeldSeconds } from "../history/summary";
import { addDays, isMonday, mondayOf } from "../model/dates";
import { blockKey, weekKey } from "../model/keys";
import type {
  PlanBlock,
  PlanSession,
  PlanState,
  PlanWeek,
} from "../model/plan";
import type { Intensity } from "../model/structure";
import {
  peakFactor,
  resolveTemplateWeeks,
  type PhaseId,
  type PlanTemplate,
  type TemplatePhase,
} from "../templates/templates";
import type { Objective, ObjectiveRace } from "./objective";

export const leadInRampRatio = 1.04;
export const progressionCapRatio = 1.1;
export const baseBuildingWeeks = 12;
export const otherRaceWeekFactor = 0.85;
export const afterOtherRaceWeekFactor = 0.9;
const fallbackPaceSecondsPerKm = 360;

export type Availability = {
  availableWeekdays: number[] | null;
  weekdaySessionMinutes: number | null;
  longRunDay: "saturday" | "sunday" | "flexible" | null;
};

export type SkeletonInput = {
  today: string;
  objective: Objective;
  summary: HistorySummary;
  availability: Availability;
  constraints: PlanningConstraints;
  declaredWeeklyMinutes?: number | null;
};

export type SkeletonWarning =
  | { code: "peak_capped_by_ceiling"; peakSeconds: number }
  | { code: "peak_below_template"; peakSeconds: number; minimumSeconds: number }
  | { code: "availability_cap"; weekStarts: string[] }
  | { code: "unavailable_week"; weekStarts: string[] };

export type Skeleton =
  | {
      status: "too_short";
      weeksAvailable: number;
      minimumWeeks: number;
      template: PlanTemplate;
    }
  | { status: "no_history" }
  | {
      status: "ready";
      state: PlanState;
      template: PlanTemplate;
      leadInWeeks: number;
      templateWeeks: number;
      held: { durationSeconds: number; elevationGainMeters: number | null };
      peak: { durationSeconds: number; elevationGainMeters: number | null };
      paceSecondsPerKm: number | null;
      warnings: SkeletonWarning[];
    };

type DraftWeek = {
  weekStart: string;
  phaseId: PhaseId | "lead_in";
  phase: TemplatePhase;
  weekType: PlanWeek["weekType"];
  durationSeconds: number;
  elevationGainMeters: number | null;
  qualitySessions: number;
};

export function planStart(today: string) {
  return isMonday(today) ? today : addDays(mondayOf(today), 7);
}

export function weeksBetween(first: string, last: string) {
  return (
    Math.round(
      (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
        (7 * 86_400_000),
    ) + 1
  );
}

function leadInWeeks(
  count: number,
  history: number[],
  held: number,
  template: PlanTemplate,
  ceilingSeconds: number | null,
) {
  const series = [...history];
  const volumes: { duration: number; lighter: boolean }[] = [];
  let lastFull = held;
  for (let index = 1; index <= count; index += 1) {
    const lighter =
      index % template.lighterWeek.everyWeeks === 0 && index < count;
    let duration: number;
    if (lighter) duration = lastFull * template.lighterWeek.volumeFactor;
    else {
      const recent = series.slice(-4);
      const mean =
        recent.length > 0
          ? recent.reduce((total, value) => total + value, 0) / recent.length
          : lastFull;
      duration = Math.min(
        lastFull * leadInRampRatio,
        mean * progressionCapRatio,
      );
      if (ceilingSeconds !== null)
        duration = Math.min(duration, ceilingSeconds);
      lastFull = duration;
    }
    series.push(duration);
    volumes.push({ duration, lighter });
  }
  return { volumes, reached: lastFull };
}

function longDayNumber(availability: Availability, days: number[]) {
  if (availability.longRunDay === "saturday") return 6;
  if (availability.longRunDay === "sunday") return 7;
  return Math.max(...days);
}

function weekCapacity(
  weekStart: string,
  phase: TemplatePhase,
  availability: Availability,
  constraints: PlanningConstraints,
) {
  const declared = availability.availableWeekdays;
  if (!declared?.length) return null;
  const days = declared.filter((day) => {
    const date = addDays(weekStart, day - 1);
    return !constraints.unavailablePeriods.some(
      (period) => period.startsOn <= date && date <= period.endsOn,
    );
  });
  if (days.length === 0) return 0;
  const weekdayCap =
    availability.weekdaySessionMinutes !== null &&
    availability.weekdaySessionMinutes < 90
      ? availability.weekdaySessionMinutes * 60
      : null;
  if (weekdayCap === null) return null;
  const longDay = longDayNumber(availability, days);
  const longCap = phase.longRun.capMinutes * 60;
  return days.reduce(
    (total, day) =>
      total +
      (day === longDay ? longCap : day <= 5 ? weekdayCap : longCap * 0.75),
    0,
  );
}

function estimatedRaceSeconds(
  race: ObjectiveRace,
  paceSecondsPerKm: number | null,
) {
  if (race.targetSeconds) return race.targetSeconds;
  const effortKm = race.distanceKm + (race.elevationGainM ?? 0) / 100;
  return Math.min(
    259_200,
    Math.round(effortKm * (paceSecondsPerKm ?? fallbackPaceSecondsPerKm)),
  );
}

function raceIntensity(distanceKm: number): Intensity {
  if (distanceKm <= 10) return "interval";
  if (distanceKm <= 21.1) return "threshold";
  if (distanceKm <= 42.2) return "marathon";
  return "easy";
}

export function raceSession(
  race: ObjectiveRace,
  paceSecondsPerKm: number | null,
): PlanSession {
  const seconds = estimatedRaceSeconds(race, paceSecondsPerKm);
  return {
    sessionKey: `s-${race.date}-race`,
    scheduledOn: race.date,
    sport: race.kind === "trail" ? "trail" : "run",
    kind: "race",
    title: race.name.slice(0, 80),
    purpose: race.targetSeconds
      ? "Jour de course, durée selon ton objectif."
      : "Jour de course, durée estimée par Stride.",
    isKey: true,
    priority: "high",
    targets: {
      durationSeconds: seconds,
      distanceMeters: Math.round(race.distanceKm * 1000),
      elevationGainMeters: race.elevationGainM,
    },
    structure: [
      {
        type: "work",
        end: { kind: "lap_button", estimatedSeconds: seconds },
        target: { kind: "rpe", min: 7, max: 9 },
        intensity: raceIntensity(race.distanceKm),
      },
    ],
    terrain: race.kind === "trail" ? "trail" : "road",
    origin: "template",
    contingencies: [],
  };
}

const blockMeta: Record<
  DraftWeek["phaseId"],
  { kind: PlanBlock["kind"]; name: string; objective: string }
> = {
  lead_in: {
    kind: "lead_in",
    name: "Mise en route",
    objective: "Faire monter progressivement le volume que tu tiens déjà.",
  },
  base: {
    kind: "base",
    name: "Base",
    objective: "Consolider l’endurance fondamentale avec peu d’intensité.",
  },
  development: {
    kind: "build",
    name: "Développement",
    objective: "Ajouter de la qualité et développer le seuil.",
  },
  specific: {
    kind: "specific",
    name: "Spécifique",
    objective: "Travailler au plus près des exigences de la course.",
  },
  taper: {
    kind: "taper",
    name: "Affûtage",
    objective:
      "Réduire le volume en gardant de l’intensité pour arriver frais.",
  },
  recovery: {
    kind: "recovery",
    name: "Récupération",
    objective: "Récupérer de la course avant de repartir.",
  },
};

function blocks(weeks: DraftWeek[], raceId: string | null): PlanBlock[] {
  const result: PlanBlock[] = [];
  const ordinals = new Map<PlanBlock["kind"], number>();
  for (const week of weeks) {
    const meta = blockMeta[week.phaseId];
    const last = result.at(-1);
    if (
      last &&
      last.kind === meta.kind &&
      last.endsOn === addDays(week.weekStart, -1)
    ) {
      last.endsOn = addDays(week.weekStart, 6);
      continue;
    }
    const ordinal = (ordinals.get(meta.kind) ?? 0) + 1;
    ordinals.set(meta.kind, ordinal);
    result.push({
      blockKey: blockKey(meta.kind, ordinal),
      kind: meta.kind,
      name: meta.name,
      startsOn: week.weekStart,
      endsOn: addDays(week.weekStart, 6),
      objective: meta.objective,
      raceId: ["specific", "taper", "recovery"].includes(week.phaseId)
        ? raceId
        : null,
    });
  }
  return result;
}

export function buildSkeleton(input: SkeletonInput): Skeleton {
  const { objective, summary, availability, constraints } = input;
  const template = objective.template;
  const start = planStart(input.today);
  const race = objective.race;
  const held =
    summary.held.durationSeconds >= minimumHeldSeconds
      ? summary.held.durationSeconds
      : (input.declaredWeeklyMinutes ?? 0) * 60;
  if (held < minimumHeldSeconds) return { status: "no_history" };

  const raceWeek = race ? mondayOf(race.date) : null;
  const preRaceWeeks = raceWeek
    ? Math.max(0, weeksBetween(start, raceWeek))
    : baseBuildingWeeks;
  const isBase = template.id === "base_building";
  if (!isBase && preRaceWeeks < template.weeks.min)
    return {
      status: "too_short",
      weeksAvailable: preRaceWeeks,
      minimumWeeks: template.weeks.min,
      template,
    };
  if (isBase && race && preRaceWeeks < 1)
    return {
      status: "too_short",
      weeksAvailable: preRaceWeeks,
      minimumWeeks: 1,
      template,
    };

  const ceiling =
    constraints.maxWeeklyMinutes !== null
      ? constraints.maxWeeklyMinutes * 60
      : null;
  const warnings: SkeletonWarning[] = [];
  const heldElevation =
    template.sport === "trail" && summary.held.elevationGainMeters > 0
      ? summary.held.elevationGainMeters
      : null;
  const history = summary.weeks.slice(-4).map((week) => week.durationSeconds);
  const basePhase = template.phases[0];
  const drafts: DraftWeek[] = [];
  let peakSeconds: number;
  let peakElevation: number | null;
  let leadInCount: number;
  let templateWeeks: number;

  if (isBase) {
    const rampWeeks = race ? Math.max(preRaceWeeks - 1, 0) : preRaceWeeks;
    const ramp = leadInWeeks(rampWeeks, history, held, template, ceiling);
    ramp.volumes.forEach((volume, index) =>
      drafts.push({
        weekStart: addDays(start, 7 * index),
        phaseId: "base",
        phase: basePhase,
        weekType: volume.lighter ? "recovery" : "lead_in",
        durationSeconds: volume.duration,
        elevationGainMeters: heldElevation
          ? heldElevation * (volume.duration / held)
          : null,
        qualitySessions: 1,
      }),
    );
    peakSeconds = ramp.reached;
    peakElevation = heldElevation
      ? heldElevation * (ramp.reached / held)
      : null;
    leadInCount = rampWeeks;
    templateWeeks = 0;
    if (race) {
      drafts.push({
        weekStart: raceWeek!,
        phaseId: "taper",
        phase: { ...basePhase, id: "taper" },
        weekType: "race",
        durationSeconds: ramp.reached * 0.7,
        elevationGainMeters: peakElevation ? peakElevation * 0.7 : null,
        qualitySessions: 1,
      });
      const recovery = template.phases.find((item) => item.id === "recovery")!;
      drafts.push({
        weekStart: addDays(raceWeek!, 7),
        phaseId: "recovery",
        phase: recovery,
        weekType: "post_race",
        durationSeconds: ramp.reached * (recovery.volumePct.start / 100),
        elevationGainMeters: null,
        qualitySessions: 0,
      });
    }
  } else {
    leadInCount = Math.max(0, preRaceWeeks - template.weeks.max);
    templateWeeks = preRaceWeeks - leadInCount;
    const ramp = leadInWeeks(leadInCount, history, held, template, ceiling);
    ramp.volumes.forEach((volume, index) =>
      drafts.push({
        weekStart: addDays(start, 7 * index),
        phaseId: "lead_in",
        phase: basePhase,
        weekType: volume.lighter ? "recovery" : "lead_in",
        durationSeconds: volume.duration,
        elevationGainMeters: heldElevation
          ? heldElevation * (volume.duration / held)
          : null,
        qualitySessions: volume.lighter ? 1 : basePhase.qualitySessions,
      }),
    );
    const factor = peakFactor(template);
    peakSeconds = ramp.reached * factor.volume;
    if (ceiling !== null && peakSeconds > ceiling) {
      peakSeconds = ceiling;
      warnings.push({ code: "peak_capped_by_ceiling", peakSeconds });
    }
    const minimumSeconds = template.peakWeekHours.min * 3600;
    if (peakSeconds < minimumSeconds)
      warnings.push({
        code: "peak_below_template",
        peakSeconds,
        minimumSeconds,
      });
    peakElevation =
      heldElevation && factor.elevation
        ? heldElevation * (ramp.reached / held) * factor.elevation
        : null;
    const resolved = resolveTemplateWeeks(template, templateWeeks)!;
    resolved.forEach((week, position) => {
      const weekStart = addDays(start, 7 * (leadInCount + position));
      const isRaceWeek = week.kind === "taper" && weekStart === raceWeek;
      drafts.push({
        weekStart,
        phaseId: week.phase.id,
        phase: week.phase,
        weekType: isRaceWeek
          ? "race"
          : week.kind === "lighter"
            ? "recovery"
            : week.kind === "post_race"
              ? "post_race"
              : week.kind,
        durationSeconds: (peakSeconds * week.volumePct) / 100,
        elevationGainMeters:
          peakElevation !== null && week.elevationPct !== null
            ? (peakElevation * week.elevationPct) / 100
            : null,
        qualitySessions: week.qualitySessions,
      });
    });
  }

  const otherRaceWeeks = new Map(
    objective.otherRaces.map((item) => [mondayOf(item.date), item]),
  );
  const capped: string[] = [];
  const unavailable: string[] = [];
  const weeks: PlanWeek[] = drafts.map((draft) => {
    let duration = draft.durationSeconds;
    let quality = draft.qualitySessions;
    if (otherRaceWeeks.has(draft.weekStart) && draft.weekType !== "race") {
      duration *= otherRaceWeekFactor;
      quality = Math.min(quality, 1);
    }
    if (otherRaceWeeks.has(addDays(draft.weekStart, -7)))
      duration *= afterOtherRaceWeekFactor;
    if (ceiling !== null) duration = Math.min(duration, ceiling);
    const capacity = weekCapacity(
      draft.weekStart,
      draft.phase,
      availability,
      constraints,
    );
    if (capacity === 0) unavailable.push(draft.weekStart);
    if (capacity !== null && duration > capacity) {
      duration = capacity;
      if (capacity > 0) capped.push(draft.weekStart);
    }
    const seconds = Math.round(duration);
    const pace = summary.heldPaceSecondsPerKm;
    return {
      weekKey: weekKey(draft.weekStart),
      weekStart: draft.weekStart,
      blockKey: "",
      weekType: draft.weekType,
      targets: {
        durationSeconds: seconds,
        distanceMeters: pace ? Math.round((seconds / pace) * 1000) : null,
        elevationGainMeters:
          draft.elevationGainMeters === null
            ? null
            : Math.round(
                draft.elevationGainMeters *
                  (seconds / Math.max(draft.durationSeconds, 1)),
              ),
        qualitySessions: seconds === 0 ? 0 : quality,
        longRunSeconds:
          seconds === 0
            ? null
            : Math.round(
                Math.min(
                  (seconds * draft.phase.longRun.sharePct) / 100,
                  draft.phase.longRun.capMinutes * 60,
                ),
              ),
        intensitySplit: draft.phase.intensity,
      },
      notes: null,
    };
  });
  if (capped.length > 0)
    warnings.push({ code: "availability_cap", weekStarts: capped });
  if (unavailable.length > 0)
    warnings.push({ code: "unavailable_week", weekStarts: unavailable });

  const planBlocks = blocks(drafts, race?.id ?? null);
  for (const week of weeks) {
    const block = planBlocks.find(
      (item) =>
        item.startsOn <= week.weekStart && week.weekStart <= item.endsOn,
    )!;
    week.blockKey = block.blockKey;
  }

  const pace = summary.heldPaceSecondsPerKm;
  const races = [
    ...(race ? [race] : []),
    ...objective.otherRaces.filter((item) => item.date >= start),
  ];
  const endsOn = addDays(drafts.at(-1)!.weekStart, 6);
  const state: PlanState = {
    plan: {
      id: "draft",
      title: race
        ? `Préparation ${race.name}`.slice(0, 120)
        : "Construction de base",
      startsOn: start,
      endsOn,
      timeZone: constraints.timeZone,
      primaryRaceId: race?.id ?? null,
      raceRoles: [
        ...(race ? [{ raceId: race.id, role: "primary" as const }] : []),
        ...objective.otherRaces.map((item) => ({
          raceId: item.id,
          role: item.role,
        })),
      ],
      confidence: {
        level:
          template.confidence === "low" ||
          objective.confidenceReasons.length > 0
            ? "low"
            : "normal",
        reasons: objective.confidenceReasons,
      },
    },
    blocks: planBlocks,
    weeks,
    sessions: races
      .filter((item) => item.date <= endsOn)
      .map((item) => raceSession(item, pace)),
  };
  return {
    status: "ready",
    state,
    template,
    leadInWeeks: leadInCount,
    templateWeeks,
    held: { durationSeconds: held, elevationGainMeters: heldElevation },
    peak: {
      durationSeconds: Math.round(peakSeconds),
      elevationGainMeters: peakElevation,
    },
    paceSecondsPerKm: pace,
    warnings,
  };
}

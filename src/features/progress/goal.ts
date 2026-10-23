import type { PlanBlock } from "@/features/plans/model/plan";
import type { ProgramOverview } from "@/features/plans/view/program";
import type { RaceSummary } from "@/features/races/race";
import {
  formatClock,
  formatDayMonth,
  formatHoursMinutes,
  formatInteger,
} from "./format";
import type {
  GarminPrediction,
  GarminPredictionKey,
} from "./garmin-predictions";
import { daysBetween } from "./period";

export const preparationWindowDays = 182;

export const ultraNote =
  "Pas de prévision de temps fiable en ultra : Stride suit ta préparation.";

export type GoalPhaseSegment = {
  key: string;
  name: string;
  weeks: number;
  state: "past" | "current" | "future";
  progress: number;
};

export type GoalPhase = {
  label: string;
  taper: string | null;
  segments: GoalPhaseSegment[];
};

export type GoalRoad = {
  prediction: string | null;
  verdict: string;
  tone: "success" | "warning" | "muted";
};

export type GoalPreparation = {
  longest: string | null;
  distance: string | null;
  weeklyGain: string | null;
  preparation: { done: number; total: number } | null;
};

export type GoalCard = {
  id: string;
  name: string;
  priority: RaceSummary["priority"];
  date: string;
  countdown: string;
  target: string | null;
  road: GoalRoad | null;
  preparation: GoalPreparation | null;
  note: string | null;
  phase: GoalPhase | null;
};

const priorityRank: Record<string, number> = { A: 0, B: 1, C: 2 };

const roadDistances: { key: GarminPredictionKey; km: number }[] = [
  { key: "5k", km: 5 },
  { key: "10k", km: 10 },
  { key: "half_marathon", km: 21.1 },
  { key: "marathon", km: 42.2 },
];

export function pickGoalRace(
  races: RaceSummary[],
  primaryRaceId: string | null,
  today: string,
) {
  const upcoming = races.filter(
    (race): race is RaceSummary & { date: string } =>
      race.date !== null && race.date >= today,
  );
  return (
    upcoming.find((race) => race.id === primaryRaceId) ??
    upcoming
      .filter((race) => race.priority === "A" || race.priority === "B")
      .sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.date.localeCompare(b.date),
      )[0] ??
    null
  );
}

export function roadPredictionKey(
  race: Pick<RaceSummary, "kind" | "distanceKm">,
) {
  if (race.kind !== "road" || race.distanceKm === null) return null;
  return (
    roadDistances.find(
      (item) => Math.abs(item.km - race.distanceKm!) <= item.km * 0.01,
    )?.key ?? null
  );
}

export function formatTarget(seconds: number) {
  return seconds >= 3600 && seconds % 60 === 0
    ? formatHoursMinutes(seconds)
    : formatClock(seconds);
}

function signedClock(seconds: number) {
  return `${seconds > 0 ? "+" : "−"}${formatClock(Math.abs(seconds))}`;
}

function roadCard(
  prediction: GarminPrediction | undefined,
  target: number | null,
): GoalRoad {
  if (!prediction)
    return {
      prediction: null,
      verdict: "Pas encore de prévision Garmin pour cette distance.",
      tone: "muted",
    };
  if (target === null)
    return {
      prediction: formatClock(prediction.seconds),
      verdict: "Prévision Garmin, sans temps objectif.",
      tone: "muted",
    };
  const gap = prediction.seconds - target;
  return {
    prediction: formatClock(prediction.seconds),
    verdict:
      gap <= 0 ? "Dans les temps" : `${signedClock(gap)} sur ton objectif`,
    tone: gap <= 0 ? "success" : "warning",
  };
}

function phase(
  program: ProgramOverview | null,
  blockKinds: Record<string, PlanBlock["kind"]>,
  today: string,
): GoalPhase | null {
  if (!program) return null;
  const current = program.weeks.find(
    (week) => week.weekKey === program.currentWeekKey,
  );
  if (!current) return null;
  const currentBlock = program.blocks.find((block) =>
    block.weeks.some((week) => week.weekKey === current.weekKey),
  );
  const taperBlock = program.blocks.find(
    (block) => blockKinds[block.blockKey] === "taper" && block.weeks.length,
  );
  const taperStart = taperBlock?.weeks[0]?.weekStart ?? null;
  const taper =
    taperBlock === currentBlock
      ? "Affûtage en cours"
      : taperStart && taperStart > today
        ? `Affûtage le ${formatDayMonth(taperStart)}`
        : null;
  const currentIndex = currentBlock ? program.blocks.indexOf(currentBlock) : -1;
  return {
    label: `${current.blockName} · semaine ${formatInteger(current.number)} sur ${formatInteger(program.weeks.length)}`,
    taper,
    segments: program.blocks
      .filter((block) => block.weeks.length > 0)
      .map((block) => {
        const index = program.blocks.indexOf(block);
        const state =
          index < currentIndex
            ? "past"
            : index === currentIndex
              ? "current"
              : "future";
        return {
          key: block.blockKey,
          name: block.name,
          weeks: block.weeks.length,
          state,
          progress:
            state === "past"
              ? 1
              : state === "current"
                ? current.numberInBlock / block.weeks.length
                : 0,
        };
      }),
  };
}

export function goalCard({
  races,
  primaryRaceId,
  today,
  predictions,
  longestRunMeters,
  maxWeeklyGainMeters,
  preparation,
  program,
  blockKinds,
}: {
  races: RaceSummary[];
  primaryRaceId: string | null;
  today: string;
  predictions: GarminPrediction[];
  longestRunMeters: number | null;
  maxWeeklyGainMeters: number | null;
  preparation: { done: number; total: number } | null;
  program: ProgramOverview | null;
  blockKinds: Record<string, PlanBlock["kind"]>;
}): GoalCard | null {
  const race = pickGoalRace(races, primaryRaceId, today);
  if (!race) return null;
  const key = roadPredictionKey(race);
  const days = daysBetween(today, race.date);
  return {
    id: race.id,
    name: race.name,
    priority: race.priority,
    date: formatDayMonth(race.date),
    countdown: days === 0 ? "Jour J" : `J-${formatInteger(days)}`,
    target: race.targetSeconds ? formatTarget(race.targetSeconds) : null,
    road: key
      ? roadCard(
          predictions.find((item) => item.key === key),
          race.targetSeconds,
        )
      : null,
    preparation: key
      ? null
      : {
          longest:
            longestRunMeters === null
              ? null
              : formatInteger(longestRunMeters / 1000),
          distance:
            race.distanceKm === null ? null : formatInteger(race.distanceKm),
          weeklyGain:
            maxWeeklyGainMeters === null
              ? null
              : formatInteger(maxWeeklyGainMeters),
          preparation,
        },
    note: race.kind === "trail" ? ultraNote : null,
    phase: phase(program, blockKinds, today),
  };
}

export function goalSummary(goal: GoalCard) {
  const target = goal.target
    ? `Objectif ${goal.target}`
    : "Sans temps objectif";
  if (goal.road)
    return goal.road.prediction
      ? `Prévision Garmin ${goal.road.prediction}. ${target}.`
      : `${target}. ${goal.road.verdict}`;
  const prep = goal.preparation;
  const longest =
    prep?.longest && prep.distance
      ? `Plus longue sortie : ${prep.longest} km sur ${prep.distance}. `
      : prep?.longest
        ? `Plus longue sortie : ${prep.longest} km. `
        : "";
  const preparation = prep?.preparation
    ? `, préparation ${formatInteger(prep.preparation.done)} sur ${formatInteger(prep.preparation.total)}`
    : "";
  return `${longest}${target}${preparation}.`;
}

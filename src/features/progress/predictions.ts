import type { Confidence } from "@/components/stride/confidence-meter";
import type { DayValue, ProgressRace } from "./history";
import { daysBetween } from "./period";

export type Prediction = {
  key: "10k" | "half" | "marathon";
  label: string;
  meters: number;
  seconds: number;
  confidence: Confidence;
};

export type RacePredictions = {
  vo2: number;
  observedOn: string;
  predictions: Prediction[];
  goal: ProgressRace | null;
};

export const maximumVo2AgeDays = 30;

const distances = [
  { key: "10k", label: "10K", meters: 10_000, confidence: "moderate" },
  {
    key: "half",
    label: "Semi-marathon",
    meters: 21_097.5,
    confidence: "moderate",
  },
  { key: "marathon", label: "Marathon", meters: 42_195, confidence: "low" },
] as const;

function oxygenCost(metersPerMinute: number) {
  return -4.6 + 0.182258 * metersPerMinute + 0.000104 * metersPerMinute ** 2;
}

function sustainableFraction(minutes: number) {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

export function predictSeconds(vo2: number, meters: number) {
  if (!Number.isFinite(vo2) || vo2 <= 0 || meters <= 0) return null;
  const required = (minutes: number) =>
    oxygenCost(meters / minutes) / sustainableFraction(minutes);
  let low = 1;
  let high = 2_000;
  if (required(high) > vo2 || required(low) < vo2) return null;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (required(middle) > vo2) low = middle;
    else high = middle;
  }
  return ((low + high) / 2) * 60;
}

const roadPresets = [10, 21.1, 42.2];

export function nextGoalRace(races: ProgressRace[], today: string) {
  return (
    races
      .filter((race) => race.day >= today)
      .sort(
        (a, b) =>
          a.priority.localeCompare(b.priority) || a.day.localeCompare(b.day),
      )[0] ?? null
  );
}

export function racePredictions(
  vo2: DayValue[],
  races: ProgressRace[],
  today: string,
): RacePredictions | null {
  const latest = [...vo2]
    .filter((item) => item.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day))
    .at(-1);
  if (!latest || daysBetween(latest.day, today) > maximumVo2AgeDays)
    return null;
  const predictions = distances.flatMap((distance): Prediction[] => {
    const seconds = predictSeconds(latest.value, distance.meters);
    return seconds === null ? [] : [{ ...distance, seconds }];
  });
  if (predictions.length === 0) return null;
  const goal = nextGoalRace(races, today);
  return {
    vo2: latest.value,
    observedOn: latest.day,
    predictions,
    goal:
      goal &&
      !(goal.kind === "road" && roadPresets.includes(goal.distanceKm ?? -1))
        ? goal
        : null,
  };
}

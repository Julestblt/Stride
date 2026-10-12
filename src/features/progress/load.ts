import type { LoadPoint, ProgressRace } from "./history";
import { addDays, daysBetween, weekStart } from "./period";

export type LoadWeek = { start: string; freshness: number };
export type LoadMarker = { day: string; name: string };

export type LoadChart = {
  start: string;
  end: string;
  points: { day: string; condition: number; fatigue: number }[];
  weeks: LoadWeek[];
  markers: LoadMarker[];
  current: { day: string; condition: number; fatigue: number };
  peak: { day: string; condition: number };
  gapToPeak: number;
  recentChange: number | null;
};

export const minimumLoadDays = 7;

export function buildLoadChart(
  points: LoadPoint[],
  races: ProgressRace[],
  start: string,
  today: string,
): LoadChart | null {
  const inRange = points
    .filter((point) => point.day >= start && point.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (inRange.length < minimumLoadDays) return null;
  const series = inRange.map((point) => ({
    day: point.day,
    condition: point.chronic,
    fatigue: point.acute,
  }));
  const weeks = new Map<string, number[]>();
  for (const point of series) {
    const key = weekStart(point.day);
    weeks.set(key, [
      ...(weeks.get(key) ?? []),
      point.condition - point.fatigue,
    ]);
  }
  const current = series.at(-1)!;
  const peak = series.reduce((best, point) =>
    point.condition > best.condition ? point : best,
  );
  const twoWeeksAgo = addDays(current.day, -14);
  const reference = [...series]
    .reverse()
    .find((point) => point.day <= twoWeeksAgo);
  return {
    start: series[0].day,
    end: current.day,
    points: series,
    weeks: [...weeks.entries()].map(([weekStartDay, values]) => ({
      start: weekStartDay,
      freshness: values.reduce((sum, value) => sum + value, 0) / values.length,
    })),
    markers: races
      .filter((race) => race.day >= series[0].day && race.day <= current.day)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((race) => ({ day: race.day, name: race.name })),
    current,
    peak: { day: peak.day, condition: peak.condition },
    gapToPeak:
      peak.condition > 0
        ? (peak.condition - current.condition) / peak.condition
        : 0,
    recentChange:
      reference &&
      reference.condition > 0 &&
      daysBetween(reference.day, current.day) >= 10
        ? (current.condition - reference.condition) / reference.condition
        : null,
  };
}

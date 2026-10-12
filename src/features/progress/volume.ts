import type { ProgressActivity, ProgressRace } from "./history";
import { addDays, weekStart } from "./period";

export type WeekVolume = {
  start: string;
  seconds: number;
  race: boolean;
  current: boolean;
};

export const volumeWeeks = 16;

export function weeklyVolume(
  activities: ProgressActivity[],
  races: ProgressRace[],
  today: string,
  weeks = volumeWeeks,
): WeekVolume[] {
  const current = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, index) =>
    addDays(current, -7 * (weeks - 1 - index)),
  );
  const totals = new Map(starts.map((start) => [start, 0]));
  for (const activity of activities) {
    if (activity.day > today || !activity.duration) continue;
    const key = weekStart(activity.day);
    const total = totals.get(key);
    if (total !== undefined) totals.set(key, total + activity.duration);
  }
  const raceWeeks = new Set(
    races
      .filter((race) => race.day <= today)
      .map((race) => weekStart(race.day)),
  );
  return starts.map((start) => ({
    start,
    seconds: totals.get(start) ?? 0,
    race: raceWeeks.has(start),
    current: start === current,
  }));
}

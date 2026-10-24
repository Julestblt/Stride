import { formatInteger } from "./format";
import { isRunning, type ProgressActivity } from "./history";
import { addDays, weekStart } from "./period";

export const runningVolumeWeeks = 12;

export type PlannedWeek = {
  weekStart: string;
  meters: number | null;
  estimated: boolean;
};

export type RunningWeek = {
  start: string;
  doneMeters: number;
  plannedMeters: number | null;
  plannedEstimated: boolean;
  current: boolean;
};

export type RunningVolume = {
  weeks: RunningWeek[];
  completedWeeks: number;
  averageMeters: number;
  plannedShare: number | null;
  summary: string;
};

function km(meters: number) {
  return formatInteger(meters / 1000);
}

export function runningVolume(
  activities: ProgressActivity[],
  planned: PlannedWeek[] | null,
  today: string,
  count = runningVolumeWeeks,
): RunningVolume {
  const current = weekStart(today);
  const starts = Array.from({ length: count }, (_, index) =>
    addDays(current, -7 * (count - 1 - index)),
  );
  const done = new Map(starts.map((start) => [start, 0]));
  for (const activity of activities) {
    if (activity.day > today || !isRunning(activity.type)) continue;
    if (!activity.distance) continue;
    const key = weekStart(activity.day);
    const total = done.get(key);
    if (total !== undefined) done.set(key, total + activity.distance);
  }
  const plan = new Map(
    (planned ?? []).map((week) => [weekStart(week.weekStart), week]),
  );
  const weeks = starts.map((start) => {
    const week = plan.get(start);
    return {
      start,
      doneMeters: done.get(start) ?? 0,
      plannedMeters: week?.meters ?? null,
      plannedEstimated: week?.estimated ?? false,
      current: start === current,
    };
  });
  const completed = weeks.filter((week) => !week.current);
  const averageMeters = completed.length
    ? completed.reduce((sum, week) => sum + week.doneMeters, 0) /
      completed.length
    : 0;
  const comparable = completed.filter((week) => week.plannedMeters);
  const plannedTotal = comparable.reduce(
    (sum, week) => sum + (week.plannedMeters ?? 0),
    0,
  );
  const plannedShare =
    plannedTotal > 0
      ? comparable.reduce((sum, week) => sum + week.doneMeters, 0) /
        plannedTotal
      : null;
  const now = weeks.at(-1)!;
  const thisWeek = now.plannedMeters
    ? `Cette semaine : ${km(now.doneMeters)} km sur ${now.plannedEstimated ? "≈ " : ""}${km(now.plannedMeters)} prévus.`
    : `Cette semaine : ${km(now.doneMeters)} km.`;
  const average = completed.length
    ? ` Moyenne ${formatInteger(completed.length)} sem. : ${km(averageMeters)} km${plannedShare === null ? "" : `, ${formatInteger(plannedShare * 100)} % du prévu`}.`
    : "";
  return {
    weeks,
    completedWeeks: completed.length,
    averageMeters,
    plannedShare,
    summary: `${thisWeek}${average}`,
  };
}

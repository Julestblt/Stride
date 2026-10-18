import { isRunning, isTrailRun } from "@/features/progress/history";
import { addDays, mondayOf } from "../model/dates";

export const summaryWeeks = 16;
export const heldWeeks = 4;
export const minimumHeldSeconds = 3_600;
export const provenWindowWeeks = 12;
export const provenWeeks = 4;
export const provenOutlierRatio = 2;
export const longEffortDays = 90;

export type HistoryActivity = {
  day: string;
  type: string;
  distance: number | null;
  duration: number | null;
  gain: number | null;
};

export type HistoryWeek = {
  weekStart: string;
  runs: number;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
};

export type HistorySummary = {
  weeks: HistoryWeek[];
  weeksWithRuns: number;
  held: {
    durationSeconds: number;
    distanceMeters: number;
    elevationGainMeters: number;
  };
  provenDurationSeconds: number;
  heldPaceSecondsPerKm: number | null;
  longestEffort90d: {
    date: string;
    distanceMeters: number;
    durationSeconds: number;
  } | null;
  longestRun30d: { distanceMeters: number; durationSeconds: number } | null;
  runsLast30d: number;
  trailShare: number;
  consistency: number;
  sufficient: boolean;
};

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function provenDuration(weeks: HistoryWeek[]) {
  const durations = weeks
    .slice(-provenWindowWeeks)
    .map((week) => week.durationSeconds);
  const limit = median(durations) * provenOutlierRatio;
  const highest = durations
    .filter((duration) => duration <= limit)
    .sort((first, second) => second - first)
    .slice(0, provenWeeks);
  return highest.length > 0
    ? Math.round(
        highest.reduce((total, duration) => total + duration, 0) / provenWeeks,
      )
    : 0;
}

export function summarizeHistory(
  activities: HistoryActivity[],
  today: string,
): HistorySummary {
  const currentWeek = mondayOf(today);
  const firstWeek = addDays(currentWeek, -7 * summaryWeeks);
  const runs = activities.filter(
    (activity) =>
      isRunning(activity.type) &&
      activity.day >= firstWeek &&
      activity.day < today &&
      (activity.duration ?? 0) > 0,
  );
  const weeks: HistoryWeek[] = Array.from(
    { length: summaryWeeks },
    (_, index) => {
      const weekStart = addDays(firstWeek, 7 * index);
      const inWeek = runs.filter(
        (run) => run.day >= weekStart && run.day < addDays(weekStart, 7),
      );
      return {
        weekStart,
        runs: inWeek.length,
        durationSeconds: inWeek.reduce(
          (total, run) => total + (run.duration ?? 0),
          0,
        ),
        distanceMeters: inWeek.reduce(
          (total, run) => total + (run.distance ?? 0),
          0,
        ),
        elevationGainMeters: inWeek.reduce(
          (total, run) => total + (run.gain ?? 0),
          0,
        ),
      };
    },
  );
  const recent = weeks.slice(-heldWeeks);
  const mean = (pick: (week: HistoryWeek) => number) =>
    recent.reduce((total, week) => total + pick(week), 0) / heldWeeks;
  const held = {
    durationSeconds: Math.round(mean((week) => week.durationSeconds)),
    distanceMeters: Math.round(mean((week) => week.distanceMeters)),
    elevationGainMeters: Math.round(mean((week) => week.elevationGainMeters)),
  };
  const timed = runs.filter((run) => (run.distance ?? 0) > 0);
  const timedSeconds = timed.reduce((total, run) => total + run.duration!, 0);
  const timedMeters = timed.reduce((total, run) => total + run.distance!, 0);
  const window = runs.filter((run) => run.day >= addDays(today, -30));
  const longest = runs
    .filter((run) => run.day >= addDays(today, -longEffortDays))
    .reduce<HistoryActivity | null>(
      (best, run) =>
        best === null || run.duration! > best.duration! ? run : best,
      null,
    );
  const weeksWithRuns = weeks.filter((week) => week.runs > 0).length;
  const totalSeconds = runs.reduce((total, run) => total + run.duration!, 0);
  return {
    weeks,
    weeksWithRuns,
    held,
    provenDurationSeconds: provenDuration(weeks),
    heldPaceSecondsPerKm:
      timedMeters > 0 ? timedSeconds / (timedMeters / 1000) : null,
    longestEffort90d: longest
      ? {
          date: longest.day,
          distanceMeters: longest.distance ?? 0,
          durationSeconds: longest.duration!,
        }
      : null,
    longestRun30d:
      window.length > 0
        ? {
            distanceMeters: Math.max(...window.map((run) => run.distance ?? 0)),
            durationSeconds: Math.max(...window.map((run) => run.duration!)),
          }
        : null,
    runsLast30d: window.length,
    trailShare:
      totalSeconds > 0
        ? runs
            .filter((run) => isTrailRun(run.type))
            .reduce((total, run) => total + run.duration!, 0) / totalSeconds
        : 0,
    consistency: weeks.filter((week) => week.runs >= 2).length / summaryWeeks,
    sufficient:
      recent.filter((week) => week.runs > 0).length >= heldWeeks &&
      held.durationSeconds >= minimumHeldSeconds,
  };
}

export function historyForValidation(
  activities: HistoryActivity[],
  summary: HistorySummary,
  today: string,
) {
  return {
    runs: activities
      .filter(
        (activity) =>
          isRunning(activity.type) &&
          activity.day < today &&
          activity.day >= addDays(today, -longEffortDays) &&
          (activity.duration ?? 0) > 0,
      )
      .map((activity) => ({
        date: activity.day,
        durationSeconds: activity.duration!,
        distanceMeters: activity.distance,
      })),
    weeks: summary.weeks.map((week) => ({
      weekStart: week.weekStart,
      durationSeconds: week.durationSeconds,
      elevationGainMeters: week.elevationGainMeters,
    })),
    provenWeeklySeconds: summary.provenDurationSeconds,
  };
}

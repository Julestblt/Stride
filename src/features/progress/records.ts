import {
  isOutdoorRun,
  isRunning,
  type ProgressActivity,
  type ProgressLap,
} from "./history";
import { weekStart } from "./period";

export type EffortRecord = {
  key: "10k" | "half";
  label: string;
  seconds: number;
  activityId: string;
  day: string;
};
export type DistanceRecord = {
  meters: number;
  activityId: string;
  day: string;
};
export type ElevationRecord = { meters: number; weekStart: string };

export type FitnessRecords = {
  efforts: EffortRecord[];
  longest: DistanceRecord | null;
  weeklyGain: ElevationRecord | null;
};

const efforts = [
  { key: "10k", label: "10K", meters: 10_000 },
  { key: "half", label: "Semi-marathon", meters: 21_097.5 },
] as const;
export const effortOvershoot = 1.05;

export function bestEffortSeconds(
  laps: ProgressLap[],
  meters: number,
  activityDistance: number | null,
  activityDuration: number | null,
) {
  const candidates: number[] = [];
  if (
    Number.isFinite(activityDistance) &&
    Number.isFinite(activityDuration) &&
    activityDistance !== null &&
    activityDistance > 0 &&
    activityDuration !== null &&
    activityDuration > 0 &&
    activityDistance >= meters &&
    activityDistance <= meters * effortOvershoot
  )
    candidates.push((activityDuration * meters) / activityDistance);
  const ordered = [...laps].sort((a, b) => a.index - b.index);
  for (let first = 0; first < ordered.length; first++) {
    let distance = 0;
    let duration = 0;
    for (let last = first; last < ordered.length; last++) {
      const lap = ordered[last];
      if (
        !Number.isFinite(lap.distance) ||
        lap.distance <= 0 ||
        !Number.isFinite(lap.duration) ||
        lap.duration <= 0 ||
        !Number.isInteger(lap.index) ||
        lap.index < 0 ||
        (last > first &&
          (lap.index !== ordered[last - 1].index + 1 ||
            lap.activityId !== ordered[last - 1].activityId))
      )
        break;
      distance += ordered[last].distance;
      duration += ordered[last].duration;
      if (distance >= meters) {
        if (distance <= meters * effortOvershoot)
          candidates.push((duration * meters) / distance);
        break;
      }
    }
  }
  return candidates.length ? Math.min(...candidates) : null;
}

export function fitnessRecords(
  activities: ProgressActivity[],
  laps: ProgressLap[],
): FitnessRecords {
  const byActivity = new Map<string, ProgressLap[]>();
  for (const lap of laps)
    byActivity.set(lap.activityId, [
      ...(byActivity.get(lap.activityId) ?? []),
      lap,
    ]);
  const outdoor = activities.filter((activity) => isOutdoorRun(activity.type));
  const best = efforts.flatMap((effort): EffortRecord[] => {
    let record: EffortRecord | null = null;
    for (const activity of outdoor) {
      if ((activity.distance ?? 0) < effort.meters) continue;
      const seconds = bestEffortSeconds(
        byActivity.get(activity.id) ?? [],
        effort.meters,
        activity.distance,
        activity.duration,
      );
      if (seconds !== null && (!record || seconds < record.seconds))
        record = {
          key: effort.key,
          label: effort.label,
          seconds,
          activityId: activity.id,
          day: activity.day,
        };
    }
    return record ? [record] : [];
  });
  const longest = outdoor.reduce<DistanceRecord | null>(
    (current, activity) =>
      activity.distance && (!current || activity.distance > current.meters)
        ? {
            meters: activity.distance,
            activityId: activity.id,
            day: activity.day,
          }
        : current,
    null,
  );
  const weeks = new Map<string, number>();
  for (const activity of activities)
    if (isRunning(activity.type) && activity.gain)
      weeks.set(
        weekStart(activity.day),
        (weeks.get(weekStart(activity.day)) ?? 0) + activity.gain,
      );
  const weeklyGain = [...weeks.entries()].reduce<ElevationRecord | null>(
    (current, [start, meters]) =>
      !current || meters > current.meters
        ? { meters, weekStart: start }
        : current,
    null,
  );
  return { efforts: best, longest, weeklyGain };
}

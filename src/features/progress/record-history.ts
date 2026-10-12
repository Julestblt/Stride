import type { Series } from "@/features/activities/track";
import {
  isOutdoorRun,
  isRunning,
  type ProgressActivity,
  type ProgressHistory,
} from "./history";
import { bestEffortSeconds } from "./records";
import { weekStart } from "./period";

export const roadDistances = [
  { key: "1k", label: "1 km", meters: 1000 },
  { key: "mile", label: "1 mile", meters: 1609.344 },
  { key: "5k", label: "5 km", meters: 5000 },
  { key: "10k", label: "10 km", meters: 10000 },
  { key: "half", label: "Semi-marathon", meters: 21097.5 },
  { key: "marathon", label: "Marathon", meters: 42195 },
] as const;
export type RoadKey = (typeof roadDistances)[number]["key"];
export type RecordPoint = {
  day: string;
  value: number;
  activityId: string | null;
  name: string;
  activityIds?: string[];
};
export type RoadRecord = (typeof roadDistances)[number] & {
  history: RecordPoint[];
  current: RecordPoint | null;
};
export const enduranceDefinitions = [
  { key: "distance", label: "Plus longue sortie", unit: "km" },
  { key: "duration", label: "Plus longue durée", unit: "h" },
  { key: "gain", label: "D+ en une sortie", unit: "m" },
  { key: "weeklyGain", label: "D+ sur une semaine", unit: "m" },
  { key: "vam", label: "VAM sur 20 min", unit: "m/h" },
  { key: "weeklyDistance", label: "Volume sur une semaine", unit: "km" },
] as const;
export type EnduranceRecord = (typeof enduranceDefinitions)[number] & {
  history: RecordPoint[];
  current: RecordPoint | null;
};
export type RecordTrack = { activityId: string; series: Series };
export type RecordsModel = {
  road: RoadRecord[];
  endurance: EnduranceRecord[];
  chronology: (RecordPoint & {
    key: string;
    label: string;
    kind: "road" | "endurance";
    current: boolean;
  })[];
  activities: ProgressActivity[];
};

export function improvementHistory(
  points: RecordPoint[],
  lowerWins = false,
  allowZero = false,
) {
  const ordered = [...points]
    .filter(
      (p) =>
        Number.isFinite(p.value) && (allowZero ? p.value >= 0 : p.value > 0),
    )
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.activityId ?? "").localeCompare(b.activityId ?? ""),
    );
  return ordered.reduce<RecordPoint[]>((history, point) => {
    const best = history.at(-1);
    if (
      !best ||
      (lowerWins ? point.value < best.value : point.value > best.value)
    )
      history.push(point);
    return history;
  }, []);
}

export function climbingVam(series: Series): number | null {
  const time = series.elapsed_s,
    distance = series.distance_m,
    elevation = series.elevation_m;
  if (
    !time ||
    !distance ||
    !elevation ||
    time.length < 2 ||
    distance.length !== time.length ||
    elevation.length !== time.length
  )
    return null;
  const points: { t: number; d: number; e: number }[] = [];
  for (let i = 0; i < time.length; i++) {
    const t = time[i],
      d = distance[i],
      e = elevation[i];
    if (
      t === null ||
      d === null ||
      e === null ||
      !Number.isFinite(t) ||
      !Number.isFinite(d) ||
      !Number.isFinite(e) ||
      t < 0 ||
      d < 0
    )
      return null;
    if (i && (t <= points[i - 1].t || d <= points[i - 1].d)) return null;
    points.push({ t, d, e });
  }
  const interpolate = (t: number) => {
    let low = 0,
      high = points.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (points[mid].t < t) low = mid + 1;
      else high = mid;
    }
    if (points[low].t === t) return { ...points[low], index: low };
    if (low === 0 || t > points.at(-1)!.t) return null;
    const a = points[low - 1],
      b = points[low],
      ratio = (t - a.t) / (b.t - a.t);
    return {
      t,
      d: a.d + ratio * (b.d - a.d),
      e: a.e + ratio * (b.e - a.e),
      index: low,
    };
  };
  const badEdges = [0];
  for (let i = 1; i < points.length; i++)
    badEdges.push(
      badEdges[i - 1] +
        (points[i].t - points[i - 1].t > 300 || points[i].e < points[i - 1].e
          ? 1
          : 0),
    );
  const boundaries = [...new Set(points.flatMap((p) => [p.t, p.t - 1200]))]
    .filter((t) => t >= points[0].t && t + 1200 <= points.at(-1)!.t)
    .sort((a, b) => a - b);
  const starts = new Set(boundaries);
  for (let i = 1; i < boundaries.length; i++) {
    const left = boundaries[i - 1],
      right = boundaries[i];
    const a = interpolate(left)!,
      b = interpolate(left + 1200)!,
      c = interpolate(right)!,
      d = interpolate(right + 1200)!;
    for (const grade of [0.12, 0.16]) {
      const before = b.e - a.e - grade * (b.d - a.d),
        after = d.e - c.e - grade * (d.d - c.d);
      if (before * after < 0)
        starts.add(left + (right - left) * (-before / (after - before)));
    }
  }
  let best: number | null = null;
  for (const start of starts) {
    if (start < points[0].t || start + 1200 > points.at(-1)!.t) continue;
    const a = interpolate(start),
      b = interpolate(start + 1200);
    if (!a || !b) continue;
    const firstEdge = Math.max(
      1,
      a.index + (a.t === points[a.index].t ? 1 : 0),
    );
    const valid = badEdges[b.index] - badEdges[firstEdge - 1] === 0;
    const gain = b.e - a.e,
      grade = gain / (b.d - a.d);
    if (valid && grade >= 0.12 - 1e-10 && grade <= 0.16 + 1e-10 && gain > 0)
      best = Math.max(best ?? 0, gain * 3);
  }
  return best;
}

export function recordsModel(
  history: ProgressHistory,
  tracks: RecordTrack[],
  today: string,
): RecordsModel {
  const activities = history.activities.filter((a) => a.day <= today);
  const point = (a: ProgressActivity, value: number): RecordPoint => ({
    day: a.day,
    value,
    activityId: a.id,
    name: a.name ?? "Course à pied",
  });
  const byActivity = new Map<string, typeof history.laps>();
  for (const lap of history.laps) {
    const laps = byActivity.get(lap.activityId) ?? [];
    laps.push(lap);
    byActivity.set(lap.activityId, laps);
  }
  const byTrack = new Map(
    tracks.map((track) => [track.activityId, track.series]),
  );
  const road = roadDistances.map((definition) => {
    const candidates = activities
      .filter((a) => a.type === "running" || a.type === "track_running")
      .flatMap((a) => {
        const seconds = bestEffortSeconds(
          byActivity.get(a.id) ?? [],
          definition.meters,
          a.distance,
          a.duration,
        );
        return seconds === null ? [] : [point(a, seconds)];
      });
    const improvements = improvementHistory(candidates, true);
    return {
      ...definition,
      history: improvements,
      current: improvements.at(-1) ?? null,
    };
  });
  const weeks = new Map<
    string,
    {
      gain: number;
      distance: number;
      gainComplete: boolean;
      distanceComplete: boolean;
      ids: string[];
    }
  >();
  for (const a of activities.filter((a) => isRunning(a.type))) {
    const start = weekStart(a.day),
      entry = weeks.get(start) ?? {
        gain: 0,
        distance: 0,
        gainComplete: true,
        distanceComplete: true,
        ids: [],
      };
    if (a.gain !== null && Number.isFinite(a.gain) && a.gain >= 0) {
      entry.gain += a.gain;
    } else entry.gainComplete = false;
    if (a.distance !== null && Number.isFinite(a.distance) && a.distance > 0) {
      entry.distance += a.distance;
    } else entry.distanceComplete = false;
    entry.ids.push(a.id);
    weeks.set(start, entry);
  }
  const endurance = enduranceDefinitions.map((definition) => {
    const candidates: RecordPoint[] = [];
    if (
      definition.key === "weeklyGain" ||
      definition.key === "weeklyDistance"
    ) {
      for (const [day, week] of weeks)
        if (
          definition.key === "weeklyGain"
            ? week.gainComplete
            : week.distanceComplete
        )
          candidates.push({
            day,
            value: definition.key === "weeklyGain" ? week.gain : week.distance,
            activityId: null,
            name: "Semaine du lundi",
            activityIds: week.ids,
          });
    } else
      for (const a of activities.filter((a) => isOutdoorRun(a.type))) {
        const value =
          definition.key === "vam"
            ? climbingVam(byTrack.get(a.id) ?? {})
            : a[definition.key];
        if (value !== null) candidates.push(point(a, value));
      }
    const improvements = improvementHistory(
      candidates,
      false,
      definition.key === "gain" || definition.key === "weeklyGain",
    );
    return {
      ...definition,
      history: improvements,
      current: improvements.at(-1) ?? null,
    };
  });
  const chronology = [
    ...road.map((r) => ({ ...r, kind: "road" as const })),
    ...endurance.map((r) => ({ ...r, kind: "endurance" as const })),
  ]
    .flatMap((r) =>
      r.history.map((p) => ({
        ...p,
        key: r.key,
        label: r.label,
        kind: r.kind,
        current: p === r.current,
      })),
    )
    .sort((a, b) => a.day.localeCompare(b.day) || a.key.localeCompare(b.key));
  return { road, endurance, chronology, activities };
}

import { z } from "zod";
import type {
  SleepStage,
  TimedValue,
  WellnessDay,
} from "@/features/garmin/wellness";
import { addDays } from "./period";

export const healthTimeZone = "Europe/Paris";
export const windowStartMinutes = 22 * 60;
export const slotMinutes = 10;
const minuteMs = 60_000;
const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: healthTimeZone,
  timeZoneName: "longOffset",
});
const clock = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: healthTimeZone,
});

const dateSchema = z.iso.date();

export function parseHealthDate(value: unknown, today: string) {
  const parsed = dateSchema.safeParse(Array.isArray(value) ? value[0] : value);
  if (
    !parsed.success ||
    parsed.data > today ||
    parsed.data < addDays(today, -730)
  )
    return today;
  return parsed.data;
}

function offsetMinutes(epoch: number) {
  const name =
    offsetFormat
      .formatToParts(new Date(epoch))
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

export function zonedEpoch(day: string, minutes: number) {
  const [year, month, date] = day.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, date, 0, minutes);
  const first = naive - offsetMinutes(naive) * minuteMs;
  return naive - offsetMinutes(first) * minuteMs;
}

export function formatClock(epoch: number) {
  return clock.format(new Date(epoch));
}

export function dayWindow(day: string) {
  return {
    start: zonedEpoch(addDays(day, -1), windowStartMinutes),
    end: zonedEpoch(day, windowStartMinutes),
  };
}

export type StressLevel = "rest" | "low" | "high";

export function stressLevel(value: number): StressLevel {
  if (value <= 25) return "rest";
  if (value <= 50) return "low";
  return "high";
}

export type DaySlot = {
  start: number;
  heartRate: number | null;
  stress: number | null;
  bodyBattery: number | null;
  steps: number | null;
  stage: SleepStage | null;
};

export type Moment = {
  at: number;
  title: string;
  detail: string;
  tone: "warning" | "success" | "muted" | "accent";
};

export type StressEpisode = {
  start: number;
  end: number;
  average: number;
};

export type HealthDayModel = {
  day: string;
  window: { start: number; end: number };
  now: number | null;
  slots: DaySlot[];
  stages: { start: number; end: number; stage: SleepStage }[];
  heartRate: TimedValue[];
  stress: TimedValue[];
  bodyBattery: TimedValue[];
  steps: TimedValue[];
  sleep: WellnessDay["sleep"];
  summary: WellnessDay["summary"];
  latestBattery: TimedValue | null;
  restingHeartRate: number | null;
  stressPeak: StressEpisode | null;
  calmPause: { start: number; end: number; gain: number | null } | null;
  moments: Moment[];
};

function inside(values: TimedValue[], start: number, end: number) {
  return values.filter(([at]) => at >= start && at < end);
}

function merge(previous: TimedValue[] | undefined, current: TimedValue[]) {
  const map = new Map<number, number | null>();
  for (const [at, value] of [...(previous ?? []), ...current])
    map.set(at, value);
  return [...map.entries()].sort((a, b) => a[0] - b[0]) as TimedValue[];
}

function average(values: TimedValue[]) {
  const present = values.flatMap(([, value]) =>
    value === null ? [] : [value],
  );
  return present.length
    ? present.reduce((sum, value) => sum + value, 0) / present.length
    : null;
}

function nearest(values: TimedValue[], at: number, tolerance: number) {
  let best: TimedValue | null = null;
  for (const item of values)
    if (
      item[1] !== null &&
      Math.abs(item[0] - at) <= tolerance &&
      (!best || Math.abs(item[0] - at) < Math.abs(best[0] - at))
    )
      best = item;
  return best?.[1] ?? null;
}

function asleep(
  stages: HealthDayModel["stages"],
  sleep: WellnessDay["sleep"],
  at: number,
) {
  if (stages.length)
    return stages.some(
      (stage) => stage.stage !== "awake" && at >= stage.start && at < stage.end,
    );
  return sleep ? at >= sleep.start && at < sleep.end : false;
}

export function episodes(
  stress: TimedValue[],
  matches: (value: number) => boolean,
  minimumMinutes: number,
  excluded: (at: number) => boolean,
) {
  const found: { start: number; end: number; values: number[] }[] = [];
  let current: { start: number; end: number; values: number[] } | null = null;
  for (const [at, value] of stress) {
    const ok = value !== null && matches(value) && !excluded(at);
    if (ok && current && at - current.end <= 6 * minuteMs) {
      current.end = at;
      current.values.push(value!);
    } else if (ok) {
      current = { start: at, end: at, values: [value!] };
      found.push(current);
    } else if (value !== null) current = null;
  }
  return found
    .map((item) => ({
      start: item.start,
      end: item.end + 3 * minuteMs,
      average:
        item.values.reduce((sum, value) => sum + value, 0) / item.values.length,
    }))
    .filter((item) => item.end - item.start >= minimumMinutes * minuteMs);
}

function duration(ms: number) {
  const minutes = Math.round(ms / minuteMs);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export type DayActivity = {
  startedAt: number;
  name: string;
  durationSeconds: number | null;
};

export function healthDayModel({
  day,
  current,
  previous,
  activities,
  now,
}: {
  day: string;
  current: WellnessDay;
  previous: WellnessDay | null;
  activities: DayActivity[];
  now: number;
}): HealthDayModel {
  const window = dayWindow(day);
  const visibleEnd = Math.min(window.end, now);
  const heartRate = inside(
    merge(previous?.heartRate, current.heartRate),
    window.start,
    visibleEnd,
  );
  const stress = inside(
    merge(previous?.stress, current.stress),
    window.start,
    visibleEnd,
  );
  const bodyBattery = inside(
    merge(previous?.bodyBattery, current.bodyBattery),
    window.start,
    visibleEnd,
  );
  const steps = inside(
    merge(previous?.steps, current.steps),
    window.start,
    visibleEnd,
  );
  const sleep = current.sleep;
  const stages = (sleep?.stages ?? [])
    .map((stage) => ({
      ...stage,
      start: Math.max(stage.start, window.start),
      end: Math.min(stage.end, window.end),
    }))
    .filter((stage) => stage.end > stage.start);
  const slots: DaySlot[] = [];
  for (
    let start = window.start;
    start < visibleEnd;
    start += slotMinutes * minuteMs
  ) {
    const end = start + slotMinutes * minuteMs;
    const stage =
      stages.find((item) => item.start < end && item.end > start)?.stage ??
      null;
    const hour = start - ((start - window.start) % (60 * minuteMs));
    slots.push({
      start,
      heartRate: average(inside(heartRate, start, end)),
      stress: average(inside(stress, start, end)),
      bodyBattery: nearest(bodyBattery, start + 5 * minuteMs, 20 * minuteMs),
      steps: nearest(steps, hour, 30 * minuteMs),
      stage,
    });
  }
  const isAsleep = (at: number) => asleep(stages, sleep, at);
  const highs = episodes(stress, (value) => value > 50, 30, isAsleep);
  const stressPeak =
    highs.sort((a, b) => b.end - b.start - (a.end - a.start))[0] ?? null;
  const calm = episodes(stress, (value) => value <= 25, 20, isAsleep)
    .filter((item) => !sleep || item.start >= sleep.end)
    .sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const calmPause = calm
    ? {
        start: calm.start,
        end: calm.end,
        gain: (() => {
          const before = nearest(bodyBattery, calm.start, 15 * minuteMs);
          const after = nearest(bodyBattery, calm.end, 15 * minuteMs);
          return before !== null && after !== null ? after - before : null;
        })(),
      }
    : null;
  const latestBattery =
    [...bodyBattery].reverse().find(([, value]) => value !== null) ?? null;
  const moments: Moment[] = [];
  if (sleep && sleep.start >= window.start)
    moments.push({
      at: sleep.start,
      title: "Coucher",
      detail: `Endormi à ${formatClock(sleep.start)}.`,
      tone: "muted",
    });
  for (const stage of stages)
    if (
      stage.stage === "awake" &&
      stage.end - stage.start >= 5 * minuteMs &&
      sleep &&
      stage.end < sleep.end - minuteMs
    )
      moments.push({
        at: stage.start,
        title: `Réveil nocturne · ${duration(stage.end - stage.start)}`,
        detail: "Puis rendormi.",
        tone: "muted",
      });
  if (sleep && sleep.end <= visibleEnd) {
    const battery =
      current.summary.bodyBatteryWake ??
      nearest(bodyBattery, sleep.end, 30 * minuteMs);
    moments.push({
      at: sleep.end,
      title:
        battery === null
          ? "Lever"
          : `Lever · Body Battery ${integer.format(battery)}`,
      detail:
        current.summary.bodyBatteryCharged === null
          ? `Nuit de ${duration(sleep.end - sleep.start)}.`
          : `Recharge de +${integer.format(current.summary.bodyBatteryCharged)} pendant la nuit.`,
      tone: "accent",
    });
  }
  for (const activity of activities)
    if (activity.startedAt >= window.start && activity.startedAt < visibleEnd)
      moments.push({
        at: activity.startedAt,
        title: activity.durationSeconds
          ? `${activity.name} · ${duration(activity.durationSeconds * 1000)}`
          : activity.name,
        detail: "Activité enregistrée par ta montre.",
        tone: "success",
      });
  for (const episode of highs.slice(0, 3))
    moments.push({
      at: episode.start,
      title: `Stress élevé · ${duration(episode.end - episode.start)}`,
      detail: `Moyenne ${integer.format(episode.average)} entre ${formatClock(episode.start)} et ${formatClock(episode.end)}.`,
      tone: "warning",
    });
  if (calmPause)
    moments.push({
      at: calmPause.start,
      title: `Pause au calme · ${duration(calmPause.end - calmPause.start)}`,
      detail:
        calmPause.gain === null
          ? "Stress au repos."
          : `Stress au repos, Body Battery ${calmPause.gain >= 0 ? "+" : "−"}${integer.format(Math.abs(calmPause.gain))}.`,
      tone: "success",
    });
  return {
    day,
    window,
    now: now < window.end ? now : null,
    slots,
    stages,
    heartRate,
    stress,
    bodyBattery,
    steps,
    sleep,
    summary: current.summary,
    latestBattery,
    restingHeartRate: current.summary.restingHeartRate,
    stressPeak,
    calmPause,
    moments: moments.sort((a, b) => a.at - b.at),
  };
}

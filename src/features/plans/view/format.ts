import {
  formatDecimal,
  formatInteger,
  formatPace,
} from "@/features/progress/format";
import type { SimpleStep } from "../model/structure";
import type { Intensity } from "../model/structure";

const weekdayShort = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}’`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h${rest === 0 ? "" : String(rest).padStart(2, "0")}`;
}

export function formatStepDuration(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDayLabel(iso: string) {
  return `${weekdayShort.format(date(iso)).replace(".", "")}. ${date(iso).getUTCDate()}`;
}

export function formatWeekdayShort(iso: string) {
  return `${weekdayShort.format(date(iso)).replace(".", "")}.`;
}

export function formatLongDay(iso: string) {
  return longDay.format(date(iso));
}

export function formatWeekRange(start: string, end: string) {
  const first = date(start);
  const last = date(end);
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${first.getUTCDate()}–${dayMonth.format(last)}`
    : `${dayMonth.format(first)} – ${dayMonth.format(last)}`;
}

export function formatElevation(meters: number) {
  return `${formatInteger(meters)} m`;
}

export function formatDistance(meters: number) {
  return `${formatDecimal(meters / 1000)} km`;
}

export function formatTarget(target: SimpleStep["target"]) {
  switch (target.kind) {
    case "pace_range":
      return `${formatPace(target.fastSecondsPerKm)}–${formatPace(target.slowSecondsPerKm)}/km`;
    case "heart_rate_range":
      return `FC ${target.minBpm}–${target.maxBpm}`;
    case "rpe":
      return target.min === target.max
        ? `Effort ${target.min}/10`
        : `Effort ${target.min}–${target.max}/10`;
    case "none":
      return "Libre";
  }
}

export const intensityZone: Record<Intensity, 1 | 2 | 3 | 4 | 5> = {
  recovery: 1,
  easy: 2,
  marathon: 3,
  threshold: 4,
  interval: 5,
  repetition: 5,
};

export const intensityLabels: Record<Intensity, string> = {
  recovery: "Récupération",
  easy: "Endurance",
  marathon: "Allure soutenue",
  threshold: "Seuil",
  interval: "Fractionné",
  repetition: "Vitesse",
};

export const intensityTimeLabels: Record<Intensity, string> = {
  recovery: "en récupération",
  easy: "en endurance",
  marathon: "en allure soutenue",
  threshold: "au seuil",
  interval: "en fractionné",
  repetition: "en vitesse",
};

export const terrainLabels: Record<string, string> = {
  road: "Route",
  trail: "Trail",
  track: "Piste",
  treadmill: "Tapis",
  mixed: "Mixte",
};

const fullDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonth = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});

export function formatFullDate(iso: string) {
  return fullDate.format(date(iso));
}

export function formatDateSpan(start: string, end: string) {
  return `${dayMonth.format(date(start))} → ${dayMonth.format(date(end))}`;
}

export function formatMonthSpan(start: string, end: string) {
  const first = shortMonth.format(date(start));
  const last = shortMonth.format(date(end));
  return first === last ? first : `${first}–${last}`;
}

export function formatTotalHours(seconds: number) {
  return `${formatInteger(seconds / 3600)} h`;
}

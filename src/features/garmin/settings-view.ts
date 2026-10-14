import { displayTimeZone } from "@/features/app-shell/shell";

const dayMs = 86_400_000;
const clock = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});
const weekday = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: displayTimeZone,
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: displayTimeZone,
});
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: displayTimeZone });

export const timelineYears = 9;

function parse(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeSince(iso: string | null | undefined, now: Date) {
  const date = parse(iso);
  if (!date) return null;
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function clockLabel(iso: string | null | undefined) {
  const date = parse(iso);
  return date ? clock.format(date) : null;
}

export function recentLabel(iso: string | null | undefined, now: Date) {
  const date = parse(iso);
  if (!date) return null;
  const time = clock.format(date);
  if (dayKey.format(date) === dayKey.format(now)) return `Aujourd’hui ${time}`;
  const age = now.getTime() - date.getTime();
  return age < 6 * dayMs
    ? `${weekday.format(date)} ${time}`
    : `${dayMonth.format(date)} ${time}`;
}

export function dayLabel(iso: string | null | undefined) {
  const date = parse(iso);
  return date ? dayMonthYear.format(date) : null;
}

export function sinceLabel(isoDate: string | null) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : monthYear.format(date);
}

export type YearCell = "full" | "partial" | "none";

export function timelineCells(
  oldestDate: string | null,
  currentYear: number,
): { years: number[]; cells: YearCell[] } {
  const years = Array.from(
    { length: timelineYears },
    (_, index) => currentYear - timelineYears + 1 + index,
  );
  if (!oldestDate) return { years, cells: years.map(() => "none") };
  const oldestYear = Number(oldestDate.slice(0, 4));
  const startedLate = oldestDate.slice(5) > "01-15";
  return {
    years,
    cells: years.map((year) =>
      year < oldestYear
        ? "none"
        : year === oldestYear && startedLate
          ? "partial"
          : "full",
    ),
  };
}

import type { GoalFocus } from "@/features/onboarding/goals";
import { focusLabels } from "@/features/onboarding/athlete-profile";

export type ShellRace = {
  name: string | null;
  priority: string;
  raceDate: string | null;
};
export type ShellGoal = { name: string; detail: string };
export type ShellRaceLink = {
  id: string;
  name: string;
  priority: string;
  date: string | null;
};
export type ShellAthlete = { name: string; initials: string; detail: string };

export const displayTimeZone = "Europe/Paris";
const dayMs = 86_400_000;
const priorityRank: Record<string, number> = { A: 0, B: 1, C: 2 };
const localDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: displayTimeZone,
});
const localTime = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});
const localDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: displayTimeZone,
});

export function formatLocalDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : localDate.format(date);
}

export function localToday(now: Date) {
  return localDay.format(now);
}

export function shellGoal(
  races: ShellRace[],
  focus: GoalFocus | null,
  today: string,
): ShellGoal | null {
  const next = races
    .filter(
      (race): race is ShellRace & { raceDate: string } =>
        race.raceDate !== null && race.raceDate >= today,
    )
    .sort(
      (a, b) =>
        (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3) ||
        a.raceDate.localeCompare(b.raceDate),
    )[0];
  if (next) {
    const days = Math.round(
      (Date.parse(`${next.raceDate}T00:00:00Z`) -
        Date.parse(`${today}T00:00:00Z`)) /
        dayMs,
    );
    return {
      name: next.name ?? "Course objectif",
      detail: `Course ${next.priority} · J-${days}`,
    };
  }
  return focus ? { name: focusLabels[focus], detail: "Objectif" } : null;
}

export function shellAthlete(
  firstName: string | null,
  email: string | null,
): ShellAthlete {
  const name = firstName?.trim() || email?.split("@")[0] || "Athlète";
  return {
    name,
    initials: name.charAt(0).toUpperCase(),
    detail: email ?? "Compte Stride",
  };
}

export function syncLabel(lastSyncAt: string | null, now: Date) {
  if (!lastSyncAt) return null;
  const synced = new Date(lastSyncAt);
  if (Number.isNaN(synced.getTime())) return null;
  return localToday(synced) === localToday(now)
    ? `Synchronisé ${localTime.format(synced)}`
    : `Synchronisé le ${localDate.format(synced)}`;
}

const raceDay = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function shellRaceDate(date: string | null) {
  return date
    ? raceDay.format(new Date(`${date}T00:00:00Z`)).replace(".", "")
    : null;
}

export function shellRaces<T extends ShellRaceLink>(races: T[], today: string) {
  return [...races].sort((a, b) => {
    const pastA = a.date !== null && a.date < today;
    const pastB = b.date !== null && b.date < today;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return (a.date ?? "9999").localeCompare(b.date ?? "9999");
  });
}

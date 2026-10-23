import type { GoalFocus } from "@/features/onboarding/goals";
import type { ProgramNav } from "@/features/plans/view/program";
import type { CoachAttention } from "./coach-attention";
import { readinessLevel } from "@/features/progress/recovery";
import { focusLabels } from "@/features/onboarding/athlete-profile";
import {
  isAnswered,
  profileFields,
  type ProfileValues,
} from "@/features/onboarding/profile";

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
export type ShellAccount = {
  profilePercent: number;
  questions: number;
};
export type ShellAthlete = { name: string; initials: string; detail: string };
export type ShellBadge = { value: string; label: string; attention: boolean };
export type ShellNavigation = {
  planNav: ProgramNav | null;
  planHistoryCount: number | null;
  coachAttention: CoachAttention | null;
  todayBadge: ShellBadge | null;
  gearBadge: ShellBadge | null;
};

export function gearBadge(count: number | null): ShellBadge | null {
  if (!count) return null;
  const label = count > 1 ? `${count} paires` : "1 paire";
  return { value: label, label, attention: false };
}

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
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const initials =
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return {
    name,
    initials: initials.toUpperCase(),
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
  return races
    .filter((race) => race.date === null || race.date >= today)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

export function shortSince(iso: string | null, now: Date) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60_000),
  );
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} j`;
}

export function shellProfileDetail(account: ShellAccount) {
  const profile = `Profil ${account.profilePercent}\u00a0%`;
  if (account.questions === 0) return profile;
  return `${profile} · ${account.questions} question${account.questions > 1 ? "s" : ""}`;
}

export function readinessBadge(score: number | null): ShellBadge | null {
  if (score === null) return null;
  const value = Math.round(score);
  return {
    value: String(value),
    label: `Disponibilité Garmin ${value} sur 100`,
    attention: readinessLevel(value) !== "high",
  };
}

export function shellAccount(
  profile: ProfileValues,
  focusMissing: boolean,
): ShellAccount {
  const answered = profileFields.filter((field) =>
    isAnswered(profile, field),
  ).length;
  return {
    profilePercent: Math.round((answered / profileFields.length) * 100),
    questions: profileFields.length - answered + (focusMissing ? 1 : 0),
  };
}

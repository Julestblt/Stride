import type { RacePriority, RaceValues } from "@/features/onboarding/goals";

export type GoalRace = { id: string; values: RaceValues };

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dayMs = 86_400_000;

export const priorityMissingCopy: Record<RacePriority, string> = {
  A: "Pas encore de course A. C’est elle qui structure tout le plan.",
  B: "Pas encore de course B. Une course importante secondaire s’intégrerait bien au plan.",
  C: "Pas encore de course C. Une course test permet de vérifier ta forme en cours de route.",
};

export function formatRaceShortDate(iso: string | null) {
  return iso
    ? shortDate.format(new Date(`${iso}T00:00:00Z`))
    : "Date à définir";
}

export function formatRaceLongDate(iso: string | null) {
  return iso ? longDate.format(new Date(`${iso}T00:00:00Z`)) : "Date à définir";
}

export function formatKm(value: number | null) {
  return value === null ? "—" : `${decimal.format(value)} km`;
}

export function formatRaceDistance(race: RaceValues) {
  const distance = formatKm(race.distance_km);
  if (race.elevation_gain_m === null) return distance;
  return race.elevation_gain_m === 0
    ? `${distance} · plat`
    : `${distance} · ${integer.format(race.elevation_gain_m)} m`;
}

export function formatTarget(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function daysUntil(iso: string, today: string) {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs,
  );
}

export function splitRaces(races: GoalRace[], today: string) {
  const dated = races.toSorted((a, b) =>
    (a.values.race_date ?? "9999").localeCompare(b.values.race_date ?? "9999"),
  );
  const upcoming = dated.filter(
    (race) => !race.values.race_date || race.values.race_date >= today,
  );
  const past = dated
    .filter((race) => race.values.race_date && race.values.race_date < today)
    .toReversed();
  const primary =
    upcoming.find(
      (race) => race.values.priority === "A" && race.values.race_date,
    ) ?? null;
  const missing = (["A", "B", "C"] as const).filter(
    (priority) => !upcoming.some((race) => race.values.priority === priority),
  );
  return { upcoming, past, primary, missing };
}

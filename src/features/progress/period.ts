import { z } from "zod";

export const progressPeriods = ["6w", "12w", "6m", "1y"] as const;
export type ProgressPeriod = (typeof progressPeriods)[number];

export const periodDays: Record<ProgressPeriod, number> = {
  "6w": 42,
  "12w": 84,
  "6m": 182,
  "1y": 365,
};

export const periodLabels: Record<ProgressPeriod, string> = {
  "6w": "6 sem.",
  "12w": "12 sem.",
  "6m": "6 mois",
  "1y": "1 an",
};

export const periodPhrases: Record<ProgressPeriod, string> = {
  "6w": "six semaines",
  "12w": "douze semaines",
  "6m": "six mois",
  "1y": "un an",
};

export const defaultPeriod: ProgressPeriod = "6m";

const periodSchema = z.enum(progressPeriods).catch(defaultPeriod);

export function parsePeriod(value: unknown): ProgressPeriod {
  return periodSchema.parse(Array.isArray(value) ? value[0] : value);
}

const dayMs = 86_400_000;

export function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs,
  );
}

export function periodStart(today: string, period: ProgressPeriod) {
  return addDays(today, -(periodDays[period] - 1));
}

export function weekStart(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

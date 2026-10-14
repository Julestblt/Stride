import { formatFrenchDate, parseFrenchDate } from "@/features/onboarding/dates";
import {
  unavailabilityKinds,
  type UnavailabilityKind,
  type UnavailablePeriod,
} from "@/features/plans/constraints";

export const weeklyCeilingMinutes = { min: 60, max: 2400 } as const;
export const maxUnavailablePeriods = 30;
export const maxReasonLength = 120;

export const unavailabilityKindLabels: Record<UnavailabilityKind, string> = {
  travel: "Voyage",
  rest: "Repos",
  other: "Autre",
};

export function timeZoneLabel(zone: string) {
  const parts = zone.split("/");
  const city = parts.at(-1)!.replaceAll("_", " ");
  return `${city} (${parts.slice(0, -1).join(" / ").replaceAll("_", " ")})`;
}

export function timeZoneOptions() {
  return Intl.supportedValuesOf("timeZone")
    .filter((zone) => zone.includes("/"))
    .map((zone) => ({ value: zone, label: timeZoneLabel(zone) }))
    .sort((first, second) => first.label.localeCompare(second.label, "fr"));
}

export function parseWeeklyCeiling(text: string): number | null | undefined {
  const value = text.trim().toLowerCase();
  if (value === "") return null;
  const clock = /^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*(?:min)?$/.exec(value);
  const decimal = /^(\d{1,2})(?:[.,](\d{1,2}))?\s*(?:h)?$/.exec(value);
  let minutes: number | null = null;
  if (clock) {
    const extra = clock[2] ? Number(clock[2]) : 0;
    if (extra >= 60) return undefined;
    minutes = Number(clock[1]) * 60 + extra;
  } else if (decimal) {
    minutes = Math.round(Number(`${decimal[1]}.${decimal[2] ?? 0}`) * 60);
  }
  if (
    minutes === null ||
    minutes < weeklyCeilingMinutes.min ||
    minutes > weeklyCeilingMinutes.max
  )
    return undefined;
  return minutes;
}

export function formatWeeklyCeiling(minutes: number | null) {
  if (minutes === null) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
}

export type UnavailabilityInput = {
  starts_on: string;
  ends_on: string;
  kind: UnavailabilityKind;
  reason: string | null;
};

export type UnavailabilityError =
  "dates" | "order" | "length" | "kind" | "reason";

export const unavailabilityErrorMessages: Record<UnavailabilityError, string> =
  {
    dates: "Saisis les dates de début et de fin au format JJ/MM/AAAA.",
    order: "La fin de la période doit tomber le jour du début ou après.",
    length: "Une période ne peut pas dépasser un an.",
    kind: "Choisis le type de période.",
    reason: `Le motif ne peut pas dépasser ${maxReasonLength} caractères.`,
  };

const dayMs = 86_400_000;

export function parseUnavailabilityInput(input: {
  start: string;
  end: string;
  kind: string;
  reason: string;
}):
  | { ok: true; value: UnavailabilityInput }
  | { ok: false; error: UnavailabilityError } {
  const startsOn = parseFrenchDate(input.start);
  const endsOn = parseFrenchDate(input.end);
  if (!startsOn || !endsOn) return { ok: false, error: "dates" };
  if (endsOn < startsOn) return { ok: false, error: "order" };
  if (
    (Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) /
      dayMs >
    365
  )
    return { ok: false, error: "length" };
  if (!(unavailabilityKinds as readonly string[]).includes(input.kind))
    return { ok: false, error: "kind" };
  const reason = input.reason.trim();
  if (reason.length > maxReasonLength) return { ok: false, error: "reason" };
  return {
    ok: true,
    value: {
      starts_on: startsOn,
      ends_on: endsOn,
      kind: input.kind as UnavailabilityKind,
      reason: reason === "" ? null : reason,
    },
  };
}

export function currentPeriods(periods: UnavailablePeriod[], today: string) {
  return periods.filter((period) => period.endsOn >= today);
}

export function formatPeriod(
  period: Pick<UnavailablePeriod, "startsOn" | "endsOn">,
) {
  return period.startsOn === period.endsOn
    ? `Le ${formatFrenchDate(period.startsOn)}`
    : `Du ${formatFrenchDate(period.startsOn)} au ${formatFrenchDate(period.endsOn)}`;
}

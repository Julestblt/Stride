export const defaultTimeZone = "Europe/Paris";
export const unavailabilityKinds = ["travel", "rest", "other"] as const;
export type UnavailabilityKind = (typeof unavailabilityKinds)[number];

export type UnavailablePeriod = {
  id: string;
  startsOn: string;
  endsOn: string;
  kind: UnavailabilityKind;
  reason: string | null;
  revision: number;
};

export type PlanningConstraints = {
  timeZone: string;
  maxWeeklyMinutes: number | null;
  unavailablePeriods: UnavailablePeriod[];
};

const timeZonePattern = /^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/;

export function isTimeZone(value: string) {
  if (!timeZonePattern.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function toPlanningConstraints(
  profile: { time_zone: string; max_weekly_minutes: number | null } | null,
  periods: {
    id: string;
    starts_on: string;
    ends_on: string;
    kind: string;
    reason: string | null;
    revision: number;
  }[],
): PlanningConstraints {
  return {
    timeZone:
      profile && isTimeZone(profile.time_zone)
        ? profile.time_zone
        : defaultTimeZone,
    maxWeeklyMinutes: profile?.max_weekly_minutes ?? null,
    unavailablePeriods: periods
      .filter(
        (period): period is typeof period & { kind: UnavailabilityKind } =>
          (unavailabilityKinds as readonly string[]).includes(period.kind),
      )
      .map((period) => ({
        id: period.id,
        startsOn: period.starts_on,
        endsOn: period.ends_on,
        kind: period.kind,
        reason: period.reason,
        revision: period.revision,
      }))
      .sort(
        (first, second) =>
          first.startsOn.localeCompare(second.startsOn) ||
          first.endsOn.localeCompare(second.endsOn),
      ),
  };
}

export function isUnavailableOn(
  constraints: PlanningConstraints,
  date: string,
) {
  return constraints.unavailablePeriods.some(
    (period) => period.startsOn <= date && date <= period.endsOn,
  );
}

export function localToday(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

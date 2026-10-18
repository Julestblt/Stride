import { formatFrenchDate } from "@/features/onboarding/dates";
import {
  addDays,
  daysBetween,
  parseIsoDate,
} from "@/features/plans/model/dates";

export type RacePriority = "A" | "B" | "C";
export type RaceRole = "primary" | "preparation" | "fun";
export type RaceKind = "road" | "trail";

export type CalendarRaceInput = {
  id: string;
  name: string | null;
  date: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  kind: RaceKind;
  role: RaceRole;
};

export const calendarRules = {
  elevationMetersPerKm: 100,
  funBeforeHardRaceDays: 7,
  funAfterRaceRecoveryShare: 0.5,
  bands: [
    { maxKmEffort: 15, recoveryDays: 14, taperDays: 10 },
    { maxKmEffort: 30, recoveryDays: 21, taperDays: 14 },
    { maxKmEffort: 60, recoveryDays: 28, taperDays: 14 },
    { maxKmEffort: null, recoveryDays: 42, taperDays: 21 },
  ],
} as const;

export type CalendarConflictCode =
  | "inside_taper"
  | "preparation_recovery_overlaps_taper"
  | "recovery_too_short"
  | "fun_too_close"
  | "fun_too_soon";

export type CalendarRace = {
  id: string;
  name: string | null;
  kind: RaceKind;
  role: RaceRole;
  date: string;
  dateLabel: string;
  weekday: string;
  weekend: boolean;
  daysFromToday: number | null;
  distanceKm: number;
  elevationGainM: number;
  kmEffort: number;
  recoveryDays: number;
  recoveryEndsOn: string;
  taperDays: number | null;
  taperStartsOn: string | null;
};

export type CalendarGap = {
  fromRaceId: string;
  toRaceId: string;
  days: number;
  weeks: number;
};

export type CalendarConflict = {
  code: CalendarConflictCode;
  firstRaceId: string;
  secondRaceId: string;
  requiredDays: number;
  actualDays: number;
};

export type CalendarCheck = {
  races: CalendarRace[];
  gaps: CalendarGap[];
  conflicts: CalendarConflict[];
  undated: CalendarRaceInput[];
  incomplete: CalendarRaceInput[];
};

const weekdays = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export function roleOfPriority(priority: RacePriority): RaceRole {
  if (priority === "A") return "primary";
  if (priority === "B") return "preparation";
  return "fun";
}

export function kmEffort(
  distanceKm: number,
  elevationGainM: number | null,
  kind: RaceKind,
) {
  const gain = kind === "road" ? 0 : (elevationGainM ?? 0);
  return (
    Math.round((distanceKm + gain / calendarRules.elevationMetersPerKm) * 10) /
    10
  );
}

export function calendarBand(effort: number) {
  return (
    calendarRules.bands.find(
      (band) => band.maxKmEffort === null || effort <= band.maxKmEffort,
    ) ?? calendarRules.bands[calendarRules.bands.length - 1]
  );
}

function isHard(race: CalendarRace) {
  return race.role !== "fun";
}

function toCalendarRace(
  input: CalendarRaceInput & { date: string; distanceKm: number },
  today: string | undefined,
): CalendarRace {
  const effort = kmEffort(input.distanceKm, input.elevationGainM, input.kind);
  const band = calendarBand(effort);
  const day = parseIsoDate(input.date).getUTCDay();
  const taperDays = input.role === "primary" ? band.taperDays : null;
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    role: input.role,
    date: input.date,
    dateLabel: formatFrenchDate(input.date),
    weekday: weekdays[day],
    weekend: day === 0 || day === 6,
    daysFromToday: today ? daysBetween(today, input.date) : null,
    distanceKm: input.distanceKm,
    elevationGainM: input.kind === "road" ? 0 : (input.elevationGainM ?? 0),
    kmEffort: effort,
    recoveryDays: band.recoveryDays,
    recoveryEndsOn: addDays(input.date, band.recoveryDays),
    taperDays,
    taperStartsOn: taperDays === null ? null : addDays(input.date, -taperDays),
  };
}

function taperConflicts(races: CalendarRace[]) {
  const conflicts: CalendarConflict[] = [];
  for (const primary of races) {
    if (primary.taperDays === null) continue;
    for (const race of races) {
      if (race === primary) continue;
      const before = daysBetween(race.date, primary.date);
      if (before < 0) continue;
      if (before < primary.taperDays) {
        conflicts.push({
          code: "inside_taper",
          firstRaceId: race.id,
          secondRaceId: primary.id,
          requiredDays: primary.taperDays,
          actualDays: before,
        });
      } else if (
        race.role === "preparation" &&
        before < race.recoveryDays + primary.taperDays
      ) {
        conflicts.push({
          code: "preparation_recovery_overlaps_taper",
          firstRaceId: race.id,
          secondRaceId: primary.id,
          requiredDays: race.recoveryDays + primary.taperDays,
          actualDays: before,
        });
      }
    }
  }
  return conflicts;
}

function sequenceConflicts(races: CalendarRace[]) {
  const conflicts: CalendarConflict[] = [];
  const push = (
    code: CalendarConflictCode,
    first: CalendarRace,
    second: CalendarRace,
    requiredDays: number,
  ) => {
    const actualDays = daysBetween(first.date, second.date);
    if (actualDays < requiredDays) {
      conflicts.push({
        code,
        firstRaceId: first.id,
        secondRaceId: second.id,
        requiredDays,
        actualDays,
      });
    }
  };
  races.forEach((race, index) => {
    if (index === 0) return;
    const previous = races[index - 1];
    if (!isHard(race)) {
      push(
        "fun_too_soon",
        previous,
        race,
        Math.ceil(
          previous.recoveryDays * calendarRules.funAfterRaceRecoveryShare,
        ),
      );
      return;
    }
    if (!isHard(previous)) {
      push(
        "fun_too_close",
        previous,
        race,
        calendarRules.funBeforeHardRaceDays,
      );
    }
    const lastHard = races.slice(0, index).findLast(isHard);
    if (lastHard) {
      push("recovery_too_short", lastHard, race, lastHard.recoveryDays);
    }
  });
  return conflicts;
}

export function checkCalendar(
  inputs: CalendarRaceInput[],
  options: { today?: string } = {},
): CalendarCheck {
  const undated: CalendarRaceInput[] = [];
  const incomplete: CalendarRaceInput[] = [];
  const races: CalendarRace[] = [];
  for (const input of inputs) {
    const { date, distanceKm } = input;
    if (date === null) undated.push(input);
    else if (distanceKm === null || distanceKm <= 0) incomplete.push(input);
    else
      races.push(toCalendarRace({ ...input, date, distanceKm }, options.today));
  }
  races.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const gaps = races.slice(1).map((race, index) => {
    const days = daysBetween(races[index].date, race.date);
    return {
      fromRaceId: races[index].id,
      toRaceId: race.id,
      days,
      weeks: Math.round((days / 7) * 10) / 10,
    };
  });
  return {
    races,
    gaps,
    conflicts: [...taperConflicts(races), ...sequenceConflicts(races)],
    undated,
    incomplete,
  };
}

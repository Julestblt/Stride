import type { PlanningConstraints } from "../constraints";
import { addDays, daysBetween, isoWeekday, mondayOf } from "../model/dates";
import { sessionKey } from "../model/keys";
import type {
  PlanBlock,
  PlanSession,
  PlanState,
  SessionContent,
} from "../model/plan";
import type { Skeleton, Availability } from "../skeleton/skeleton";
import type { TrainingTargets } from "../targets/targets";
import type { PlanTemplate } from "../templates/templates";
import {
  easyRun,
  fitQualitySession,
  longRun,
  recoveryRun,
  type LibraryContext,
  type QualityKind,
} from "../library/library";

export const defaultWeekdays = [2, 3, 4, 6, 7];
export const minimumEasySeconds = 1_500;
export const easyStepSeconds = 300;
export const ultraKm = 42.2;
export const climbRate = 0.25;

export type DetailingAvailability = Availability & {
  trainingAccess: string[];
};

type ReadySkeleton = Extract<Skeleton, { status: "ready" }>;

type Phase =
  "lead_in" | "base" | "development" | "specific" | "taper" | "recovery";

const phaseByBlock: Record<PlanBlock["kind"], Phase> = {
  lead_in: "lead_in",
  base: "base",
  build: "development",
  specific: "specific",
  taper: "taper",
  race: "taper",
  recovery: "recovery",
  transition: "recovery",
};

const qualityPreference = [2, 4, 3, 5, 1, 6, 7];

function raceSpecificKind(template: PlanTemplate): QualityKind {
  if (template.sport === "trail") return "long_hills";
  if (template.id === "road_5_10k") return "ten_k_pace";
  if (template.id === "road_half") return "half_pace";
  if (template.id === "road_marathon") return "marathon_pace";
  return "tempo";
}

export function qualityKinds(
  phase: Phase,
  template: PlanTemplate,
  access: string[],
  week = 0,
): QualityKind[] {
  const trail = template.sport === "trail";
  const alternate = week % 2 === 1;
  const hills: QualityKind =
    trail || access.includes("hills")
      ? "long_hills"
      : access.includes("incline_treadmill")
        ? "treadmill_incline"
        : "vo2";
  switch (phase) {
    case "lead_in":
    case "base":
      return [trail ? (alternate ? "fartlek" : "short_hills") : "tempo"];
    case "development":
      return trail
        ? ["threshold", hills]
        : ["threshold", alternate ? "fartlek" : "vo2"];
    case "specific":
    case "taper":
      return [raceSpecificKind(template), "threshold"];
    case "recovery":
      return [];
  }
}

const isWeekday = (date: string) => isoWeekday(date) <= 5;

function weekdayCap(availability: DetailingAvailability) {
  return availability.weekdaySessionMinutes !== null &&
    availability.weekdaySessionMinutes < 90
    ? availability.weekdaySessionMinutes * 60
    : null;
}

function blockedDates(
  constraints: PlanningConstraints,
  races: { date: string; distanceKm: number }[],
) {
  const blocked = new Set<string>();
  for (const race of races) {
    blocked.add(race.date);
    blocked.add(addDays(race.date, -1));
    const after = race.distanceKm > ultraKm ? 3 : 1;
    for (let day = 1; day <= after; day += 1)
      blocked.add(addDays(race.date, day));
  }
  for (const period of constraints.unavailablePeriods)
    for (
      let date = period.startsOn;
      date <= period.endsOn;
      date = addDays(date, 1)
    )
      blocked.add(date);
  return blocked;
}

function spread<T>(items: T[], count: number) {
  if (count >= items.length) return items;
  if (count <= 0) return [];
  return Array.from(
    { length: count },
    (_, index) =>
      items[Math.round((index * (items.length - 1)) / Math.max(count - 1, 1))],
  ).filter((item, index, all) => all.indexOf(item) === index);
}

type Placed = { date: string; content: SessionContent };

function uphillSeconds(session: SessionContent) {
  return session.structure.reduce(
    (total, step) =>
      step.type === "repeat"
        ? total +
          step.count *
            step.steps
              .filter((inner) => inner.type === "work")
              .reduce(
                (sum, inner) =>
                  sum + (inner.end.kind === "time" ? inner.end.seconds : 0),
                0,
              )
        : total,
    0,
  );
}

export type DetailingInput = {
  skeleton: ReadySkeleton;
  targets: TrainingTargets;
  availability: DetailingAvailability;
  constraints: PlanningConstraints;
};

export function detailPlan(input: DetailingInput): PlanState {
  const { skeleton, targets, availability, constraints } = input;
  const { state, template } = skeleton;
  const raceSessions = state.sessions.filter(
    (session) => session.kind === "race",
  );
  const races = raceSessions.map((session) => ({
    date: session.scheduledOn,
    distanceKm: (session.targets.distanceMeters ?? 0) / 1000,
  }));
  const blocked = blockedDates(constraints, races);
  const weekdays = availability.availableWeekdays?.length
    ? availability.availableWeekdays
    : defaultWeekdays;
  const cap = weekdayCap(availability);
  const road: LibraryContext = { targets, terrain: "road" };
  const trail: LibraryContext = {
    targets,
    terrain: template.sport === "trail" ? "trail" : "road",
  };
  const levels = new Map<string, number>();
  const placed: Placed[] = [];
  let previousLongDate: string | null = null;

  for (const week of state.weeks) {
    const block = state.blocks.find((item) => item.blockKey === week.blockKey)!;
    const phase = phaseByBlock[block.kind];
    const counter = levels.get(block.blockKey) ?? 0;
    const lighter = week.weekType === "recovery";
    const level =
      phase === "taper" ? 0 : lighter ? Math.max(0, counter - 2) : counter;
    if (!lighter && phase !== "taper") levels.set(block.blockKey, counter + 1);

    const target = week.targets.durationSeconds;
    const dates = weekdays
      .map((day) => addDays(week.weekStart, day - 1))
      .filter((date) => !blocked.has(date))
      .sort();
    const raceInWeek = races.some(
      (race) => mondayOf(race.date) === week.weekStart,
    );
    if (target <= 0 || dates.length === 0) continue;

    const weekSessions: Placed[] = [];
    let longDate: string | null = null;
    if (!raceInWeek && week.targets.longRunSeconds) {
      const preferred =
        availability.longRunDay === "saturday"
          ? 6
          : availability.longRunDay === "sunday"
            ? 7
            : null;
      longDate =
        dates.find((date) => isoWeekday(date) === preferred) ??
        dates.find((date) => isoWeekday(date) === 7) ??
        dates.find((date) => isoWeekday(date) === 6) ??
        dates.at(-1)!;
      const seconds = Math.min(week.targets.longRunSeconds, target);
      weekSessions.push({
        date: longDate,
        content:
          phase === "recovery"
            ? recoveryRun(road, Math.round(seconds / 60) * 60)
            : longRun(trail, Math.round(seconds / 60) * 60),
      });
    }

    const nearRace = (date: string) =>
      races.some((race) => {
        const days = daysBetween(date, race.date);
        return days >= 0 && days <= 2;
      });
    const kinds = qualityKinds(
      phase,
      template,
      availability.trainingAccess,
      counter,
    ).slice(0, raceInWeek ? 1 : week.targets.qualitySessions);
    const qualityDates: string[] = [];
    const candidates = dates
      .filter((date) => date !== longDate)
      .sort(
        (first, second) =>
          qualityPreference.indexOf(isoWeekday(first)) -
          qualityPreference.indexOf(isoWeekday(second)),
      );
    for (const date of candidates) {
      if (qualityDates.length >= kinds.length) break;
      const afterLong =
        (longDate && addDays(longDate, 1) === date) ||
        (previousLongDate && addDays(previousLongDate, 1) === date);
      const beforeLong = longDate && addDays(date, 1) === longDate;
      const spaced = qualityDates.every(
        (other) => Math.abs(daysBetween(other, date)) >= 2,
      );
      if (!afterLong && !beforeLong && spaced && !nearRace(date))
        qualityDates.push(date);
    }
    let budget =
      target -
      weekSessions.reduce(
        (total, item) => total + item.content.targets.durationSeconds,
        0,
      );
    qualityDates.forEach((date, index) => {
      const kind = kinds[index];
      const context =
        kind === "short_hills" || kind === "long_hills" || kind === "fartlek"
          ? trail
          : road;
      const session = fitQualitySession(
        context,
        kind,
        level,
        isWeekday(date) ? cap : null,
      );
      if (session && session.targets.durationSeconds <= budget) {
        weekSessions.push({ date, content: session });
        budget -= session.targets.durationSeconds;
      }
    });

    const used = new Set(weekSessions.map((item) => item.date));
    const easyDates = dates.filter((date) => !used.has(date));
    let count = easyDates.length;
    while (count > 0 && budget / count < minimumEasySeconds) count -= 1;
    const chosen = spread(easyDates, count);
    const strides =
      ["lead_in", "base", "development"].includes(phase) && !lighter;
    chosen.forEach((date, index) => {
      let seconds =
        Math.floor(budget / chosen.length / easyStepSeconds) * easyStepSeconds;
      const dayCap = isWeekday(date) ? cap : null;
      if (dayCap !== null) seconds = Math.min(seconds, dayCap);
      if (seconds < minimumEasySeconds) return;
      weekSessions.push({
        date,
        content:
          phase === "recovery"
            ? recoveryRun(road, seconds)
            : easyRun(road, seconds, strides && index === 0),
      });
    });

    const elevation =
      phase === "recovery" ? null : week.targets.elevationGainMeters;
    const climbing = new Map(
      weekSessions
        .filter(
          (item) =>
            item.content.terrain === "trail" && item.content.kind === "hills",
        )
        .map((item) => [
          item,
          Math.round(uphillSeconds(item.content) * climbRate),
        ]),
    );
    const hillsTotal = [...climbing.values()].reduce(
      (total, value) => total + value,
      0,
    );
    for (const item of weekSessions) {
      const trailLong =
        item.content.terrain === "trail" && item.content.kind === "long";
      const share =
        elevation === null
          ? null
          : climbing.has(item)
            ? Math.min(climbing.get(item)!, elevation)
            : trailLong
              ? Math.max(0, elevation - hillsTotal)
              : null;
      placed.push({
        date: item.date,
        content: {
          ...item.content,
          targets: { ...item.content.targets, elevationGainMeters: share },
        },
      });
    }
    previousLongDate = longDate;
  }

  const keys = new Set(state.sessions.map((session) => session.sessionKey));
  const sessions: PlanSession[] = [...state.sessions];
  for (const item of placed.sort((first, second) =>
    first.date.localeCompare(second.date),
  )) {
    const key = sessionKey(item.date, keys);
    keys.add(key);
    sessions.push({ ...item.content, sessionKey: key, scheduledOn: item.date });
  }
  return {
    ...state,
    sessions: sessions.sort(
      (first, second) =>
        first.scheduledOn.localeCompare(second.scheduledOn) ||
        first.sessionKey.localeCompare(second.sessionKey),
    ),
  };
}

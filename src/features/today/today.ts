import {
  activityKind,
  activityTitle,
  formatDistance as formatActivityDistance,
  formatPace as formatActivityPace,
  type Activity,
} from "@/features/activities/activities";
import type { MatchStatus } from "@/features/plans/matching/adherence";
import { addDays } from "@/features/plans/model/dates";
import type { PlanState } from "@/features/plans/model/plan";
import {
  formatDistance,
  formatDuration,
  formatLongDay,
} from "@/features/plans/view/format";
import {
  sessionFamilyOf,
  type DayState,
  type ProgramOverview,
  type ProgramRace,
  type SessionFamily,
} from "@/features/plans/view/program";
import type { SessionPanel } from "@/features/plans/view/session-panel";
import { formatClock, formatInteger } from "@/features/progress/format";
import { loadZone } from "@/features/progress/health";
import type { Readiness, RecoveryModel } from "@/features/progress/recovery";
import {
  formatSleep,
  recoveryView,
  type DeviationKey,
} from "@/features/progress/recovery-view";

export type TodayRace = {
  id: string;
  letter: string;
  name: string;
  days: number;
};

export type TodayHeader = {
  date: string;
  goal: TodayRace | null;
  week: string | null;
  next: TodayRace | null;
};

export type TodaySessionStat = { key: string; value: string; label: string };

export type TodaySession =
  | {
      kind: "session";
      panel: SessionPanel;
      stats: TodaySessionStat[];
      terrain: string | null;
      href: string;
    }
  | {
      kind: "rest";
      next: { title: string; when: string; href: string } | null;
    }
  | { kind: "none" };

export type SignalTone = "warning" | "success" | "muted";

export type ReadinessRow = {
  key: "sleep" | "hrv" | "resting" | "load";
  label: string;
  value: string;
  note: string;
  direction: "up" | "down" | null;
  tone: SignalTone;
};

export type TodayReadiness = {
  score: number | null;
  level: string | null;
  tone: "success" | "warning" | "danger";
  context: string | null;
  rows: ReadinessRow[];
};

export type TodayWeekDay = {
  date: string;
  letter: string;
  family: SessionFamily;
  title: string;
  state: DayState;
  isToday: boolean;
  isPast: boolean;
  label: string;
};

export type TodayWeek = {
  number: number;
  blockName: string;
  days: TodayWeekDay[];
  done: { duration: string; distance: string | null };
  planned: { duration: string; distance: string | null };
  pct: number;
  href: string;
};

export type TodayUpcoming = {
  key: string;
  family: SessionFamily;
  title: string;
  detail: string | null;
  when: string;
  date: string;
  href: string;
};

export type TodayLatest = {
  heading: string;
  title: string;
  family: SessionFamily;
  detail: string;
  compliance: { pct: number | null; partial: boolean } | null;
  href: string;
};

export type TodayView = {
  header: TodayHeader;
  session: TodaySession;
  readiness: TodayReadiness;
  week: TodayWeek | null;
  upcoming: TodayUpcoming[];
  latest: TodayLatest | null;
};

export type TodayMatch = {
  sessionKey: string;
  activityId: string | null;
  status: MatchStatus;
  compliance: { duration: number | null };
};

export type TodayInput = {
  today: string;
  plan: PlanState | null;
  program: ProgramOverview | null;
  races: ProgramRace[];
  matches: TodayMatch[];
  panel: SessionPanel | null;
  recovery: RecoveryModel;
  latest: Activity | null;
};

const dayMs = 86_400_000;
const weekdayLetters = ["L", "M", "M", "J", "V", "S", "D"];
const priorityRank: Record<string, number> = { A: 0, B: 1, C: 2 };

const weekday = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: "UTC",
});
const numericDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const hundredths = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const levelLabels: Record<Readiness["level"], string> = {
  high: "Élevée",
  moderate: "Modérée",
  low: "Basse",
  poor: "Faible",
};

const levelTones: Record<Readiness["level"], TodayReadiness["tone"]> = {
  high: "success",
  moderate: "warning",
  low: "danger",
  poor: "danger",
};

const causeLabels: Record<DeviationKey, string> = {
  sleep: "c’est le sommeil",
  hrv: "c’est la VFC",
  resting: "c’est la FC au repos",
  load: "c’est la charge",
  legs: "ce sont les jambes",
};

const loadLabels = {
  low: "charge basse",
  productive: "zone productive",
  high: "charge élevée",
} as const;

const statOrder = ["duration", "distance", "pace", "heart-rate", "intensity"];

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs,
  );
}

function sign(value: number) {
  return value > 0 ? "+" : value < 0 ? "−" : "±";
}

export function formatTodayDate(iso: string) {
  const value = new Date(`${iso}T00:00:00Z`);
  return `${weekday.format(value)} ${numericDate.format(value)}`;
}

function raceLetter(race: ProgramRace) {
  return race.priority ?? "·";
}

function upcomingRaces(races: ProgramRace[], today: string) {
  return races
    .filter(
      (race): race is ProgramRace & { date: string } =>
        race.date !== null && race.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function todayRace(race: ProgramRace & { date: string }, today: string) {
  return {
    id: race.id,
    letter: raceLetter(race),
    name: race.name,
    days: daysBetween(today, race.date),
  };
}

function header(input: TodayInput): TodayHeader {
  const races = upcomingRaces(input.races, input.today);
  const primary = input.plan?.plan.primaryRaceId ?? null;
  const goal =
    races.find((race) => race.id === primary) ??
    [...races].sort(
      (a, b) =>
        (priorityRank[a.priority ?? ""] ?? 3) -
          (priorityRank[b.priority ?? ""] ?? 3) || a.date.localeCompare(b.date),
    )[0] ??
    null;
  const next = races.find((race) => race !== goal) ?? null;
  const program = input.program;
  const current = program?.weeks.find(
    (week) => week.weekKey === program.currentWeekKey,
  );
  return {
    date: formatTodayDate(input.today),
    goal: goal ? todayRace(goal, input.today) : null,
    week:
      current && program
        ? `S${current.number} / ${program.weeks.length} · ${current.blockName}`
        : null,
    next: next ? todayRace(next, input.today) : null,
  };
}

function session(input: TodayInput): TodaySession {
  const { panel, plan, today } = input;
  if (panel) {
    const stats = statOrder
      .flatMap((key) => panel.stats.filter((stat) => stat.key === key))
      .slice(0, 4);
    return {
      kind: "session",
      panel,
      stats,
      terrain:
        panel.stats.find((stat) => stat.key === "terrain")?.value ?? null,
      href: `/plan?seance=${encodeURIComponent(panel.sessionKey)}`,
    };
  }
  if (!plan) return { kind: "none" };
  const next = plan.sessions
    .filter(
      (item) =>
        item.scheduledOn > today &&
        item.kind !== "rest" &&
        item.sport !== "rest",
    )
    .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0];
  return {
    kind: "rest",
    next: next
      ? {
          title: next.title,
          when: formatLongDay(next.scheduledOn),
          href: `/plan?seance=${encodeURIComponent(next.sessionKey)}`,
        }
      : null,
  };
}

function readiness(model: RecoveryModel): TodayReadiness {
  const { sleep, hrv, restingHeartRate, load } = model;
  const rows: ReadinessRow[] = [];
  if (sleep) {
    const gap = sleep.average === null ? null : sleep.last - sleep.average;
    const minutes = gap === null ? 0 : Math.round(gap / 60);
    rows.push({
      key: "sleep",
      label: "Sommeil",
      value: formatSleep(sleep.last),
      note:
        gap === null
          ? "moyenne en cours de calcul"
          : `${sign(minutes)}${formatSleep(Math.abs(gap))} vs ta moyenne`,
      direction: minutes < 0 ? "down" : minutes > 0 ? "up" : null,
      tone: sleep.trend === "watch" ? "warning" : "muted",
    });
  }
  if (hrv) {
    const range = hrv.range;
    const span = range
      ? range.low === range.high
        ? `${range.low}`
        : `${range.low}–${range.high}`
      : null;
    rows.push({
      key: "hrv",
      label: "VFC",
      value: `${formatInteger(hrv.last)} ms`,
      note:
        span === null
          ? "plage en cours de calcul"
          : hrv.position === "below"
            ? `sous ta plage ${span}`
            : hrv.position === "above"
              ? `au-dessus de ta plage ${span}`
              : `dans ta plage ${span}`,
      direction:
        hrv.position === "below"
          ? "down"
          : hrv.position === "above"
            ? "up"
            : null,
      tone: hrv.position === "below" ? "warning" : "muted",
    });
  }
  if (restingHeartRate) {
    const gap =
      restingHeartRate.median === null
        ? null
        : Math.round(restingHeartRate.last - restingHeartRate.median);
    rows.push({
      key: "resting",
      label: "FC repos",
      value: `${formatInteger(restingHeartRate.last)} bpm`,
      note:
        gap === null
          ? "habitude en cours de calcul"
          : `${sign(gap)}${formatInteger(Math.abs(gap))} vs d’habitude`,
      direction: gap === null || gap === 0 ? null : gap > 0 ? "up" : "down",
      tone: restingHeartRate.position === "above" ? "warning" : "muted",
    });
  }
  if (load) {
    const zone = loadZone(load.ratio);
    rows.push({
      key: "load",
      label: "Charge",
      value: hundredths.format(load.ratio),
      note: loadLabels[zone],
      direction: null,
      tone: zone === "productive" ? "success" : "warning",
    });
  }
  const score = model.readiness;
  const worst =
    score?.trend === "watch"
      ? recoveryView(model)
          .deviations.filter(
            (item) => item.score !== null && item.score <= -0.25,
          )
          .sort((a, b) => a.score! - b.score!)[0]
      : undefined;
  const context = score
    ? [
        score.average !== null && `moy. 14 j : ${formatInteger(score.average)}`,
        worst && causeLabels[worst.key],
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;
  return {
    score: score?.today ?? null,
    level: score ? levelLabels[score.level] : null,
    tone: score ? levelTones[score.level] : "warning",
    context,
    rows,
  };
}

function week(program: ProgramOverview | null): TodayWeek | null {
  const current = program?.weeks.find(
    (item) => item.weekKey === program.currentWeekKey,
  );
  if (!current) return null;
  const distance = (meters: number | null, estimated: boolean) =>
    meters === null
      ? null
      : `${estimated ? "≈ " : ""}${formatDistance(meters)}`;
  const stateLabels: Record<Exclude<DayState, null>, string> = {
    done: "fait",
    partial: "fait en partie",
    substituted: "remplacé",
    missed: "non fait",
    proposed: "changement proposé",
  };
  return {
    number: current.number,
    blockName: current.blockName,
    days: current.days.map((day, index) => {
      const state = day.family === "rest" ? null : day.state;
      return {
        date: day.date,
        letter: weekdayLetters[index] ?? day.weekday.charAt(0).toUpperCase(),
        family: day.family,
        title: day.title,
        state,
        isToday: day.isToday,
        isPast: day.isPast,
        label: [
          formatLongDay(day.date),
          day.title,
          day.isToday ? "aujourd’hui" : null,
          state ? stateLabels[state] : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }),
    done: {
      duration: formatDuration(current.done.durationSeconds),
      distance: distance(
        current.done.distanceMeters,
        current.done.distanceEstimated,
      ),
    },
    planned: {
      duration: formatDuration(current.totals.durationSeconds),
      distance: distance(
        current.totals.distanceMeters,
        current.totals.distanceEstimated,
      ),
    },
    pct:
      current.totals.durationSeconds > 0
        ? Math.min(
            100,
            Math.round(
              (current.done.durationSeconds / current.totals.durationSeconds) *
                100,
            ),
          )
        : 0,
    href: `/plan?week=${current.weekStart}`,
  };
}

function upcoming(input: TodayInput): TodayUpcoming[] {
  const { plan, program, today } = input;
  const items: TodayUpcoming[] = [];
  const key = plan?.sessions
    .filter(
      (item) => item.isKey && item.kind !== "race" && item.scheduledOn > today,
    )
    .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0];
  if (key)
    items.push({
      key: `session-${key.sessionKey}`,
      family: sessionFamilyOf(key),
      title: `${key.title} · ${formatDuration(key.targets.durationSeconds)}`,
      detail:
        [
          key.targets.distanceMeters !== null &&
            formatDistance(key.targets.distanceMeters),
          key.targets.elevationGainMeters !== null &&
            `${formatInteger(key.targets.elevationGainMeters)} m D+`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      when: formatLongDay(key.scheduledOn),
      date: key.scheduledOn,
      href: `/plan?seance=${encodeURIComponent(key.sessionKey)}`,
    });
  if (program) {
    const index = program.weeks.findIndex(
      (item) => item.isLight && item.weekStart > today && !item.race,
    );
    const light = program.weeks[index];
    if (light) {
      const previous = program.weeks[index - 1];
      items.push({
        key: `week-${light.weekKey}`,
        family: "easy",
        title: "Semaine allégée",
        detail: [
          `S${light.number}`,
          previous && previous.totals.durationSeconds > 0
            ? `${formatDuration(light.totals.durationSeconds)} au lieu de ${formatDuration(previous.totals.durationSeconds)}`
            : formatDuration(light.totals.durationSeconds),
        ].join(" · "),
        when: formatLongDay(light.weekStart),
        date: light.weekStart,
        href: `/plan?week=${light.weekStart}`,
      });
    }
  }
  const race = upcomingRaces(input.races, today).find(
    (item) => item.date > today,
  );
  if (race)
    items.push({
      key: `race-${race.id}`,
      family: "race",
      title: race.name,
      detail: [
        race.priority && `Course ${race.priority}`,
        race.targetSeconds !== null &&
          `cible ${formatClock(race.targetSeconds)}`,
        `J-${daysBetween(today, race.date)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      when: formatLongDay(race.date),
      date: race.date,
      href: `/races/${race.id}`,
    });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function latest(input: TodayInput): TodayLatest | null {
  const activity = input.latest;
  if (!activity) return null;
  const { today } = input;
  const heading =
    activity.date === today
      ? "Aujourd’hui"
      : activity.date === addDays(today, -1)
        ? "Hier"
        : `Dernière activité · ${formatLongDay(activity.date)}`;
  const match = input.matches.find((item) => item.activityId === activity.id);
  const session = match
    ? input.plan?.sessions.find((item) => item.sessionKey === match.sessionKey)
    : undefined;
  const kind = activityKind(activity.type);
  const pace =
    activity.distanceMeters &&
    activity.distanceMeters >= 100 &&
    activity.durationSeconds &&
    kind !== "other"
      ? `${formatActivityPace(activity.distanceMeters, activity.durationSeconds)} /km`
      : null;
  const title = session ? session.title : activityTitle(activity);
  return {
    heading,
    title: activity.durationSeconds
      ? `${title} · ${formatDuration(activity.durationSeconds)}`
      : title,
    family: session
      ? sessionFamilyOf(session)
      : kind === "trail"
        ? "long_trail"
        : kind === "road"
          ? "easy"
          : "cross",
    detail:
      [
        activity.distanceMeters !== null &&
          `${formatActivityDistance(activity.distanceMeters)} km`,
        pace,
        activity.averageHeartRate !== null &&
          `FC ${formatInteger(activity.averageHeartRate)}`,
      ]
        .filter(Boolean)
        .join(" · ") || formatLongDay(activity.date),
    compliance:
      match && (match.status === "completed" || match.status === "partial")
        ? {
            pct:
              match.compliance.duration === null
                ? null
                : Math.round(match.compliance.duration * 100),
            partial: match.status === "partial",
          }
        : null,
    href: `/activities/${activity.id}`,
  };
}

export function todaySessionKey(plan: PlanState | null, today: string) {
  if (!plan) return null;
  const sessions = plan.sessions.filter(
    (item) =>
      item.scheduledOn === today &&
      item.kind !== "rest" &&
      item.sport !== "rest",
  );
  return (
    sessions.find((item) => item.isKey)?.sessionKey ??
    sessions[0]?.sessionKey ??
    null
  );
}

export function buildToday(input: TodayInput): TodayView {
  return {
    header: header(input),
    session: session(input),
    readiness: readiness(input.recovery),
    week: week(input.program),
    upcoming: upcoming(input),
    latest: latest(input),
  };
}

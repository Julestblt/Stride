import type { SessionBlock } from "@/components/stride/session-blocks";
import type { SessionTileKind } from "@/components/stride/session-kind-tile";
import {
  sessionStatuses,
  planAdherence,
  type MatchStatus,
} from "../matching/adherence";
import { addDays } from "../model/dates";
import { formatClock, formatDayMonthShort } from "@/features/progress/format";
import type {
  PlanBlock,
  PlanSession,
  PlanState,
  PlanWeek,
} from "../model/plan";
import { structureTotals, type IntensityPaces } from "../model/structure";
import {
  isRunningSession,
  sessionDistance,
  type SessionDistance,
} from "../model/volume";
import {
  formatDateSpan,
  formatDistance,
  formatDuration,
  formatElevation,
  formatLongDay,
  formatMonthSpan,
  formatWeekRange,
  formatWeekdayShort,
} from "./format";
import { sessionBlocks, weekStats } from "./plan-view";

export type SessionFamily = SessionTileKind;

export const familyLabels: Record<SessionFamily, string> = {
  easy: "Footing",
  long: "Sortie longue",
  long_trail: "Sortie longue trail",
  tempo: "Allure soutenue",
  threshold: "Seuil",
  intervals: "Fractionné",
  hills: "Côtes",
  race_specific: "Spécifique course",
  strength: "Renfo",
  mobility: "Mobilité",
  cross: "Sport croisé",
  race: "Course",
  rest: "Repos",
};

export function sessionFamilyOf(session: PlanSession): SessionFamily {
  if (session.kind === "race") return "race";
  if (session.kind === "rest" || session.sport === "rest") return "rest";
  if (session.kind === "strength" || session.sport === "strength")
    return "strength";
  if (session.kind === "mobility") return "mobility";
  if (session.kind === "cross" || session.sport === "cross") return "cross";
  if (session.kind === "long")
    return session.sport === "trail" || session.terrain === "trail"
      ? "long_trail"
      : "long";
  if (session.kind === "easy" || session.kind === "recovery") return "easy";
  return session.kind;
}

export type ProgramRace = {
  id: string;
  name: string;
  date: string | null;
  priority: "A" | "B" | "C" | null;
  targetSeconds: number | null;
};

export type ProgramMatch = {
  sessionKey: string;
  status: MatchStatus;
  compliance: { duration: number | null; distance: number | null };
};

export type ProgramInput = {
  state: PlanState;
  today: string;
  summary: string | null;
  matches: ProgramMatch[];
  proposalKeys: string[];
  races: ProgramRace[];
  paces?: IntensityPaces | null;
};

export type WeekStatus = "past" | "current" | "future";
export type LabelTone = "muted" | "provider" | "success" | "accent";
export type DayState =
  "done" | "partial" | "substituted" | "missed" | "proposed" | null;

export type ProgramDay = {
  date: string;
  weekday: string;
  dayNumber: number;
  sessionKey: string | null;
  family: SessionFamily;
  title: string;
  summary: string | null;
  elevation: string | null;
  blocks: SessionBlock[];
  state: DayState;
  compliancePct: number | null;
  isToday: boolean;
  isPast: boolean;
};

export type ProgramTotals = {
  durationSeconds: number;
  distanceMeters: number | null;
  distanceEstimated: boolean;
  elevationMeters: number | null;
};

export type ProgramWeek = {
  weekKey: string;
  weekStart: string;
  number: number;
  numberInBlock: number;
  blockName: string;
  daysUntil: number;
  range: string;
  label: string;
  labelTone: LabelTone;
  isDefaultLabel: boolean;
  sidebarLabel: string;
  isLight: boolean;
  families: SessionFamily[];
  totals: ProgramTotals;
  done: ProgramTotals;
  easySeconds: number;
  qualitySeconds: number;
  easyPct: number;
  status: WeekStatus;
  completionPct: number | null;
  proposed: boolean;
  race: { letter: string; primary: boolean } | null;
  note: string | null;
  days: ProgramDay[];
};

export type ProgramBlock = {
  blockKey: string;
  index: number;
  name: string;
  objective: string;
  span: string;
  months: string;
  totals: ProgramTotals;
  weeks: ProgramWeek[];
  current: boolean;
};

export type ProgramKpi = { key: string; label: string; value: string };

export type BandTone = "dim" | "provider" | "terrain" | "success" | "accent";

export type ProgramBand = {
  key: string;
  name: string;
  start: number;
  span: number;
  tone: BandTone;
  current: boolean;
};

export type ProgramNested = {
  raceId: string;
  letter: string;
  name: string;
  start: number;
  span: number;
};

export type MilestoneTone =
  "provider" | "accent" | "terrain" | "quality" | "success";

export type ProgramMilestone = {
  key: string;
  weekKey: string;
  number: number;
  label: string;
  when: string;
  tone: MilestoneTone;
};

export type ProgramTab = {
  letter: string;
  name: string;
  when: string | null;
  detail: string | null;
  primary: boolean;
};

export type RaceProgram = {
  raceId: string | null;
  tab: ProgramTab | null;
  eyebrow: string;
  title: string;
  summary: string | null;
  kpis: ProgramKpi[];
  weeks: ProgramWeek[];
  bands: ProgramBand[];
  nested: ProgramNested[];
  milestones: ProgramMilestone[];
  defaultWeekKey: string | null;
};

export type ProgramOverview = {
  programs: RaceProgram[];
  blocks: ProgramBlock[];
  weeks: ProgramWeek[];
  currentWeekKey: string | null;
};

const weekTypeLabels: Record<PlanWeek["weekType"], string> = {
  lead_in: "Reprise",
  build: "Construction",
  recovery: "Allégée",
  taper: "Affûtage",
  race: "Course",
  post_race: "Récupération",
};

const labelTones: Record<PlanWeek["weekType"], LabelTone> = {
  lead_in: "muted",
  build: "muted",
  recovery: "provider",
  taper: "success",
  race: "accent",
  post_race: "muted",
};

const easyIntensities = new Set(["recovery", "easy"]);

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

function presentSum(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? sum(present) : null;
}

function completeDistance(
  distances: (SessionDistance | null)[],
): SessionDistance | null {
  if (distances.length === 0) return null;
  let meters = 0;
  let estimated = false;
  for (const distance of distances) {
    if (distance === null) return null;
    meters += distance.meters;
    estimated ||= distance.estimated;
  }
  return { meters, estimated };
}

function approximate(text: string, estimated: boolean) {
  return estimated ? `≈ ${text}` : text;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function matchesProposal(keys: Set<string>, prefix: string, key: string) {
  return keys.has(key) || keys.has(`${prefix}:${key}`);
}

function mainSession(sessions: PlanSession[]) {
  return (
    sessions.find((session) => session.kind === "race") ??
    [...sessions].sort(
      (first, second) =>
        second.targets.durationSeconds - first.targets.durationSeconds,
    )[0] ??
    null
  );
}

function ratio(value: number | null) {
  return value === null ? 1 : Math.min(value, 1.5);
}

export function buildProgram(input: ProgramInput): ProgramOverview {
  const { state, today } = input;
  const paces = input.paces ?? null;
  const statuses = sessionStatuses(input.matches);
  const compliance = new Map(
    input.matches.map((match) => [match.sessionKey, match.compliance]),
  );
  const proposalKeys = new Set(input.proposalKeys);
  const planRaceIds = new Set([
    state.plan.primaryRaceId,
    ...state.plan.raceRoles.map((role) => role.raceId),
  ]);
  const raceOn = (date: string) =>
    input.races.find((race) => race.date === date) ?? null;
  const planRaceIn = (start: string, end: string) =>
    input.races.find(
      (race) =>
        planRaceIds.has(race.id) &&
        race.date !== null &&
        race.date >= start &&
        race.date <= end,
    ) ?? null;

  const weeks: ProgramWeek[] = state.weeks.map((week, index) => {
    const end = addDays(week.weekStart, 6);
    const sessions = state.sessions.filter(
      (session) =>
        session.scheduledOn >= week.weekStart && session.scheduledOn <= end,
    );
    const status: WeekStatus =
      end < today ? "past" : week.weekStart <= today ? "current" : "future";
    const raceSession = sessions.find((session) => session.kind === "race");
    const race = raceSession
      ? raceOn(raceSession.scheduledOn)
      : planRaceIn(week.weekStart, end);
    const isPrimaryRace = race
      ? race.id === state.plan.primaryRaceId
      : raceSession !== undefined && week.weekType === "race";
    const raceName = race?.name ?? raceSession?.title ?? null;
    const label = raceName
      ? `${raceName} · ${isPrimaryRace ? "objectif" : (race?.priority ?? "course")}`
      : weekTypeLabels[week.weekType];
    const runs = sessions.filter(isRunningSession);
    const running = runs.filter((session) => session.kind !== "race");
    let easySeconds = 0;
    let qualitySeconds = 0;
    for (const session of running)
      for (const [intensity, seconds] of Object.entries(
        structureTotals(session.structure).secondsByIntensity,
      ))
        if (easyIntensities.has(intensity)) easySeconds += seconds;
        else qualitySeconds += seconds;
    const distance =
      completeDistance(
        runs.map((session) => sessionDistance(session, paces)),
      ) ??
      (week.targets.distanceMeters !== null
        ? { meters: week.targets.distanceMeters, estimated: true }
        : null);
    const totals: ProgramTotals = {
      durationSeconds: sum(
        runs.map((session) => session.targets.durationSeconds),
      ),
      distanceMeters: distance?.meters ?? null,
      distanceEstimated: distance?.estimated ?? false,
      elevationMeters:
        presentSum(
          runs.map((session) => session.targets.elevationGainMeters),
        ) ?? week.targets.elevationGainMeters,
    };
    const doneSessions = runs.filter((session) => {
      const status = statuses.get(session.sessionKey);
      return status === "completed" || status === "partial";
    });
    const doneDistance =
      doneSessions.length === 0
        ? { meters: 0, estimated: false }
        : completeDistance(
            doneSessions.map((session) => {
              const distance = sessionDistance(session, paces);
              return (
                distance && {
                  meters: Math.round(
                    distance.meters *
                      ratio(
                        compliance.get(session.sessionKey)?.distance ?? null,
                      ),
                  ),
                  estimated: distance.estimated,
                }
              );
            }),
          );
    const done: ProgramTotals = {
      durationSeconds: Math.round(
        sum(
          doneSessions.map(
            (session) =>
              session.targets.durationSeconds *
              ratio(compliance.get(session.sessionKey)?.duration ?? null),
          ),
        ),
      ),
      distanceMeters:
        totals.distanceMeters === null ? null : (doneDistance?.meters ?? null),
      distanceEstimated: doneDistance?.estimated ?? false,
      elevationMeters:
        totals.elevationMeters === null
          ? null
          : sum(
              doneSessions.map(
                (session) => session.targets.elevationGainMeters ?? 0,
              ),
            ),
    };
    const adherence =
      status !== "past"
        ? null
        : planAdherence({
            sessions,
            matches: input.matches,
            start: week.weekStart,
            today,
            windows: [],
          }).share;
    const days: ProgramDay[] = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(week.weekStart, offset);
      const daySessions = sessions.filter(
        (session) => session.scheduledOn === date,
      );
      const main = mainSession(daySessions);
      const isPast = date < today;
      const base = {
        date,
        weekday: formatWeekdayShort(date),
        dayNumber: Number(date.slice(8)),
        isToday: date === today,
        isPast,
      };
      if (!main)
        return {
          ...base,
          sessionKey: null,
          family: "rest",
          title: familyLabels.rest,
          summary: null,
          elevation: null,
          blocks: [],
          state: isPast ? "done" : null,
          compliancePct: null,
        };
      const matchStatus = statuses.get(main.sessionKey);
      const durationRatio = compliance.get(main.sessionKey)?.duration ?? null;
      const proposed = matchesProposal(
        proposalKeys,
        "session",
        main.sessionKey,
      );
      const state: DayState =
        matchStatus === "completed"
          ? "done"
          : matchStatus === "partial"
            ? "partial"
            : matchStatus === "substituted"
              ? "substituted"
              : proposed && !isPast
                ? "proposed"
                : isPast && main.kind !== "race"
                  ? "missed"
                  : null;
      const distance = sessionDistance(main, paces);
      return {
        ...base,
        sessionKey: main.sessionKey,
        family: sessionFamilyOf(main),
        title:
          daySessions.length > 1
            ? daySessions.map((session) => session.title).join(" + ")
            : main.title,
        summary:
          [
            main.kind === "race"
              ? null
              : formatDuration(main.targets.durationSeconds),
            distance !== null
              ? approximate(formatDistance(distance.meters), distance.estimated)
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        elevation:
          main.targets.elevationGainMeters !== null &&
          main.targets.elevationGainMeters > 0
            ? `${formatElevation(main.targets.elevationGainMeters)} D+`
            : null,
        blocks: main.kind === "race" ? [] : sessionBlocks(main),
        state,
        compliancePct:
          state === "done" || state === "partial"
            ? durationRatio !== null
              ? Math.round(durationRatio * 100)
              : null
            : null,
      };
    });
    const families = days.map((day) => day.family);
    return {
      weekKey: week.weekKey,
      weekStart: week.weekStart,
      number: index + 1,
      numberInBlock:
        state.weeks
          .filter((item) => item.blockKey === week.blockKey)
          .findIndex((item) => item.weekKey === week.weekKey) + 1,
      blockName:
        state.blocks.find((block) => block.blockKey === week.blockKey)?.name ??
        "",
      daysUntil: daysBetween(today, week.weekStart),
      range: formatWeekRange(week.weekStart, end),
      label,
      labelTone: raceName
        ? isPrimaryRace
          ? "accent"
          : "muted"
        : labelTones[week.weekType],
      isDefaultLabel: !raceName && week.weekType === "build",
      sidebarLabel:
        week.weekType === "build" || week.weekType === "race"
          ? ""
          : weekTypeLabels[week.weekType].toLowerCase(),
      isLight: week.weekType === "recovery" || week.weekType === "taper",
      families,
      totals,
      done,
      easySeconds,
      qualitySeconds,
      easyPct: weekStats(state, week.weekStart).easyPct,
      status,
      completionPct: adherence !== null ? Math.round(adherence * 100) : null,
      proposed:
        matchesProposal(proposalKeys, "week", week.weekKey) ||
        sessions.some((session) =>
          matchesProposal(proposalKeys, "session", session.sessionKey),
        ),
      race:
        raceSession || race
          ? {
              letter: race?.priority ?? (isPrimaryRace ? "A" : "C"),
              primary: isPrimaryRace,
            }
          : null,
      note: week.notes,
      days,
    };
  });

  const blocks: ProgramBlock[] = state.blocks.map((block, index) => {
    const blockWeeks = weeks.filter(
      (week) => state.weeks[week.number - 1].blockKey === block.blockKey,
    );
    const first = blockWeeks[0]?.weekStart ?? block.startsOn;
    const distance = weeksDistance(blockWeeks);
    const last = blockWeeks.at(-1)
      ? addDays(blockWeeks.at(-1)!.weekStart, 6)
      : block.endsOn;
    return {
      blockKey: block.blockKey,
      index: index + 1,
      name: block.name,
      objective: block.objective,
      span: `${formatDateSpan(first, last)} · ${plural(blockWeeks.length, "semaine", "semaines")}`,
      months: formatMonthSpan(first, last),
      totals: {
        durationSeconds: sum(
          blockWeeks.map((week) => week.totals.durationSeconds),
        ),
        distanceMeters: distance?.meters ?? null,
        distanceEstimated: distance?.estimated ?? false,
        elevationMeters: presentSum(
          blockWeeks.map((week) => week.totals.elevationMeters),
        ),
      },
      weeks: blockWeeks,
      current: blockWeeks.some((week) => week.status === "current"),
    };
  });

  const programs = racePrograms(input, weeks);
  return {
    programs,
    blocks,
    weeks,
    currentWeekKey:
      weeks.find((week) => week.status === "current")?.weekKey ?? null,
  };
}

const bandTones: Record<PlanBlock["kind"], BandTone> = {
  lead_in: "dim",
  base: "dim",
  recovery: "dim",
  transition: "dim",
  build: "provider",
  specific: "terrain",
  taper: "success",
  race: "accent",
};

const qualityFamilies = new Set<SessionFamily>([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
]);

function weeksDistance(weeks: ProgramWeek[]) {
  return completeDistance(
    weeks.map((week) =>
      week.totals.distanceMeters === null && week.totals.durationSeconds === 0
        ? { meters: 0, estimated: false }
        : week.totals.distanceMeters === null
          ? null
          : {
              meters: week.totals.distanceMeters,
              estimated: week.totals.distanceEstimated,
            },
    ),
  );
}

function blockOf(state: PlanState, week: ProgramWeek) {
  const blockKey = state.weeks.find(
    (item) => item.weekKey === week.weekKey,
  )?.blockKey;
  return state.blocks.find((block) => block.blockKey === blockKey);
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function countdown(race: ProgramRace, today: string) {
  if (!race.date || race.date < today) return null;
  return `J-${daysBetween(today, race.date)}`;
}

function kilometers(meters: number) {
  return `${Math.round(meters / 1000).toLocaleString("fr-FR")} km`;
}

function renumber(weeks: ProgramWeek[]) {
  return weeks.map((week, index) => ({ ...week, number: index + 1 }));
}

function programBands(state: PlanState, weeks: ProgramWeek[]): ProgramBand[] {
  const bands: ProgramBand[] = [];
  weeks.forEach((week, index) => {
    const block = blockOf(state, week);
    const last = bands.at(-1);
    if (last && block && last.key === block.blockKey) {
      last.span += 1;
      last.current ||= week.status === "current";
      return;
    }
    bands.push({
      key: block?.blockKey ?? week.weekKey,
      name: block?.name ?? week.blockName,
      start: index,
      span: 1,
      tone: block ? bandTones[block.kind] : "dim",
      current: week.status === "current",
    });
  });
  return bands;
}

function programMilestones(
  state: PlanState,
  weeks: ProgramWeek[],
  races: ProgramRace[],
  ownRaceId: string | null,
): ProgramMilestone[] {
  const milestones: ProgramMilestone[] = [];
  const upcoming = weeks.filter((week) => week.status !== "past");
  const add = (
    week: ProgramWeek,
    key: string,
    label: string,
    when: string,
    tone: MilestoneTone,
  ) => {
    if (week.status === "past") return;
    milestones.push({
      key,
      weekKey: week.weekKey,
      number: week.number,
      label,
      when,
      tone,
    });
  };
  const recovery = upcoming.find(
    (week) =>
      state.weeks.find((item) => item.weekKey === week.weekKey)?.weekType ===
      "recovery",
  );
  if (recovery)
    add(recovery, "recovery", "Allégée", recovery.range, "provider");
  for (const week of weeks) {
    const end = addDays(week.weekStart, 6);
    for (const race of races)
      if (
        race.id !== ownRaceId &&
        race.date &&
        race.date >= week.weekStart &&
        race.date <= end
      )
        add(
          week,
          `race-${race.id}`,
          race.name,
          formatLongDay(race.date),
          "accent",
        );
  }
  const runs = state.sessions.filter(
    (session) =>
      isRunningSession(session) &&
      session.kind !== "race" &&
      weeks.some(
        (week) =>
          session.scheduledOn >= week.weekStart &&
          session.scheduledOn <= addDays(week.weekStart, 6),
      ),
  );
  const longest = Math.max(
    0,
    ...runs.map((session) => session.targets.durationSeconds),
  );
  const hours = Math.floor(longest / 3600);
  if (hours >= 2) {
    const first = [...runs]
      .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))
      .find((session) => session.targets.durationSeconds >= hours * 3600);
    const week = first
      ? weeks.find(
          (item) =>
            first.scheduledOn >= item.weekStart &&
            first.scheduledOn <= addDays(item.weekStart, 6),
        )
      : undefined;
    if (first && week)
      add(
        week,
        "long-run",
        `1re sortie de ${hours}h`,
        formatDayMonthShort(first.scheduledOn),
        "terrain",
      );
  }
  const peak = weeks.reduce<ProgramWeek | null>(
    (best, week) =>
      !best || week.totals.durationSeconds > best.totals.durationSeconds
        ? week
        : best,
    null,
  );
  if (peak && weeks.length > 2)
    add(peak, "peak", "Pic de volume", peak.range, "quality");
  const taper = weeks.find((week) => blockOf(state, week)?.kind === "taper");
  if (taper)
    add(
      taper,
      "taper",
      "Début de l’affûtage",
      formatDayMonthShort(taper.weekStart),
      "success",
    );
  return milestones.sort((first, second) => first.number - second.number);
}

function programKpis(
  state: PlanState,
  weeks: ProgramWeek[],
  primary: boolean,
): ProgramKpi[] {
  const total = sum(weeks.map((week) => week.totals.durationSeconds));
  const distance = weeksDistance(weeks);
  const sessions = state.sessions.filter((session) =>
    weeks.some(
      (week) =>
        session.scheduledOn >= week.weekStart &&
        session.scheduledOn <= addDays(week.weekStart, 6),
    ),
  );
  const longest = Math.max(
    0,
    ...sessions
      .filter((session) => isRunningSession(session) && session.kind !== "race")
      .map((session) => session.targets.durationSeconds),
  );
  const peak = Math.max(0, ...weeks.map((week) => week.totals.durationSeconds));
  const quality = sessions.filter((session) =>
    qualityFamilies.has(sessionFamilyOf(session)),
  ).length;
  const kpis: ProgramKpi[] = [
    {
      key: "duration",
      label: primary ? "Total prévu" : "Total",
      value: primary
        ? `${Math.round(total / 3600).toLocaleString("fr-FR")} h`
        : formatDuration(total),
    },
  ];
  if (distance !== null && distance.meters > 0)
    kpis.push({
      key: "distance",
      label: "Distance",
      value: approximate(kilometers(distance.meters), distance.estimated),
    });
  if (primary) {
    if (longest > 0)
      kpis.push({
        key: "longest",
        label: "Plus longue sortie",
        value: formatDuration(longest),
      });
    if (peak > 0 && weeks.length > 1)
      kpis.push({
        key: "peak",
        label: "Semaine de pic",
        value: formatDuration(peak),
      });
  } else if (quality > 0)
    kpis.push({
      key: "quality",
      label: "De qualité",
      value: plural(quality, "séance", "séances"),
    });
  return kpis;
}

function defaultWeek(weeks: ProgramWeek[]) {
  return (
    (
      weeks.find((week) => week.status === "current") ??
      weeks.find((week) => week.status === "future") ??
      weeks.at(-1) ??
      null
    )?.weekKey ?? null
  );
}

function eyebrow(weeks: ProgramWeek[]) {
  const current = weeks.find((week) => week.status === "current");
  if (current)
    return `Semaine ${current.number} sur ${weeks.length} · ${current.blockName}`;
  const first = weeks[0];
  const span = plural(weeks.length, "semaine", "semaines");
  return first && first.daysUntil > 0
    ? `${span} · débute dans ${plural(first.daysUntil, "jour", "jours")}`
    : span;
}

function racePrograms(
  input: ProgramInput,
  allWeeks: ProgramWeek[],
): RaceProgram[] {
  const { state, today } = input;
  const primary =
    input.races.find((race) => race.id === state.plan.primaryRaceId) ?? null;
  const secondary = input.races
    .filter(
      (race) =>
        race.id !== primary?.id &&
        state.blocks.some((block) => block.raceId === race.id),
    )
    .sort((first, second) =>
      (first.date ?? "").localeCompare(second.date ?? ""),
    );
  const planWeeksOf = (race: ProgramRace) =>
    allWeeks.filter((week) => blockOf(state, week)?.raceId === race.id);
  const nested: ProgramNested[] = secondary.flatMap((race) => {
    const own = planWeeksOf(race);
    if (own.length === 0) return [];
    return [
      {
        raceId: race.id,
        letter: race.priority ?? "C",
        name: race.name,
        start: own[0].number - 1,
        span: own.length,
      },
    ];
  });
  const tab = (
    race: ProgramRace,
    weeks: ProgramWeek[],
    isPrimary: boolean,
  ): ProgramTab => {
    const current = weeks.find((week) => week.status === "current");
    const first = weeks[0];
    return {
      letter: race.priority ?? (isPrimary ? "A" : "C"),
      name: race.name,
      when: race.date
        ? [formatLongDay(race.date), countdown(race, today)]
            .filter(Boolean)
            .join(" · ")
        : null,
      detail: current
        ? `S${current.number} / ${weeks.length}`
        : first && first.daysUntil > 0
          ? `débute le ${formatDayMonthShort(first.weekStart)}`
          : null,
      primary: isPrimary,
    };
  };
  const main: RaceProgram = {
    raceId: primary?.id ?? null,
    tab: primary && secondary.length > 0 ? tab(primary, allWeeks, true) : null,
    eyebrow: eyebrow(allWeeks),
    title: primary
      ? primary.targetSeconds !== null
        ? `${primary.name} · cible ${formatClock(primary.targetSeconds)}`
        : [countdown(primary, today), primary.name].filter(Boolean).join(" · ")
      : state.plan.title,
    summary: input.summary,
    kpis: programKpis(state, allWeeks, true),
    weeks: allWeeks,
    bands: programBands(state, allWeeks),
    nested,
    milestones: programMilestones(
      state,
      allWeeks,
      input.races,
      primary?.id ?? null,
    ),
    defaultWeekKey: defaultWeek(allWeeks),
  };
  const others = secondary.map((race): RaceProgram => {
    const planWeeks = planWeeksOf(race);
    const weeks = renumber(planWeeks);
    const objective =
      state.blocks.find((block) => block.raceId === race.id)?.objective ?? null;
    const planNumbers = planWeeks.map((week) => week.number);
    const inserted = primary
      ? `S’insère dans ton programme ${primary.name}, semaines ${planNumbers[0]} à ${planNumbers.at(-1)}.`
      : null;
    return {
      raceId: race.id,
      tab: tab(race, weeks, false),
      eyebrow: eyebrow(weeks),
      title:
        race.targetSeconds !== null
          ? `${race.name} · cible ${formatClock(race.targetSeconds)}`
          : [countdown(race, today), race.name].filter(Boolean).join(" · "),
      summary: [inserted, objective].filter(Boolean).join(" ") || null,
      kpis: programKpis(state, weeks, false),
      weeks,
      bands: programBands(state, weeks),
      nested: [],
      milestones: programMilestones(state, weeks, input.races, race.id),
      defaultWeekKey: defaultWeek(weeks),
    };
  });
  return [main, ...others];
}

export function chartDescription(weeks: ProgramWeek[]) {
  if (weeks.length === 0) return "Aucune semaine prévue";
  const durations = weeks.map((week) => week.easySeconds + week.qualitySeconds);
  const light = weeks.filter((week) => week.isLight).length;
  return `Volume hebdomadaire prévu sur ${plural(weeks.length, "semaine", "semaines")}, de ${formatDuration(Math.min(...durations))} à ${formatDuration(Math.max(...durations))}${light > 0 ? `, dont ${plural(light, "semaine allégée", "semaines allégées")}` : ""}`;
}

export type ProgramNavWeek = {
  weekStart: string;
  label: string;
  duration: string;
  status: WeekStatus;
  proposed: boolean;
};

export type ProgramNavBlock = {
  blockKey: string;
  name: string;
  months: string;
  status: WeekStatus;
  weeks: ProgramNavWeek[];
};

export type ProgramNav = { weekCount: number; blocks: ProgramNavBlock[] };

export function programNavigation(program: ProgramOverview): ProgramNav {
  return {
    weekCount: program.weeks.length,
    blocks: program.blocks.map((block) => ({
      blockKey: block.blockKey,
      name: block.name,
      months: block.months,
      status: block.current
        ? "current"
        : block.weeks.every((week) => week.status === "past")
          ? "past"
          : "future",
      weeks: block.weeks.map((week) => ({
        weekStart: week.weekStart,
        label: [`Semaine ${week.numberInBlock}`, week.sidebarLabel]
          .filter(Boolean)
          .join(" · "),
        duration: formatDuration(week.totals.durationSeconds),
        status: week.status,
        proposed: week.proposed,
      })),
    })),
  };
}

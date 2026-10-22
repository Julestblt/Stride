import type { Series } from "@/features/activities/track";
import type { SessionShoesView } from "@/features/gear/planned";
import {
  formatClock,
  formatDayMonthShort,
  formatDecimal,
  formatPace,
} from "@/features/progress/format";
import { cardiacDrift } from "@/features/progress/measures";
import type { AthleteFeeling } from "../debrief/debrief";
import { buildDebriefView, type DebriefView } from "../debrief/view";
import type { MatchStatus } from "../matching/adherence";
import { addDays, mondayOf } from "../model/dates";
import type { PlanSession, PlanState } from "../model/plan";
import type { IntensityPaces } from "../model/structure";
import {
  hasIntensity,
  isUntrackedSession,
  sessionDistance,
} from "../model/volume";
import { paceMidpoints, type IntensityPaceRanges } from "../targets/targets";
import { formatDistance, formatDuration, formatLongDay } from "./format";
import {
  chartSegments,
  sessionStats,
  stepViews,
  type ChartSegment,
  type StepView,
} from "./plan-view";
import { familyLabels, sessionFamilyOf, type SessionFamily } from "./program";

export type PanelMatch = {
  sessionKey: string;
  activityId: string | null;
  status: MatchStatus;
  compliance: {
    duration: number | null;
    distance: number | null;
    intensity?: number | null;
  };
};

export type PanelProposal = {
  id: string;
  title: string;
  summary: string | null;
  targetKeys: string[];
  createdAt: string;
};

export type PanelActivity = {
  id: string;
  startedAt: string;
  date: string;
  localTime: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averageHeartRate: number | null;
  detailImportedAt: string | null;
  perceivedEffort?: number | null;
  feel?: number | null;
};

export type PanelLap = {
  index: number;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averageHeartRate: number | null;
};

export type SessionPanelInput = {
  state: PlanState;
  today: string;
  sessionKey: string;
  matches: PanelMatch[];
  proposals: PanelProposal[];
  activity: PanelActivity | null;
  laps: PanelLap[];
  series: Series | null;
  paceRanges?: IntensityPaceRanges | null;
  shoes?: SessionShoesView | null;
  feeling?: AthleteFeeling | null;
};

export type PanelStatus =
  "today" | "done" | "partial" | "substituted" | "missed" | null;

export type PanelTone = "success" | "warning" | "danger" | "muted";

export type PanelStat = { key: string; value: string; label: string };

export type PanelRow = {
  key: string;
  label: string;
  planned: string;
  actual: string;
  tone: PanelTone;
};

export type PanelCompletion = {
  activityId: string;
  pct: number | null;
  headline: string;
  detail: string;
  rows: PanelRow[];
  pace: number[];
  paceLabel: string | null;
  debrief: DebriefView | null;
};

export type PanelCheckIn = { done: boolean };

function surgeIdeas(session: PlanSession) {
  const trail = session.sport === "trail" || session.terrain === "trail";
  return [
    "30” vif · trottine 1’",
    trail
      ? "1’ au seuil dans une montée · récupère en descente"
      : "1’ au seuil · trottine 1’",
    trail
      ? "3’ soutenu sur un replat · trottine 2’"
      : "3’ soutenu · trottine 2’",
  ];
}

export type SessionPanel = {
  sessionKey: string;
  day: string;
  heading: string;
  position: { index: number; count: number };
  previousKey: string | null;
  nextKey: string | null;
  family: SessionFamily;
  intensity: boolean;
  untracked: boolean;
  checkIn: PanelCheckIn | null;
  summary: string | null;
  status: PanelStatus;
  title: string;
  purpose: string;
  proposal: { id: string; when: string; text: string } | null;
  stats: PanelStat[];
  segments: ChartSegment[];
  structureLabel: string;
  steps: StepView[];
  contingencies: string[];
  surgeIdeas: string[];
  completion: PanelCompletion | null;
  shoes: SessionShoesView | null;
};

const statusLabels: Record<Exclude<PanelStatus, null>, string> = {
  today: "Aujourd’hui",
  done: "Fait",
  partial: "Fait en partie",
  substituted: "Remplacé",
  missed: "Non fait",
};

export function panelStatusLabel(status: Exclude<PanelStatus, null>) {
  return statusLabels[status];
}

function minutes(seconds: number) {
  const value = Math.round(seconds / 60);
  return value < 60 ? `${value} min` : formatDuration(seconds);
}

function weekSessions(state: PlanState, session: PlanSession) {
  const start = mondayOf(session.scheduledOn);
  const end = addDays(start, 6);
  return state.sessions
    .filter(
      (item) =>
        item.scheduledOn >= start &&
        item.scheduledOn <= end &&
        item.kind !== "rest" &&
        item.sport !== "rest",
    )
    .sort(
      (first, second) =>
        first.scheduledOn.localeCompare(second.scheduledOn) ||
        first.sessionKey.localeCompare(second.sessionKey),
    );
}

function tone(ratio: number | null): PanelTone {
  if (ratio === null || !Number.isFinite(ratio)) return "muted";
  const gap = Math.abs(ratio - 1);
  return gap <= 0.05 ? "success" : gap <= 0.15 ? "warning" : "danger";
}

const kilometers = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function proposalWhen(createdAt: string, today: string, timeZone: string) {
  const created = new Date(createdAt);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(created);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  const hour = Number(part("hour"));
  if (day === today)
    return hour < 12 ? "ce matin" : hour < 18 ? "cet après-midi" : "ce soir";
  if (day === addDays(today, -1)) return "hier";
  return `le ${formatDayMonthShort(day)}`;
}

export function paceByMinute(series: Series | null) {
  const elapsed = series?.elapsed_s;
  const distance = series?.distance_m;
  if (!elapsed || !distance) return [];
  const samples = elapsed.flatMap((time, index) => {
    const meters = distance[index];
    return time !== null && meters !== null && meters !== undefined
      ? [{ time, meters }]
      : [];
  });
  if (samples.length < 2) return [];
  const at = (time: number) => {
    let low = 0;
    let high = samples.length - 1;
    if (time <= samples[0].time) return samples[0].meters;
    if (time >= samples[high].time) return samples[high].meters;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (samples[middle].time <= time) low = middle;
      else high = middle;
    }
    const first = samples[low];
    const second = samples[high];
    const share = (time - first.time) / (second.time - first.time || 1);
    return first.meters + (second.meters - first.meters) * share;
  };
  const total = samples.at(-1)!.time - samples[0].time;
  const count = Math.floor(total / 60);
  return Array.from({ length: count }, (_, minute) => {
    const start = samples[0].time + minute * 60;
    const meters = at(start + 60) - at(start);
    return meters > 0 ? Math.round(60_000 / meters) : null;
  }).filter((value): value is number => value !== null);
}

function completion(
  input: SessionPanelInput,
  session: PlanSession,
  match: PanelMatch,
  paces: IntensityPaces | null,
): PanelCompletion | null {
  const { activity } = input;
  if (!activity || !match.activityId) return null;
  const durationRatio = match.compliance.duration;
  const pct = durationRatio !== null ? Math.round(durationRatio * 100) : null;
  const distance = sessionDistance(session, paces);
  const planned = distance?.meters ?? null;
  const rows: PanelRow[] = [];
  if (activity.durationSeconds !== null)
    rows.push({
      key: "duration",
      label: "Durée",
      planned: formatDuration(session.targets.durationSeconds),
      actual: formatClock(activity.durationSeconds),
      tone: tone(activity.durationSeconds / session.targets.durationSeconds),
    });
  if (activity.distanceMeters !== null)
    rows.push({
      key: "distance",
      label: "Distance",
      planned: distance
        ? `${distance.estimated ? "≈ " : ""}${formatDistance(distance.meters)}`
        : "–",
      actual: `${kilometers.format(activity.distanceMeters / 1000)} km`,
      tone: tone(planned !== null ? activity.distanceMeters / planned : null),
    });
  if (activity.distanceMeters && activity.durationSeconds) {
    const actualPace =
      activity.durationSeconds / (activity.distanceMeters / 1000);
    const plannedPace =
      planned !== null
        ? session.targets.durationSeconds / (planned / 1000)
        : null;
    rows.push({
      key: "pace",
      label: "Allure",
      planned: plannedPace !== null ? `${formatPace(plannedPace)} /km` : "–",
      actual: `${formatPace(actualPace)} /km`,
      tone: tone(plannedPace !== null ? actualPace / plannedPace : null),
    });
  }
  if (activity.averageHeartRate !== null)
    rows.push({
      key: "heart-rate",
      label: "FC moyenne",
      planned: "–",
      actual: `${Math.round(activity.averageHeartRate)} bpm`,
      tone: "muted",
    });
  const drift = cardiacDrift(
    input.laps.flatMap((lap) =>
      lap.durationSeconds !== null && lap.distanceMeters !== null
        ? [
            {
              activityId: activity.id,
              index: lap.index,
              duration: lap.durationSeconds,
              distance: lap.distanceMeters,
              heartRate: lap.averageHeartRate,
              gain: null,
              loss: null,
            },
          ]
        : [],
    ),
  );
  if (drift !== null)
    rows.push({
      key: "drift",
      label: "Dérive cardiaque",
      planned: "–",
      actual: `${formatDecimal(drift)} %`,
      tone: "muted",
    });
  const end =
    activity.durationSeconds !== null
      ? Date.parse(activity.startedAt) + activity.durationSeconds * 1000
      : null;
  const delay =
    end !== null && activity.detailImportedAt
      ? Math.round((Date.parse(activity.detailImportedAt) - end) / 60_000)
      : null;
  const pace = paceByMinute(input.series);
  const debrief =
    match.status === "completed" || match.status === "partial"
      ? buildDebriefView({
          session,
          activityId: activity.id,
          laps: input.laps,
          paceRanges: input.paceRanges ?? null,
          match: {
            status: match.status,
            compliance: {
              duration: match.compliance.duration,
              intensity: match.compliance.intensity ?? null,
            },
          },
          garmin: {
            rpe: activity.perceivedEffort ?? null,
            feel: activity.feel ?? null,
          },
          athlete: input.feeling ?? null,
          averageHeartRate: activity.averageHeartRate,
        })
      : null;
  return {
    activityId: activity.id,
    pct,
    headline:
      match.status === "partial"
        ? `Fait en partie${pct !== null ? ` · ${pct} % conforme` : ""}`
        : `Fait${pct !== null ? ` · ${pct} % conforme` : ""}`,
    detail: [
      formatLongDay(activity.date),
      activity.localTime,
      delay !== null && delay >= 0 && delay < 24 * 60
        ? `importé de Garmin ${minutes(delay * 60)} après l’arrêt`
        : "importé de Garmin",
    ]
      .filter(Boolean)
      .join(" · "),
    rows,
    pace,
    paceLabel:
      pace.length > 0
        ? `Allure minute par minute, de ${formatPace(Math.min(...pace))} à ${formatPace(Math.max(...pace))} /km`
        : null,
    debrief,
  };
}

export function buildSessionPanel(
  input: SessionPanelInput,
): SessionPanel | null {
  const { state, today } = input;
  const session = state.sessions.find(
    (item) => item.sessionKey === input.sessionKey,
  );
  if (!session) return null;
  const sessions = weekSessions(state, session);
  const index = sessions.findIndex(
    (item) => item.sessionKey === session.sessionKey,
  );
  const weekNumber =
    state.weeks.findIndex(
      (week) => week.weekStart === mondayOf(session.scheduledOn),
    ) + 1;
  const match =
    input.matches.find((item) => item.sessionKey === session.sessionKey) ??
    null;
  const status: PanelStatus =
    match?.status === "completed" || match?.status === "checked_in"
      ? "done"
      : match?.status === "partial"
        ? "partial"
        : match?.status === "substituted"
          ? "substituted"
          : session.scheduledOn === today
            ? "today"
            : session.scheduledOn < today &&
                session.kind !== "race" &&
                !isUntrackedSession(session)
              ? "missed"
              : null;
  const checkIn: PanelCheckIn | null =
    isUntrackedSession(session) &&
    session.scheduledOn <= today &&
    !match?.activityId
      ? { done: match?.status === "checked_in" }
      : null;
  const proposal =
    status === "done" || status === "partial"
      ? null
      : (input.proposals.find((item) =>
          item.targetKeys.some(
            (key) =>
              key === session.sessionKey ||
              key === `session:${session.sessionKey}`,
          ),
        ) ?? null);
  const paceRanges = input.paceRanges ?? null;
  const paces = paceRanges ? paceMidpoints(paceRanges) : null;
  const intensity = hasIntensity(session);
  const family = sessionFamilyOf(session);
  const duration: PanelStat = {
    key: "duration",
    value: minutes(session.targets.durationSeconds),
    label: "Durée",
  };
  const stats = sessionStats(session, null, paces);
  const statList: PanelStat[] = [
    duration,
    ...(stats.distance
      ? [{ key: "distance", value: stats.distance, label: "Distance" }]
      : []),
    ...(stats.intensityTime
      ? [
          {
            key: "intensity",
            value: minutes(stats.intensityTime.seconds),
            label:
              session.kind === "fartlek"
                ? "Bloc libre"
                : stats.intensityTime.label.charAt(0).toUpperCase() +
                  stats.intensityTime.label.slice(1),
          },
        ]
      : []),
    ...(stats.effort
      ? [{ key: "effort", value: stats.effort, label: "Effort bloc" }]
      : []),
    ...(stats.pace
      ? [{ key: "pace", value: stats.pace, label: "Allure /km" }]
      : []),
    ...(stats.heartRate
      ? [{ key: "heart-rate", value: stats.heartRate, label: "FC bpm" }]
      : []),
    ...(stats.elevation
      ? [{ key: "elevation", value: stats.elevation, label: "D+" }]
      : []),
    ...(stats.terrain
      ? [{ key: "terrain", value: stats.terrain, label: "Terrain" }]
      : []),
  ];
  const segments = intensity ? chartSegments(session) : [];
  const steps = stepViews(session, paceRanges);
  const day = formatLongDay(session.scheduledOn);
  return {
    sessionKey: session.sessionKey,
    day,
    heading: weekNumber > 0 ? `${day} · S${weekNumber}` : day,
    position: { index: index + 1, count: sessions.length },
    previousKey: sessions[index - 1]?.sessionKey ?? null,
    nextKey: sessions[index + 1]?.sessionKey ?? null,
    family,
    intensity,
    untracked: isUntrackedSession(session),
    checkIn,
    summary: intensity ? null : `${familyLabels[family]} · ${duration.value}`,
    status,
    title: session.title,
    purpose: session.purpose,
    proposal: proposal
      ? {
          id: proposal.id,
          when: proposalWhen(proposal.createdAt, today, state.plan.timeZone),
          text: proposal.summary ?? proposal.title,
        }
      : null,
    stats: intensity ? statList.slice(0, 6) : [duration],
    segments,
    structureLabel: `Déroulé de la séance sur ${formatDuration(
      segments.reduce((total, segment) => total + segment.seconds, 0),
    )}`,
    steps: intensity
      ? steps
      : steps
          .filter((step) => step.cue !== null)
          .map((step) => ({ ...step, target: "", pace: null })),
    contingencies: session.contingencies,
    surgeIdeas: session.kind === "fartlek" ? surgeIdeas(session) : [],
    completion: match ? completion(input, session, match, paces) : null,
    shoes: input.shoes ?? null,
  };
}

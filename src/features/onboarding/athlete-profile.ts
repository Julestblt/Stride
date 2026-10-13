import {
  buildInsightFacts,
  isRunning,
  runningTrailShare,
  shareLabel,
  type InsightActivity,
  type InsightObservation,
} from "@/features/insights/facts";
import type { InsightsResponse } from "@/features/insights/schemas";
import {
  calculateHeartRateZones,
  type HeartRateZones,
} from "./heart-rate-zones";
import type { GoalValues, RaceValues } from "./goals";
import type { ProfileValues } from "./profile";

export type ProfileSource = "garmin" | "athlete";
export type ProfileFact = {
  key: string;
  label: string;
  value: string | null;
  source: ProfileSource;
  detail: string;
};
export type ProfileSection = {
  key: "training" | "fitness" | "recovery" | "goals";
  title: string;
  facts: ProfileFact[];
};
export type WeekBar = {
  weekStart: string;
  hours: number;
  activities: number;
};
export type TrainingWeek = {
  weekStart: string;
  activityCount: number;
  durationSeconds: number;
};
export type AthleteProfileInputs = {
  today: Date;
  profile: ProfileValues;
  goal: GoalValues;
  races: RaceValues[];
  activityCount: number;
  firstActivityAt: string | null;
  activities: InsightActivity[];
  observations: InsightObservation[];
  vo2Max: { value: number; observedOn: string } | null;
  maxHeartRate: { value: number; startedAt: string; manual?: boolean } | null;
};
export type AthleteProfileView = {
  firstName: string | null;
  activityCount: number;
  history: string | null;
  sleepNights: number;
  heartRateZones: HeartRateZones | null;
  habits: InsightsResponse;
  weeks: WeekBar[];
  sections: ProfileSection[];
};

export const profileWeeks = 16;
const dayMs = 86_400_000;
const integer = new Intl.NumberFormat("fr-FR");
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const focusLabels: Record<NonNullable<GoalValues["focus"]>, string> = {
  general_fitness: "Forme générale",
  faster: "Aller plus vite",
  short_distance: "5 km · 10 km",
  half_marathon_marathon: "Semi · Marathon",
  trail: "Course trail",
  ultra_trail: "Ultra-trail",
};
const longRunLabels = {
  saturday: "sortie longue sam.",
  sunday: "sortie longue dim.",
  flexible: "sortie longue flexible",
};

function mondayOf(date: Date) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

export function formatHours(hours: number) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function historySpan(first: string | null, today: Date) {
  if (!first) return null;
  const months = Math.max(
    1,
    Math.floor((today.getTime() - Date.parse(first)) / (30.44 * dayMs)),
  );
  if (months < 24) return `${months} mois`;
  return `${Math.floor(months / 12)} ans`;
}

export function recentWeeks(
  activities: InsightActivity[],
  today: Date,
): WeekBar[] {
  const aggregates = new Map<string, TrainingWeek>();
  for (const activity of activities) {
    const timestamp = Date.parse(activity.startedAt);
    if (
      !isRunning(activity.type) ||
      !Number.isFinite(timestamp) ||
      timestamp > today.getTime()
    )
      continue;
    const weekStart = mondayOf(new Date(timestamp)).toISOString().slice(0, 10);
    const week = aggregates.get(weekStart) ?? {
      weekStart,
      activityCount: 0,
      durationSeconds: 0,
    };
    week.activityCount++;
    const duration = activity.durationSeconds;
    if (duration !== null && Number.isFinite(duration) && duration > 0)
      week.durationSeconds += duration;
    aggregates.set(weekStart, week);
  }
  const current = mondayOf(today);
  const byStart = aggregates;
  return Array.from({ length: profileWeeks }, (_, index) => {
    const start = new Date(
      current.getTime() - (profileWeeks - 1 - index) * 7 * dayMs,
    )
      .toISOString()
      .slice(0, 10);
    const week = byStart.get(start);
    return {
      weekStart: start,
      hours: (week?.durationSeconds ?? 0) / 3600,
      activities: week?.activityCount ?? 0,
    };
  });
}

function series(observations: InsightObservation[], metric: string) {
  return observations
    .filter((observation) => observation.metric === metric)
    .map((observation) => observation.value)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function rangeLabel(values: number[], unit: string) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (ratio: number) =>
    Math.round(
      sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))],
    );
  const low = at(0.1);
  const high = at(0.9);
  return low === high ? `${low} ${unit}` : `${low}–${high} ${unit}`;
}

function relativeDay(observedOn: string, today: Date) {
  const days = Math.round(
    (Date.parse(today.toISOString().slice(0, 10)) - Date.parse(observedOn)) /
      dayMs,
  );
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function buildAthleteProfile(
  input: AthleteProfileInputs,
): AthleteProfileView {
  const weeks = recentWeeks(input.activities, input.today);
  const trained = weeks.filter((week) => week.activities > 0);
  const averageHours =
    weeks.reduce((total, week) => total + week.hours, 0) / weeks.length;
  const averageSessions =
    weeks.reduce((total, week) => total + week.activities, 0) / weeks.length;
  const share = runningTrailShare(input.activities);
  const days = input.profile.available_weekdays?.length ?? 0;
  const sleep = series(input.observations, "sleep_duration_seconds");
  const recentCut = input.today.getTime() - 28 * dayMs;
  const recent = input.observations.filter(
    (observation) =>
      Date.parse(observation.observedOn) >= recentCut &&
      Date.parse(observation.observedOn) <= input.today.getTime(),
  );
  const recentHrv = series(recent, "hrv_last_night_ms");
  const recentResting = series(recent, "resting_heart_rate_bpm");
  const runs = input.activities.filter(
    (activity) => activity.distanceMeters !== null && isRunning(activity.type),
  );
  const longest = runs.reduce<InsightActivity | null>(
    (best, run) =>
      !best || (run.distanceMeters ?? 0) > (best.distanceMeters ?? 0)
        ? run
        : best,
    null,
  );
  const training: ProfileFact[] = [
    {
      key: "typical_week",
      label: "Semaine type · course à pied",
      value:
        trained.length > 0
          ? `${formatHours(averageHours)} · ${decimal.format(Math.round(averageSessions * 10) / 10)} séances`
          : null,
      source: "garmin",
      detail: "Course à pied · moyenne sur 16 dernières semaines",
    },
    {
      key: "regularity",
      label: "Régularité",
      value:
        trained.length > 0
          ? `${trained.length} semaines sur ${profileWeeks}`
          : null,
      source: "garmin",
      detail: "Semaines avec au moins une course",
    },
    {
      key: "terrain",
      label: "Terrain",
      value:
        share === null
          ? null
          : share >= 0.2
            ? `Trail · ${shareLabel(share)}`
            : "Surtout route",
      source: "garmin",
      detail: "Course à pied · 12 derniers mois",
    },
    {
      key: "availability",
      label: "Disponibilité",
      value:
        days > 0
          ? `${days} jour${days > 1 ? "s" : ""}${input.profile.long_run_day ? ` · ${longRunLabels[input.profile.long_run_day]}` : ""}`
          : null,
      source: "athlete",
      detail: "Tes réponses",
    },
  ];
  const fitness: ProfileFact[] = [
    {
      key: "vo2_max",
      label: "VO₂ max",
      value: input.vo2Max ? String(Math.round(input.vo2Max.value)) : null,
      source: "garmin",
      detail: input.vo2Max
        ? `Garmin · ${relativeDay(input.vo2Max.observedOn, input.today)}`
        : "Garmin",
    },
    {
      key: "longest_run",
      label: "Repère récent",
      value:
        longest?.distanceMeters != null
          ? `${decimal.format(Math.round(longest.distanceMeters / 100) / 10)} km · ${shortDate.format(new Date(longest.startedAt))}`
          : null,
      source: "garmin",
      detail: "Plus longue sortie · 12 derniers mois",
    },
    {
      key: "max_hr",
      label: input.maxHeartRate?.manual ? "FC max" : "FC max observée",
      value: input.maxHeartRate
        ? `${Math.round(input.maxHeartRate.value)} bpm`
        : null,
      source: input.maxHeartRate?.manual ? "athlete" : "garmin",
      detail: input.maxHeartRate
        ? input.maxHeartRate.manual
          ? "Ta valeur"
          : `Le ${fullDate.format(new Date(input.maxHeartRate.startedAt))} · 12 derniers mois`
        : "12 derniers mois",
    },
  ];
  const recovery: ProfileFact[] = [
    {
      key: "resting_hr",
      label: "FC au repos",
      value:
        recentResting.length >= 7 ? rangeLabel(recentResting, "bpm") : null,
      source: "garmin",
      detail: "Base sur 28 jours",
    },
    {
      key: "hrv",
      label: "VFC",
      value: recentHrv.length >= 7 ? rangeLabel(recentHrv, "ms") : null,
      source: "garmin",
      detail: "Nuit · base sur 28 jours",
    },
    {
      key: "sleep",
      label: "Sommeil",
      value:
        sleep.length >= 7
          ? `${formatHours(sleep.reduce((total, value) => total + value, 0) / sleep.length / 3600)} en moyenne`
          : null,
      source: "garmin",
      detail: `${sleep.length} nuits · 90 derniers jours`,
    },
  ];
  const goals: ProfileFact[] = [
    {
      key: "focus",
      label: "Objectif",
      value: input.goal.focus ? focusLabels[input.goal.focus] : null,
      source: "athlete",
      detail: "Tes réponses",
    },
    ...input.races
      .filter((race) => race.name && race.race_date)
      .sort((a, b) => (a.race_date ?? "").localeCompare(b.race_date ?? ""))
      .map((race, index): ProfileFact => {
        const date = new Date(`${race.race_date}T00:00:00Z`);
        const daysLeft = Math.ceil(
          (date.getTime() -
            Date.parse(input.today.toISOString().slice(0, 10))) /
            dayMs,
        );
        return {
          key: `race-${index}`,
          label: `${race.name} · Course ${race.priority}`,
          value:
            daysLeft > 1
              ? `${integer.format(daysLeft)} jours`
              : daysLeft === 1
                ? "Demain"
                : daysLeft === 0
                  ? "Aujourd’hui"
                  : "Passée",
          source: "athlete",
          detail: [
            fullDate.format(date),
            race.distance_km !== null
              ? `${decimal.format(race.distance_km)} km`
              : null,
            race.elevation_gain_m
              ? `${integer.format(race.elevation_gain_m)} m D+`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      }),
  ];
  return {
    firstName: input.profile.first_name,
    activityCount: input.activityCount,
    history: historySpan(input.firstActivityAt, input.today),
    sleepNights: sleep.length,
    heartRateZones: calculateHeartRateZones({
      maximum: input.maxHeartRate?.value ?? null,
      observations: input.observations,
      today: input.today,
    }),
    weeks,
    habits: {
      final: true,
      items: buildInsightFacts({
        activities: input.activities.filter(
          (activity) => Date.parse(activity.startedAt) <= input.today.getTime(),
        ),
        observations: [],
        longest: null,
        today: input.today,
      })
        .filter((item) => item.key === "volume" || item.key === "mix")
        .map((item) => ({
          key: item.key,
          text: item.sentence,
          source: item.source,
          origin: "facts",
        })),
    },
    sections: [
      { key: "training", title: "Comment tu t’entraînes", facts: training },
      { key: "fitness", title: "Où en est ta forme", facts: fitness },
      { key: "recovery", title: "Comment tu récupères", facts: recovery },
      { key: "goals", title: "Ce que tu vises", facts: goals },
    ],
  };
}

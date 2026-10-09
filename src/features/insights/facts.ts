export type InsightActivity = {
  startedAt: string;
  localStartedAt: string | null;
  type: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
};
export type InsightObservation = {
  metric: string;
  observedOn: string;
  value: number;
};
export type InsightFactKey = "volume" | "mix" | "longest" | "recovery";
export type InsightFact = {
  key: InsightFactKey;
  source: string;
  sentence: string;
  values: Record<string, string>;
};

const roadRunning = new Set(["running", "treadmill_running", "track_running"]);
const trailRunning = new Set(["trail_running", "ultra_run"]);
const strength = new Set(["strength_training", "indoor_cardio"]);
const weekdays = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayMs = 86_400_000;

export const minimumActivities = 8;
export const minimumWeeks = 4;
export const minimumRecoveryNights = 7;

function isRunning(type: string) {
  return roadRunning.has(type) || trailRunning.has(type);
}

export function shareLabel(share: number) {
  if (share >= 0.9) return "presque toute";
  if (share >= 0.7) return "les trois quarts";
  if (share >= 0.6) return "deux tiers";
  if (share >= 0.45) return "la moitié";
  if (share >= 0.3) return "un tiers";
  if (share >= 0.2) return "un quart";
  return "une petite part";
}

export function joinDays(days: number[]) {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const weekend = sorted.includes(6) && sorted.includes(0);
  const names = sorted
    .filter((day) => !weekend || (day !== 6 && day !== 0))
    .map((day) => `le ${weekdays[day]}`);
  if (weekend) names.push("le week-end");
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

function weekday(activity: InsightActivity) {
  const local = activity.localStartedAt ?? activity.startedAt;
  return new Date(`${local.slice(0, 10)}T00:00:00Z`).getUTCDay();
}

function volumeFact(
  activities: InsightActivity[],
  today: Date,
  windowStart: Date,
): InsightFact | null {
  if (activities.length < minimumActivities) return null;
  const first = Math.max(
    windowStart.getTime(),
    Math.min(...activities.map((activity) => Date.parse(activity.startedAt))),
  );
  const weeks = (today.getTime() - first) / (7 * dayMs);
  if (weeks < minimumWeeks) return null;
  const seconds = activities.reduce(
    (total, activity) => total + (activity.durationSeconds ?? 0),
    0,
  );
  const hours = Math.round((seconds / 3600 / weeks) * 2) / 2;
  if (hours <= 0) return null;
  const counts = Array.from({ length: 7 }, () => 0);
  for (const activity of activities) counts[weekday(activity)]++;
  const days = counts
    .map((count, day) => ({ count, day }))
    .filter(({ count }) => count / activities.length >= 0.14)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map(({ day }) => day);
  const hoursLabel = decimal.format(hours);
  const daysLabel = days.length > 0 && days.length < 6 ? joinDays(days) : "";
  return {
    key: "volume",
    source:
      first - windowStart.getTime() > 30 * dayMs
        ? `Activités · depuis ${monthYear.format(new Date(first))}`
        : "Activités · 12 derniers mois",
    sentence: `Tu t’entraînes environ ${hoursLabel} heure${hours >= 2 ? "s" : ""} par semaine${daysLabel ? `, surtout ${daysLabel}` : ""}.`,
    values: { heures: hoursLabel, ...(daysLabel && { jours: daysLabel }) },
  };
}

function mixFact(
  activities: InsightActivity[],
  weeks: number,
): InsightFact | null {
  const runs = activities.filter((activity) => isRunning(activity.type));
  const distance = (items: InsightActivity[]) =>
    items.reduce((total, item) => total + (item.distanceMeters ?? 0), 0);
  const total = distance(runs);
  if (runs.length < minimumActivities || total <= 0) return null;
  const trail = distance(runs.filter((run) => trailRunning.has(run.type)));
  const trailShare = trail / total;
  const strengthPerWeek =
    activities.filter((activity) => strength.has(activity.type)).length /
    Math.max(weeks, 1);
  const surface =
    trailShare >= 0.2
      ? `Le trail fait ${shareLabel(trailShare)} de ta course à pied`
      : "La route fait l’essentiel de ta course à pied";
  const sessions = Math.round(strengthPerWeek);
  const strengthLabel =
    strengthPerWeek >= 0.75
      ? `, avec environ ${integer.format(sessions)} séance${sessions > 1 ? "s" : ""} de renfo par semaine`
      : "";
  return {
    key: "mix",
    source: "Activités · 12 derniers mois",
    sentence: `${surface}${strengthLabel}.`,
    values: {
      ...(trailShare >= 0.2 && { trail: shareLabel(trailShare) }),
      ...(strengthLabel && { renfo: integer.format(sessions) }),
    },
  };
}

function longestFact(longest: InsightActivity | null): InsightFact | null {
  if (!longest?.distanceMeters || longest.distanceMeters < 5000) return null;
  const km = decimal.format(Math.round(longest.distanceMeters / 100) / 10);
  const when = monthYear.format(new Date(longest.startedAt));
  const gain = longest.elevationGainMeters
    ? integer.format(Math.round(longest.elevationGainMeters))
    : null;
  return {
    key: "longest",
    source: "Courses",
    sentence: `Sortie la plus longue : ${km} km en ${when}${gain && Number(longest.elevationGainMeters) >= 200 ? `, ${gain} m D+` : ""}.`,
    values: {
      km,
      date: when,
      ...(gain &&
        Number(longest.elevationGainMeters) >= 200 && { denivele: gain }),
    },
  };
}

function range(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))] ?? 0;
  return [Math.round(at(0.1)), Math.round(at(0.9))] as const;
}

function recoveryFact(observations: InsightObservation[]): InsightFact | null {
  const series = (metric: string) =>
    observations
      .filter((observation) => observation.metric === metric)
      .map((observation) => observation.value)
      .filter((value) => Number.isFinite(value) && value > 0);
  const hrv = series("hrv_last_night_ms");
  const resting = series("resting_heart_rate_bpm");
  const sleep = series("sleep_duration_seconds");
  const parts: string[] = [];
  const values: Record<string, string> = {};
  if (resting.length >= minimumRecoveryNights) {
    const [low, high] = range(resting);
    values.fc = low === high ? `${low}` : `${low}–${high}`;
    parts.push(`FC au repos entre ${low} et ${high} bpm`);
  }
  if (hrv.length >= minimumRecoveryNights) {
    const [low, high] = range(hrv);
    values.vfc = `${low}–${high}`;
    parts.push(`VFC nocturne entre ${low} et ${high} ms`);
  }
  if (sleep.length >= minimumRecoveryNights) {
    const minutes = Math.round(
      sleep.reduce((total, value) => total + value, 0) / sleep.length / 60,
    );
    const label = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
    values.sommeil = label;
    parts.push(`${label} de sommeil en moyenne`);
  }
  if (parts.length === 0) return null;
  const [first, ...rest] = parts;
  const sentence = `${first.charAt(0).toUpperCase()}${first.slice(1)}${rest.length ? `, ${rest.join(", ")}` : ""}.`;
  return {
    key: "recovery",
    source: "Récupération · 28 derniers jours",
    sentence,
    values,
  };
}

export function buildInsightFacts({
  activities,
  longest,
  observations,
  today,
}: {
  activities: InsightActivity[];
  longest: InsightActivity | null;
  observations: InsightObservation[];
  today: Date;
}): InsightFact[] {
  const windowStart = new Date(today.getTime() - 365 * dayMs);
  const recent = activities.filter(
    (activity) => Date.parse(activity.startedAt) >= windowStart.getTime(),
  );
  const first = recent.length
    ? Math.max(
        windowStart.getTime(),
        Math.min(...recent.map((activity) => Date.parse(activity.startedAt))),
      )
    : today.getTime();
  const weeks = (today.getTime() - first) / (7 * dayMs);
  return [
    volumeFact(recent, today, windowStart),
    weeks >= minimumWeeks ? mixFact(recent, weeks) : null,
    longestFact(longest),
    recoveryFact(observations),
  ].filter((fact): fact is InsightFact => fact !== null);
}

import {
  runningTrailShare,
  shareLabel,
  usualWeekdays,
  type InsightActivity,
  type InsightObservation,
} from "@/features/insights/facts";

export type KnownValue = {
  key: "max_hr" | "resting_hr" | "vo2_max" | "running_since" | "usual_days";
  label: string;
  value: string;
  detail: string;
};
export type ProfileSuggestions = {
  observedOn: string;
  available_weekdays?: number[];
  primary_terrain?: { value: "road" | "trail" | "mixed"; note: string };
};
export type KnownInputs = {
  today: Date;
  activities: InsightActivity[];
  observations: InsightObservation[];
  firstRunAt: string | null;
  vo2Max: { value: number; observedOn: string } | null;
  maxHeartRate: {
    value: number;
    startedAt: string;
    distanceMeters: number | null;
  } | null;
};

const shortDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const shortMonth = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function isoWeekdays(days: number[]) {
  return days.map((day) => (day === 0 ? 7 : day)).sort((a, b) => a - b);
}

function relativeDay(observedOn: string, today: Date) {
  const days = Math.round(
    (Date.parse(today.toISOString().slice(0, 10)) - Date.parse(observedOn)) /
      86_400_000,
  );
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function buildKnownValues(input: KnownInputs): KnownValue[] {
  const known: KnownValue[] = [];
  if (input.maxHeartRate) {
    const where = input.maxHeartRate.distanceMeters
      ? `${decimal.format(Math.round(input.maxHeartRate.distanceMeters / 1000))} km, `
      : "";
    known.push({
      key: "max_hr",
      label: "FC max",
      value: String(Math.round(input.maxHeartRate.value)),
      detail: `Observée · ${where}${shortMonth.format(new Date(input.maxHeartRate.startedAt))}`,
    });
  }
  const resting = input.observations
    .filter((observation) => observation.metric === "resting_heart_rate_bpm")
    .map((observation) => observation.value);
  if (resting.length >= 7)
    known.push({
      key: "resting_hr",
      label: "FC au repos",
      value: String(Math.round(median(resting))),
      detail: "Garmin · 28 jours",
    });
  if (input.vo2Max)
    known.push({
      key: "vo2_max",
      label: "VO₂ max",
      value: String(Math.round(input.vo2Max.value)),
      detail: `Garmin · ${relativeDay(input.vo2Max.observedOn, input.today)}`,
    });
  if (input.firstRunAt)
    known.push({
      key: "running_since",
      label: "Course à pied depuis",
      value: input.firstRunAt.slice(0, 4),
      detail: "Première activité",
    });
  const days = usualWeekdays(input.activities);
  if (days.length >= 2)
    known.push({
      key: "usual_days",
      label: "Jours d’entraînement habituels",
      value: isoWeekdays(days)
        .map((day) => shortDays[day % 7])
        .join(" "),
      detail: "Habitude · 12 mois",
    });
  return known;
}

export function buildSuggestions(input: KnownInputs): ProfileSuggestions {
  const suggestions: ProfileSuggestions = {
    observedOn: input.today.toISOString().slice(0, 10),
  };
  const days = usualWeekdays(input.activities);
  if (days.length >= 2) suggestions.available_weekdays = isoWeekdays(days);
  const share = runningTrailShare(input.activities);
  if (share !== null)
    suggestions.primary_terrain =
      share >= 0.6
        ? {
            value: "trail",
            note: `Le trail fait ${shareLabel(share)} de ta course à pied sur 12 mois.`,
          }
        : share <= 0.2
          ? {
              value: "road",
              note: "La route fait l’essentiel de ta course à pied sur 12 mois.",
            }
          : {
              value: "mixed",
              note: `Le trail fait ${shareLabel(share)} de ta course à pied sur 12 mois.`,
            };
  return suggestions;
}

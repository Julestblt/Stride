import type { Trend } from "@/components/stride/marks";
import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import type { Adherence } from "@/features/plans/matching/adherence";
import type { ProgressHistory } from "./history";
import { buildLoadChart, type LoadChart } from "./load";
import { fitnessMeasures, type Measure } from "./measures";
import {
  periodLabels,
  periodPhrases,
  periodStart,
  type ProgressPeriod,
} from "./period";
import { coachNote, fitnessReading } from "./reading";
import {
  formatDecimal,
  formatInteger,
  formatMonth,
  formatPace,
} from "./format";

export type MeasureRow = {
  key: string;
  label: string;
  detail: string;
  value: string;
  trend?: Trend;
  verdict: string;
  tone: "success" | "muted" | "warning" | "danger";
  href: string;
};

export type FitnessView = {
  headline: string;
  summary: string;
  load: LoadChart | null;
  rows: MeasureRow[];
  note: string | null;
};

const unavailable = "—";
const toneByTrend: Record<Trend, MeasureRow["tone"]> = {
  improving: "success",
  stable: "muted",
  watch: "warning",
  investigate: "danger",
};

function since(measure: Measure) {
  return measure.since ? ` depuis ${formatMonth(measure.since)}` : "";
}

function signed(value: number, unit: string) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : "±"}${Math.abs(rounded)} ${unit}`;
}

function paceVerdict(measure: Measure) {
  if (measure.baseline === null || measure.value === null)
    return "Tendance à confirmer";
  const delta = signed(measure.value - measure.baseline, "s/km");
  if (measure.trend === "improving")
    return `En progrès · ${delta}${since(measure)}`;
  if (measure.trend === "watch") return `En recul · ${delta}${since(measure)}`;
  return `Stable${since(measure)}`;
}

function row(
  measure: Measure,
  base: Omit<MeasureRow, "value" | "trend" | "verdict" | "tone" | "href">,
  value: string,
  verdict: string,
  missing: string,
): MeasureRow {
  if (measure.value === null)
    return {
      ...base,
      value: unavailable,
      verdict: missing,
      tone: "muted",
      href: activitiesHref,
    };
  return {
    ...base,
    value,
    trend: measure.trend,
    verdict,
    tone: toneByTrend[measure.trend],
    href: activitiesHref,
  };
}

const activitiesHref = "/activities";
const planHref = "/plan";

function adherenceTrend(share: number): Trend {
  if (share >= 0.8) return "improving";
  if (share >= 0.6) return "watch";
  return "investigate";
}

function percent(share: number) {
  return `${formatInteger(Math.round(share * 100))} %`;
}

function consistencyRow(
  adherence: Adherence | null,
  period: ProgressPeriod,
): MeasureRow {
  const base = {
    key: "consistency",
    label: "Régularité",
    detail: `Séances réalisées, ${periodLabels[period]}`,
    href: planHref,
  };
  if (!adherence)
    return {
      ...base,
      value: unavailable,
      verdict: "Disponible avec un plan d’entraînement",
      tone: "muted",
    };
  if (adherence.share === null)
    return {
      ...base,
      value: unavailable,
      verdict: "Aucune séance passée sur la période",
      tone: "muted",
    };
  const trend = adherenceTrend(adherence.share);
  const counts = `${formatInteger(adherence.done)} sur ${formatInteger(adherence.due)} séances`;
  return {
    ...base,
    value: percent(adherence.share),
    trend,
    verdict:
      adherence.keyShare === null
        ? counts
        : `${counts} · séances clés ${percent(adherence.keyShare)}`,
    tone: toneByTrend[trend],
  };
}

export function fitnessView({
  history,
  zones,
  period,
  today,
  adherence = null,
}: {
  history: ProgressHistory;
  zones: HeartRateZones | null;
  period: ProgressPeriod;
  today: string;
  adherence?: Adherence | null;
}): FitnessView {
  const start = periodStart(today, period);
  const load = buildLoadChart(history.load, history.races, start, today);
  const measures = fitnessMeasures({
    activities: history.activities,
    laps: history.laps,
    vo2: history.vo2,
    zones,
    start,
    today,
  });
  const reading = fitnessReading({
    activities: history.activities,
    measures,
    load,
    start,
    today,
    periodPhrase: periodPhrases[period],
  });
  const { efficiency, climbing, drift } = measures;
  const rows: MeasureRow[] = [
    row(
      efficiency,
      {
        key: "efficiency",
        label: "Efficacité aérobie",
        detail: measures.referenceHeartRate
          ? `Allure à ${measures.referenceHeartRate} bpm, sorties à plat`
          : "Allure à fréquence cardiaque d’endurance, sorties à plat",
      },
      efficiency.value === null ? unavailable : formatPace(efficiency.value),
      paceVerdict(efficiency),
      measures.referenceHeartRate
        ? `Pas assez de tours à plat près de ${measures.referenceHeartRate} bpm`
        : "Zones cardiaques indisponibles",
    ),
    row(
      climbing,
      {
        key: "climbing",
        label: "Vitesse en montée",
        detail: "VAM sur pentes de 8–15 %",
      },
      climbing.value === null
        ? unavailable
        : `${formatInteger(climbing.value)} m/h`,
      climbing.baseline === null
        ? "Tendance à confirmer"
        : climbing.trend === "stable"
          ? `Stable${since(climbing)}`
          : `${climbing.trend === "improving" ? "En progrès" : "En recul"} · ${signed(climbing.value! - climbing.baseline, "m/h")}${since(climbing)}`,
      "Pas assez de montées enregistrées sur la période",
    ),
    row(
      drift,
      {
        key: "drift",
        label: "Dérive cardiaque en sortie longue",
        detail: "2e moitié vs 1re, sorties de 1 h 30 et plus",
      },
      drift.value === null ? unavailable : `${formatDecimal(drift.value)} %`,
      drift.trend === "investigate"
        ? "À creuser · chaleur ou nutrition ?"
        : drift.trend === "watch"
          ? "À surveiller · au-dessus de 5 %"
          : drift.trend === "improving"
            ? "En baisse · mieux maîtrisée"
            : "Maîtrisée · sous 5 %",
      "Aucune sortie longue sur la période",
    ),
    consistencyRow(adherence, period),
  ];
  return {
    ...reading,
    load,
    rows,
    note: coachNote(measures),
  };
}

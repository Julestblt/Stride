import type { Trend } from "@/components/stride/marks";
import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import type { ProgressHistory } from "./history";
import { buildLoadChart, type LoadChart } from "./load";
import { fitnessMeasures, sparklineWindows, type Measure } from "./measures";
import { periodPhrases, periodStart, type ProgressPeriod } from "./period";
import { racePredictions, type RacePredictions } from "./predictions";
import { fitnessRecords } from "./records";
import { coachNote, fitnessReading, loadNote } from "./reading";
import { weeklyVolume, type WeekVolume } from "./volume";
import {
  formatClock,
  formatDecimal,
  formatHoursMinutes,
  formatInteger,
  formatKilometers,
  formatMonth,
  formatMonthYear,
  formatPace,
  formatDayMonthShort,
} from "./format";

export type MeasureRow = {
  key: string;
  label: string;
  detail: string;
  value: string;
  trend?: Trend;
  verdict: string;
  sparkline: (number | null)[] | null;
  samples?: { title: string; value: string }[];
  tone: "success" | "muted" | "warning" | "danger";
};

export type RecordRow = {
  key: string;
  label: string;
  value: string;
  date: string;
  href: string | null;
};

export type FitnessView = {
  headline: string;
  summary: string;
  load: (LoadChart & { note: string }) | null;
  rows: MeasureRow[];
  note: string | null;
  predictions: RacePredictions | null;
  predictionTimes: { key: string; label: string; value: string }[];
  weeks: WeekVolume[];
  records: RecordRow[];
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
  base: Omit<MeasureRow, "value" | "trend" | "verdict" | "sparkline" | "tone">,
  value: string,
  verdict: string,
  missing: string,
): MeasureRow {
  if (measure.value === null)
    return {
      ...base,
      value: unavailable,
      verdict: missing,
      sparkline: null,
      tone: "muted",
    };
  return {
    ...base,
    value,
    trend: measure.trend,
    verdict,
    sparkline: measure.sparkline,
    tone: toneByTrend[measure.trend],
  };
}

function predictionTime(key: string, seconds: number) {
  return key === "marathon"
    ? formatHoursMinutes(seconds)
    : formatClock(seconds);
}

export function fitnessView({
  history,
  zones,
  period,
  today,
}: {
  history: ProgressHistory;
  zones: HeartRateZones | null;
  period: ProgressPeriod;
  today: string;
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
  const { efficiency, climbing, threshold, vo2, drift } = measures;
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
      threshold,
      {
        key: "threshold",
        label: "Allure au seuil",
        detail: measures.thresholdZone
          ? `Tours à plat entre ${measures.thresholdZone.lower} et ${measures.thresholdZone.upper} bpm`
          : "Selon sorties + FC",
      },
      threshold.value === null ? unavailable : formatPace(threshold.value),
      paceVerdict(threshold),
      measures.thresholdZone
        ? "Pas assez de tours à plat en zone 4"
        : "Zones cardiaques indisponibles",
    ),
    row(
      vo2,
      { key: "vo2", label: "Estimation VO₂ max", detail: "Garmin" },
      vo2.value === null ? unavailable : formatInteger(vo2.value),
      vo2.baseline === null
        ? "Une seule mesure sur la période"
        : vo2.trend === "stable"
          ? `Stable${since(vo2)}`
          : `${vo2.trend === "improving" ? "En hausse" : "En baisse"} · ${signed(vo2.value! - vo2.baseline, "").trim()}${since(vo2)}`,
      "Aucune estimation Garmin sur la période",
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
    {
      key: "consistency",
      label: "Régularité",
      detail: "Séances réalisées, 12 sem.",
      value: unavailable,
      verdict: "Disponible avec un plan d’entraînement",
      sparkline: null,
      tone: "muted",
    },
  ];
  const windows = sparklineWindows(start, today);
  const formatters: Record<string, (value: number) => string> = {
    efficiency: (value) => `${formatPace(value)} /km`,
    climbing: (value) => `${formatInteger(value)} m/h`,
    threshold: (value) => `${formatPace(value)} /km`,
    vo2: (value) => formatInteger(value),
    drift: (value) => `${formatDecimal(value)} %`,
  };
  for (const item of rows) {
    const format = formatters[item.key];
    if (!format || !item.sparkline) continue;
    item.samples = item.sparkline.map((value, index) => ({
      title: `${formatDayMonthShort(windows[index].from)} – ${formatDayMonthShort(windows[index].to)}`,
      value: value === null ? "Pas de mesure" : format(value),
    }));
  }
  const predictions = racePredictions(history.vo2, history.races, today);
  const records = fitnessRecords(history.activities, history.laps);
  return {
    ...reading,
    load: load ? { ...load, note: loadNote(load) } : null,
    rows,
    note: coachNote(measures),
    predictions,
    predictionTimes: (predictions?.predictions ?? []).map((prediction) => ({
      key: prediction.key,
      label: prediction.label,
      value: predictionTime(prediction.key, prediction.seconds),
    })),
    weeks: weeklyVolume(history.activities, history.races, today),
    records: [
      ...records.efforts.map((effort) => ({
        key: effort.key,
        label: effort.label,
        value: formatClock(effort.seconds),
        date: formatMonthYear(effort.day),
        href: `/activities/${effort.activityId}`,
      })),
      ...(records.longest
        ? [
            {
              key: "longest",
              label: "Sortie la plus longue",
              value: formatKilometers(records.longest.meters),
              date: formatMonthYear(records.longest.day),
              href: `/activities/${records.longest.activityId}`,
            },
          ]
        : []),
      ...(records.weeklyGain
        ? [
            {
              key: "weekly-gain",
              label: "D+ max sur une semaine",
              value: `${formatInteger(records.weeklyGain.meters)} m`,
              date: formatMonthYear(records.weeklyGain.weekStart),
              href: null,
            },
          ]
        : []),
    ],
  };
}

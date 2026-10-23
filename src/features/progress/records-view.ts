import { coachRequestHref } from "@/features/coach/request";
import {
  formatClock,
  formatInteger,
  formatMonthYear,
  formatPace,
  ofMonth,
} from "./format";
import type {
  GarminPrediction,
  GarminPredictionKey,
} from "./garmin-predictions";
import type { DayValue } from "./history";
import { addDays, daysBetween } from "./period";
import type {
  EnduranceRecord,
  RecordPoint,
  RecordsModel,
  RoadKey,
} from "./record-history";

export const newRecordDays = 30;
export const reachRatio = 1.03;
export const vo2DeltaDays = 90;

const speedDistances: {
  key: RoadKey;
  prediction: GarminPredictionKey;
  label: string;
}[] = [
  { key: "5k", prediction: "5k", label: "5K" },
  { key: "10k", prediction: "10k", label: "10K" },
  { key: "half", prediction: "half_marathon", label: "Semi-marathon" },
  { key: "marathon", prediction: "marathon", label: "Marathon" },
];

export type RecordRow = {
  key: string;
  label: string;
  detail: string;
  value: string | null;
  side: string | null;
  tone: "success" | "muted";
  href: string | null;
};

export type ReachCard = {
  label: string;
  record: string;
  recordDay: string;
  recordDate: string;
  prediction: string;
  gapSeconds: number;
  gap: string;
  tone: "success" | "warning";
  progress: number;
  coachHref: string;
};

export type MarkerCard = {
  key: string;
  label: string;
  value: string | null;
  unit: string | null;
  detail: string;
  tone: "success" | "warning" | "muted";
};

export type ThresholdMarkers = {
  speedMps: number | null;
  heartRateBpm: number | null;
  override: number | null;
};

export type RecordsView = {
  headline: string;
  paragraph: string;
  reach: ReachCard | null;
  speed: RecordRow[];
  endurance: RecordRow[];
  markers: MarkerCard[];
  empty: boolean;
};

function isNew(
  record: { history: RecordPoint[]; current: RecordPoint | null },
  today: string,
) {
  return (
    record.current !== null &&
    record.history.length > 1 &&
    daysBetween(record.current.day, today) <= newRecordDays
  );
}

function source(point: RecordPoint) {
  return `${point.name} · ${formatMonthYear(point.day)}`;
}

function speedRows(
  model: RecordsModel,
  predictions: GarminPrediction[],
  today: string,
): RecordRow[] {
  return speedDistances.map((distance) => {
    const record = model.road.find((item) => item.key === distance.key)!;
    const prediction = predictions.find(
      (item) => item.key === distance.prediction,
    );
    const current = record.current;
    const previous = record.history.at(-2);
    const fresh = isNew(record, today) && previous && current;
    return {
      key: distance.key,
      label: distance.label,
      detail: current ? source(current) : "jamais couru",
      value: current ? formatClock(current.value) : null,
      side: fresh
        ? `−${formatClock(previous.value - current.value)} · nouveau`
        : prediction
          ? `prévision ${formatClock(prediction.seconds)}`
          : null,
      tone: fresh ? "success" : "muted",
      href: current?.activityId ? `/activities/${current.activityId}` : null,
    };
  });
}

function enduranceValue(record: EnduranceRecord, value: number) {
  if (record.key === "distance" || record.key === "weeklyDistance")
    return `${formatInteger(value / 1000)} km`;
  if (record.key === "vam") return `${formatInteger(value)} m/h`;
  return `${formatInteger(value)} m`;
}

const enduranceRows = [
  { key: "distance", label: "Plus longue sortie" },
  { key: "gain", label: "D+ sur une sortie" },
  { key: "vam", label: "VAM sur 20 min" },
  { key: "weeklyDistance", label: "Semaine la plus chargée" },
] as const;

function endurance(model: RecordsModel, today: string): RecordRow[] {
  return enduranceRows.flatMap((definition) => {
    const record = model.endurance.find((item) => item.key === definition.key);
    const current = record?.current;
    if (!record || !current) return [];
    const week = definition.key === "weeklyDistance" ? model.busiestWeek : null;
    return [
      {
        key: definition.key,
        label: definition.label,
        detail: week
          ? `${week.gain === null ? "" : `${formatInteger(week.gain)} m D+ · `}${formatMonthYear(week.start)}`
          : source(current),
        value: enduranceValue(record, current.value),
        side: isNew(record, today) ? "nouveau" : null,
        tone: isNew(record, today) ? "success" : "muted",
        href: current.activityId
          ? `/activities/${current.activityId}`
          : "/activities",
      },
    ];
  });
}

function reach(
  model: RecordsModel,
  predictions: GarminPrediction[],
): ReachCard | null {
  const candidates = speedDistances.flatMap((distance) => {
    const current = model.road.find(
      (item) => item.key === distance.key,
    )?.current;
    const prediction = predictions.find(
      (item) => item.key === distance.prediction,
    );
    return current && prediction
      ? [
          {
            distance,
            current,
            prediction,
            ratio: prediction.seconds / current.value,
          },
        ]
      : [];
  });
  const best = candidates
    .filter((item) => item.ratio <= reachRatio)
    .sort((a, b) => a.ratio - b.ratio)[0];
  if (!best) return null;
  const gap = Math.round(best.prediction.seconds - best.current.value);
  const record = formatClock(best.current.value);
  const prediction = formatClock(best.prediction.seconds);
  return {
    label: best.distance.label,
    record,
    recordDay: best.current.day,
    recordDate: formatMonthYear(best.current.day),
    prediction,
    gapSeconds: gap,
    gap: gap <= 0 ? `marge ${formatClock(-gap)}` : `écart ${formatClock(gap)}`,
    tone: gap <= 0 ? "success" : "warning",
    progress: Math.min(1, best.current.value / best.prediction.seconds),
    coachHref: coachRequestHref(
      `Je veux tenter mon record sur ${best.distance.label} (${record}). Garmin me prédit ${prediction}. Comment préparer une tentative ?`,
    ),
  };
}

function vo2Marker(vo2: DayValue[], today: string): MarkerCard {
  const past = vo2
    .filter((item) => item.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const latest = past.at(-1);
  if (!latest)
    return {
      key: "vo2",
      label: "VO₂ max",
      value: null,
      unit: null,
      detail: "Pas encore d’estimation Garmin",
      tone: "muted",
    };
  const reference = [...past]
    .reverse()
    .find((item) => item.day <= addDays(latest.day, -vo2DeltaDays));
  const delta = reference
    ? Math.round(latest.value) - Math.round(reference.value)
    : null;
  return {
    key: "vo2",
    label: "VO₂ max",
    value: formatInteger(latest.value),
    unit: null,
    detail:
      delta === null
        ? "Garmin"
        : delta === 0
          ? "stable sur 3 mois"
          : `${delta > 0 ? "+" : "−"}${formatInteger(Math.abs(delta))} en 3 mois`,
    tone:
      delta === null || delta === 0
        ? "muted"
        : delta > 0
          ? "success"
          : "warning",
  };
}

function markers(
  model: RecordsModel,
  vo2: DayValue[],
  threshold: ThresholdMarkers | null,
  today: string,
): MarkerCard[] {
  const vam = model.endurance.find((item) => item.key === "vam")?.current;
  const heartRate = threshold?.override ?? threshold?.heartRateBpm ?? null;
  return [
    {
      key: "threshold-pace",
      label: "Allure seuil",
      value: threshold?.speedMps ? formatPace(1000 / threshold.speedMps) : null,
      unit: threshold?.speedMps ? "/km" : null,
      detail: threshold?.speedMps ? "Garmin" : "Pas de seuil Garmin",
      tone: "muted",
    },
    {
      key: "threshold-heart-rate",
      label: "FC seuil",
      value: heartRate === null ? null : formatInteger(heartRate),
      unit: heartRate === null ? null : "bpm",
      detail:
        threshold?.override != null
          ? "Ta valeur"
          : heartRate === null
            ? "Pas de seuil Garmin"
            : "Garmin",
      tone: "muted",
    },
    vo2Marker(vo2, today),
    {
      key: "vam",
      label: "VAM · 20 min",
      value: vam ? formatInteger(vam.value) : null,
      unit: vam ? "m/h" : null,
      detail: vam
        ? `record ${ofMonth(vam.day)}`
        : "Pas encore de montée mesurée",
      tone: "muted",
    },
  ];
}

export function recordsView({
  model,
  predictions,
  vo2,
  threshold,
  today,
}: {
  model: RecordsModel;
  predictions: GarminPrediction[];
  vo2: DayValue[];
  threshold: ThresholdMarkers | null;
  today: string;
}): RecordsView {
  const speed = speedRows(model, predictions, today);
  const enduranceList = endurance(model, today);
  const card = reach(model, predictions);
  const documented =
    speed.filter((row) => row.value !== null).length + enduranceList.length;
  const headline = card
    ? card.tone === "success"
      ? `Ton record sur ${card.label} peut tomber.`
      : `Ton ${card.label} est à portée.`
    : documented
      ? "Tes records racontent ta progression."
      : "Tes records attendent ton historique.";
  const paragraph = card
    ? card.gapSeconds <= 0
      ? `Garmin te prédit ${card.prediction} sur ${card.label}, plus vite que ton record ${ofMonth(card.recordDay)} (${card.record}). Prépare une tentative sur une course test.`
      : `Garmin te prédit ${card.prediction} sur ${card.label}, à ${formatInteger(card.gapSeconds)} secondes de ton record ${ofMonth(card.recordDay)}. Une course test bien placée te dira si tu peux le battre.`
    : documented
      ? `${formatInteger(documented)} repères documentés dans tes activités Garmin, ${ofMonth(earliest(model) ?? today)} à aujourd’hui.`
      : "Aucune activité importée ne fournit encore les données nécessaires. Tes records apparaîtront avec un historique exploitable.";
  return {
    headline,
    paragraph,
    reach: card,
    speed,
    endurance: enduranceList,
    markers: markers(model, vo2, threshold, today),
    empty: documented === 0,
  };
}

function earliest(model: RecordsModel) {
  return model.activities[0]?.day ?? null;
}

import type { Trend } from "@/components/stride/marks";
import { formatDayMonth, formatInteger } from "./format";
import type {
  Legs,
  RangeSignal,
  RecoveryModel,
  Soreness,
  Stress,
} from "./recovery";

export type DeviationKey = "sleep" | "hrv" | "resting" | "load" | "legs";

export type Deviation = {
  key: DeviationKey;
  value: string;
  caption: string;
  score: number | null;
};

export type SignalCard = {
  value: string;
  context: string;
  trend: Trend;
  status: string;
  note: string;
};

export type RecoveryView = {
  headline: string;
  summary: string;
  readiness: {
    today: number;
    average: number | null;
    label: string;
    trend: Trend;
  } | null;
  deviations: Deviation[];
  sleep:
    | (SignalCard & {
        nights: { day: string; seconds: number | null; today: boolean }[];
      })
    | null;
  hrv: (SignalCard & Pick<RangeSignal, "points" | "range">) | null;
  resting: (SignalCard & Pick<RangeSignal, "points" | "range">) | null;
  races: { id: string; name: string; days: number; ongoing: boolean }[];
  racesNote: string;
};

export const legsLabels: Record<Legs, string> = {
  heavy: "Lourdes",
  normal: "Normales",
  fresh: "Fraîches",
};
export const sorenessLabels: Record<Soreness, string> = {
  none: "Aucune",
  light: "Légères",
  marked: "Marquées",
};
export const stressLabels: Record<Stress, string> = {
  low: "Faible",
  normal: "Normal",
  high: "Élevé",
};

const readinessLabels = {
  high: "Élevée · prêt pour une séance exigeante",
  moderate: "Modérée · entraîne-toi, mais adapte",
  low: "Basse · privilégie une séance facile",
  poor: "Faible · laisse ton corps récupérer",
} as const;

const hundredths = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const legsScore: Record<Legs, number> = { heavy: -0.6, normal: 0, fresh: 0.6 };

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function sign(value: number) {
  return value > 0 ? "+" : value < 0 ? "−" : "±";
}

export function formatSleep(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function signedSleep(seconds: number) {
  return `${sign(Math.round(seconds / 60))}${formatSleep(Math.abs(seconds))}`;
}

function signedInteger(value: number, unit = "") {
  const rounded = Math.round(value);
  return `${sign(rounded)}${formatInteger(Math.abs(rounded))}${unit}`;
}

function days(count: number, noun: "nuit" | "jour") {
  return `${count} ${noun}${count > 1 ? "s" : ""}`;
}

function deviations(model: RecoveryModel): Deviation[] {
  const { sleep, hrv, restingHeartRate, load, checkin } = model;
  return [
    sleep && sleep.average !== null
      ? {
          key: "sleep",
          value: signedSleep(sleep.last - sleep.average),
          caption: `Sommeil ${formatSleep(sleep.last)}`,
          score: clamp((sleep.last - sleep.average) / 3600),
        }
      : {
          key: "sleep",
          value: "—",
          caption: sleep ? `Sommeil ${formatSleep(sleep.last)}` : "Sommeil",
          score: null,
        },
    hrv && hrv.median !== null && hrv.range
      ? {
          key: "hrv",
          value: signedInteger(hrv.last - hrv.median, " ms"),
          caption: `VFC ${formatInteger(hrv.last)} ms`,
          score: clamp(
            (hrv.last - hrv.median) /
              Math.max(5, hrv.range.high - hrv.range.low),
          ),
        }
      : {
          key: "hrv",
          value: "—",
          caption: hrv ? `VFC ${formatInteger(hrv.last)} ms` : "VFC",
          score: null,
        },
    restingHeartRate && restingHeartRate.median !== null
      ? {
          key: "resting",
          value: signedInteger(restingHeartRate.last - restingHeartRate.median),
          caption: `FC repos ${formatInteger(restingHeartRate.last)}`,
          score: clamp(-(restingHeartRate.last - restingHeartRate.median) / 5),
        }
      : {
          key: "resting",
          value: "—",
          caption: restingHeartRate
            ? `FC repos ${formatInteger(restingHeartRate.last)}`
            : "FC repos",
          score: null,
        },
    load
      ? {
          key: "load",
          value:
            load.average === null
              ? "—"
              : `${sign(Math.round((load.ratio - load.average) * 100))}${hundredths.format(Math.abs(load.ratio - load.average))}`,
          caption: `Charge ${hundredths.format(load.ratio)}`,
          score:
            load.average === null
              ? null
              : clamp(-(load.ratio - load.average) / 0.3),
        }
      : { key: "load", value: "—", caption: "Charge", score: null },
    checkin?.legs
      ? {
          key: "legs",
          value: legsLabels[checkin.legs],
          caption: "Jambes",
          score: legsScore[checkin.legs],
        }
      : { key: "legs", value: "—", caption: "Jambes à saisir", score: null },
  ];
}

const causes: Record<DeviationKey, { headline: string; summary: string }> = {
  sleep: {
    headline: "Une courte nuit pèse sur ta forme du jour.",
    summary: "Le creux d’aujourd’hui vient surtout du sommeil.",
  },
  hrv: {
    headline: "Ta VFC est basse ce matin.",
    summary: "Le creux d’aujourd’hui vient surtout de ta VFC nocturne.",
  },
  resting: {
    headline: "Ta FC au repos est au-dessus de l’habitude.",
    summary: "Le creux d’aujourd’hui vient surtout de ta FC au repos.",
  },
  load: {
    headline: "Ta charge récente pèse sur ta récupération.",
    summary: "Le creux d’aujourd’hui vient surtout de ta charge récente.",
  },
  legs: {
    headline: "Tes jambes sont lourdes ce matin.",
    summary: "Le creux d’aujourd’hui vient surtout de tes jambes.",
  },
};

function reading(model: RecoveryModel, items: Deviation[]) {
  const { readiness, hrv, checkin } = model;
  if (!readiness && !model.sleep && !hrv)
    return {
      headline: "Pas encore assez de nuits mesurées pour lire ta récupération.",
      summary:
        "Stride affichera ta récupération dès que Garmin aura transmis ton sommeil, ta VFC et ta disponibilité.",
    };
  const sentences: string[] = [];
  if (readiness)
    sentences.push(
      readiness.average === null
        ? `Ta forme du jour Garmin est à ${formatInteger(readiness.today)}.`
        : `Ta forme du jour Garmin est à ${formatInteger(readiness.today)}, contre ${formatInteger(readiness.average)} en moyenne sur 14 jours.`,
    );
  const worst = items
    .filter((item) => item.score !== null && item.score <= -0.25)
    .sort((a, b) => a.score! - b.score!)[0];
  const best = items
    .filter((item) => item.score !== null && item.score >= 0.25)
    .sort((a, b) => b.score! - a.score!)[0];
  if (readiness?.trend === "watch" && worst)
    sentences.push(causes[worst.key].summary);
  if (hrv?.position === "within")
    sentences.push("Ta VFC reste dans ta plage habituelle.");
  else if (hrv?.position === "below")
    sentences.push("Ta VFC est sous ta plage habituelle.");
  if (checkin?.legs)
    sentences.push(
      `Tu as noté des jambes ${legsLabels[checkin.legs].toLowerCase()}.`,
    );
  let headline = "Ta récupération est dans ta moyenne.";
  if (readiness?.trend === "watch")
    headline =
      worst?.key === "sleep" && hrv?.position !== "below"
        ? "Une courte nuit sur de bonnes bases."
        : worst
          ? causes[worst.key].headline
          : "Ta forme du jour est sous ta moyenne.";
  else if (readiness?.trend === "improving")
    headline = best
      ? "Tu récupères mieux que d’habitude."
      : "Ta forme du jour dépasse ta moyenne.";
  else if (!readiness && worst) headline = causes[worst.key].headline;
  return { headline, summary: sentences.join(" ") };
}

function rangeCard(
  signal: RangeSignal,
  unit: string,
  noun: string,
  baselineLabel: string,
  notes: { within: string; low: string; lowStreak: string; high: string },
  higherIsBetter: boolean,
): SignalCard & Pick<RangeSignal, "points" | "range"> {
  const range = signal.range;
  const unfavorable = higherIsBetter ? "below" : "above";
  const status =
    signal.position === null
      ? `Plage en cours de calcul`
      : signal.position === "within"
        ? "Dans ta plage"
        : signal.position === unfavorable
          ? higherIsBetter
            ? `Sous la plage · ${days(signal.streak, "jour")}`
            : `${signedInteger(signal.last - (signal.median ?? signal.last))} · ${days(signal.streak, "jour")}`
          : higherIsBetter
            ? "Au-dessus de la plage"
            : "Sous ta plage";
  return {
    value: `${formatInteger(signal.last)} ${unit}`,
    context: range
      ? `${baselineLabel} ${range.low === range.high ? range.low : `${range.low}–${range.high}`}`
      : `${noun} · pas assez de mesures`,
    trend: signal.trend,
    status,
    note:
      signal.position === unfavorable
        ? signal.streak >= 2
          ? notes.lowStreak
          : notes.low
        : signal.position === "within" || signal.position === null
          ? notes.within
          : notes.high,
    points: signal.points,
    range,
  };
}

const hrvStatusLabels: Record<string, string> = {
  BALANCED: "équilibré",
  UNBALANCED: "déséquilibré",
  LOW: "bas",
  POOR: "faible",
};

export function recoveryView(model: RecoveryModel): RecoveryView {
  const items = deviations(model);
  const { readiness, sleep, hrv, restingHeartRate } = model;
  const garminStatus = hrv?.status ? hrvStatusLabels[hrv.status] : undefined;
  return {
    ...reading(model, items),
    readiness: readiness
      ? {
          today: readiness.today,
          average: readiness.average,
          label: readinessLabels[readiness.level],
          trend: readiness.trend,
        }
      : null,
    deviations: items,
    sleep: sleep
      ? {
          value: formatSleep(sleep.last),
          context: [
            sleep.average !== null && `moy. ${formatSleep(sleep.average)}`,
            sleep.score !== null && `qualité ${formatInteger(sleep.score)}`,
          ]
            .filter(Boolean)
            .join(" · "),
          trend: sleep.trend,
          status:
            sleep.streak > 0
              ? `À surveiller · ${days(sleep.streak, "nuit")}`
              : "Dans ta moyenne",
          note: "14 dernières nuits · la dernière en ambre",
          nights: sleep.nights.map((night) => ({
            ...night,
            today: night.day === sleep.lastDay,
          })),
        }
      : null,
    hrv: hrv
      ? rangeCard(
          hrv,
          "ms",
          "VFC",
          "ta plage",
          {
            within: garminStatus
              ? `Statut Garmin : ${garminStatus}.`
              : "Ta VFC reste dans ta plage habituelle.",
            low: "Une nuit basse, c’est normal. Deux d’affilée méritent d’alléger.",
            lowStreak:
              "Plusieurs nuits sous ta plage : allège l’intensité jusqu’au retour.",
            high: garminStatus
              ? `Au-dessus de ta plage. Statut Garmin : ${garminStatus}.`
              : "Au-dessus de ta plage habituelle.",
          },
          true,
        )
      : null,
    resting: restingHeartRate
      ? rangeCard(
          restingHeartRate,
          "bpm",
          "FC au repos",
          "habituelle",
          {
            within: "Dans ta plage habituelle.",
            low: "Souvent la suite d’un sommeil court ou d’efforts longs.",
            lowStreak:
              "Au-dessus de l’habitude plusieurs jours de suite : surveille ton sommeil et ta charge.",
            high: "Plus basse que d’habitude.",
          },
          false,
        )
      : null,
    races: model.races.flatMap((race): RecoveryView["races"] =>
      race.days !== null
        ? [{ id: race.id, name: race.name, days: race.days, ongoing: false }]
        : race.ongoing !== null
          ? [
              {
                id: race.id,
                name: race.name,
                days: race.ongoing,
                ongoing: true,
              },
            ]
          : [],
    ),
    racesNote: model.nextRace
      ? `Jours avant que la VFC revienne dans ta plage. Stride mesurera ta récupération après ${model.nextRace.name} (${formatDayMonth(model.nextRace.day)}).`
      : "Jours avant que la VFC revienne dans ta plage après chaque course.",
  };
}

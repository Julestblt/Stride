import { addDays } from "./period";

export const garminPredictionMetrics = {
  race_prediction_5k_seconds: "5k",
  race_prediction_10k_seconds: "10k",
  race_prediction_half_marathon_seconds: "half_marathon",
  race_prediction_marathon_seconds: "marathon",
} as const;

export type GarminPredictionKey =
  (typeof garminPredictionMetrics)[keyof typeof garminPredictionMetrics];

export type PredictionRow = {
  metric: string;
  observed_on: string | null;
  value_numeric: number | string | null;
};

export type GarminPrediction = {
  key: GarminPredictionKey;
  label: string;
  meters: number;
  seconds: number;
  asOf: string;
  previous: { seconds: number; asOf: string } | null;
};

export const predictionDeltaDays = 28;

export const garminPredictionDistances: Record<
  GarminPredictionKey,
  { label: string; meters: number }
> = {
  "5k": { label: "5K", meters: 5000 },
  "10k": { label: "10K", meters: 10_000 },
  half_marathon: { label: "Semi-marathon", meters: 21_097.5 },
  marathon: { label: "Marathon", meters: 42_195 },
};

function valid(rows: PredictionRow[], metric: string) {
  return rows
    .flatMap((row) => {
      const seconds = Number(row.value_numeric);
      return row.metric === metric &&
        row.observed_on !== null &&
        Number.isFinite(seconds) &&
        seconds > 0
        ? [{ day: row.observed_on, seconds: Math.round(seconds) }]
        : [];
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}

export function garminPredictions(
  rows: PredictionRow[],
  today: string,
): GarminPrediction[] {
  return Object.entries(garminPredictionMetrics).flatMap(([metric, key]) => {
    const series = valid(rows, metric).filter((item) => item.day <= today);
    const latest = series[0];
    if (!latest) return [];
    const cutoff = addDays(latest.day, -predictionDeltaDays);
    const previous = series.find((item) => item.day <= cutoff) ?? null;
    return [
      {
        key,
        ...garminPredictionDistances[key],
        seconds: latest.seconds,
        asOf: latest.day,
        previous: previous
          ? { seconds: previous.seconds, asOf: previous.day }
          : null,
      },
    ];
  });
}

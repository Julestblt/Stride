import type { InsightObservation } from "@/features/insights/facts";

export type HeartRateZones = {
  method: "karvonen" | "percentage_maximum";
  maximum: number;
  resting: number | null;
  restingSamples: number;
  windowStart: string;
  windowEnd: string;
  zones: { zone: number; lower: number; upper: number }[];
};

export function calculateHeartRateZones({
  maximum,
  observations,
  today,
}: {
  maximum: number | null;
  observations: InsightObservation[];
  today: Date;
}): HeartRateZones | null {
  if (
    maximum === null ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    !Number.isFinite(today.getTime())
  )
    return null;
  const end = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const start = end - 27 * 86_400_000;
  const restingValues = observations
    .filter((item) => {
      const observed = Date.parse(item.observedOn);
      return (
        item.metric === "resting_heart_rate_bpm" &&
        observed >= start &&
        observed <= end &&
        Number.isFinite(item.value) &&
        item.value > 0 &&
        item.value < maximum
      );
    })
    .map((item) => item.value)
    .sort((a, b) => a - b);
  const middle = Math.floor(restingValues.length / 2);
  const resting =
    restingValues.length >= 7
      ? (restingValues[middle] +
          restingValues[Math.floor((restingValues.length - 1) / 2)]) /
        2
      : null;
  const baseline = resting ?? 0;
  const boundaries = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((intensity) =>
    Math.round(baseline + intensity * (maximum - baseline)),
  );
  const zones = boundaries
    .slice(0, 5)
    .map((lower, index) => ({
      zone: index + 1,
      lower,
      upper: boundaries[index + 1] - (index < 4 ? 1 : 0),
    }));
  if (zones.some((zone) => zone.lower <= 0 || zone.upper < zone.lower))
    return null;
  return {
    method: resting === null ? "percentage_maximum" : "karvonen",
    maximum,
    resting,
    restingSamples: restingValues.length,
    windowStart: new Date(start).toISOString().slice(0, 10),
    windowEnd: new Date(end).toISOString().slice(0, 10),
    zones,
  };
}

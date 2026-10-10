import { z } from "zod";
import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";

export type RoutePoint = readonly [latitude: number, longitude: number];
export type TrackBounds = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};
export type Zone = 1 | 2 | 3 | 4 | 5;
export type ZoneBounds = HeartRateZones["zones"];

export const seriesKeys = [
  "elapsed_s",
  "distance_m",
  "heart_rate",
  "speed_mps",
  "elevation_m",
  "cadence",
  "power_w",
] as const;
export type SeriesKey = (typeof seriesKeys)[number];
export type Series = Partial<Record<SeriesKey, (number | null)[]>>;

export type ActivityTrack = {
  route: RoutePoint[] | null;
  bounds: TrackBounds | null;
  series: Series;
  length: number;
  histogram: [number, number][];
};

export const trackColumns =
  "status, route, bounds, series, heart_rate_histogram, source_point_count";

const trackRowSchema = z.object({
  status: z.enum(["available", "unavailable"]),
  route: z.unknown(),
  bounds: z
    .object({
      min_lat: z.number(),
      min_lon: z.number(),
      max_lat: z.number(),
      max_lon: z.number(),
    })
    .nullable(),
  series: z.record(z.string(), z.array(z.number().nullable())).nullable(),
  heart_rate_histogram: z.record(z.string(), z.number()).nullable(),
});

const earthRadiusMeters = 6_371_000;
const minimumRunningSpeed = 0.8;

export function parseTrack(row: unknown): ActivityTrack | null {
  const parsed = trackRowSchema.safeParse(row);
  if (!parsed.success || parsed.data.status !== "available") return null;
  const {
    route,
    bounds,
    series: rawSeries,
    heart_rate_histogram,
  } = parsed.data;
  const series: Series = {};
  let length = 0;
  for (const key of seriesKeys) {
    const column = rawSeries?.[key];
    if (!column || column.length < 2) continue;
    if (length === 0) length = column.length;
    if (column.length === length) series[key] = column;
  }
  for (const key of seriesKeys) {
    const column = series[key];
    if (!column) continue;
    series[key] = column.map((value) =>
      value !== null &&
      key !== "elevation_m" &&
      (value < 0 || (key === "heart_rate" && value === 0))
        ? null
        : value,
    );
    if (key === "elapsed_s" || key === "distance_m") {
      let previous = 0;
      for (const value of series[key]!) {
        if (value === null) continue;
        if (value < previous) {
          delete series[key];
          break;
        }
        previous = value;
      }
    }
  }
  const histogram = Object.entries(heart_rate_histogram ?? {})
    .map(([bpm, seconds]): [number, number] => [Number(bpm), seconds])
    .filter(([bpm, seconds]) => Number.isFinite(bpm) && bpm > 0 && seconds > 0)
    .sort((a, b) => a[0] - b[0]);
  const validatedRoute = z
    .array(
      z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
    )
    .safeParse(route);
  const usableRoute =
    validatedRoute.success && validatedRoute.data.length >= 2
      ? validatedRoute.data
      : null;
  if (!usableRoute && length === 0) return null;
  return {
    route: usableRoute,
    bounds: bounds
      ? {
          minLat: bounds.min_lat,
          minLon: bounds.min_lon,
          maxLat: bounds.max_lat,
          maxLon: bounds.max_lon,
        }
      : null,
    series,
    length,
    histogram,
  };
}

function haversine(a: RoutePoint, b: RoutePoint) {
  const toRadians = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRadians;
  const dLon = (b[1] - a[1]) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * toRadians) *
      Math.cos(b[0] * toRadians) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeFractions(route: readonly RoutePoint[]) {
  const cumulative = [0];
  for (let index = 1; index < route.length; index++)
    cumulative.push(
      cumulative[index - 1] + haversine(route[index - 1], route[index]),
    );
  const total = cumulative[cumulative.length - 1];
  return {
    fractions: cumulative.map((value) => (total > 0 ? value / total : 0)),
    meters: total,
  };
}

function distanceFractions(series: Series, length: number) {
  const distance = series.distance_m;
  if (!distance) return null;
  const filled: number[] = [];
  let last = 0;
  for (let index = 0; index < length; index++) {
    const value = distance[index];
    if (value !== null && value >= last) last = value;
    filled.push(last);
  }
  const total = filled[length - 1];
  return total > 0 ? filled.map((value) => value / total) : null;
}

function nearestIndex(fractions: readonly number[], target: number) {
  let low = 0;
  let high = fractions.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (fractions[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && target - fractions[low - 1] < fractions[low] - target)
    return low - 1;
  return low;
}

export function paceFromSpeed(speed: number | null) {
  return speed !== null && speed >= minimumRunningSpeed ? 1000 / speed : null;
}

export function zoneOf(heartRate: number | null, zones: ZoneBounds | null) {
  if (heartRate === null || !zones || zones.length !== 5) return null;
  for (let zone = 5; zone >= 2; zone--)
    if (heartRate >= zones[zone - 1].lower) return zone as Zone;
  return 1 as Zone;
}

export function timeInZones(
  histogram: readonly [number, number][],
  zones: ZoneBounds | null,
) {
  if (!zones || histogram.length === 0) return null;
  const seconds: Record<Zone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [bpm, time] of histogram) {
    const zone = zoneOf(bpm, zones);
    if (zone) seconds[zone] += time;
  }
  return ([5, 4, 3, 2, 1] as const).map((zone) => ({
    zone,
    seconds: seconds[zone],
  }));
}

export type RouteBand = { from: number; to: number; label: string };

export type RouteView = {
  route: [number, number][];
  fractions: number[];
  km: number[];
  pace: (number | null)[];
  heartRate: (number | null)[];
  elevation: (number | null)[];
  zone: (Zone | null)[];
  intensity: {
    pace: (number | null)[];
    heartRate: (number | null)[];
    elevation: (number | null)[];
  };
  profile: { fractions: number[]; elevation: number[] } | null;
  elevationRange: { min: number; max: number } | null;
  bands: RouteBand[];
  distanceKm: number;
};

function normalize(values: (number | null)[], invert = false) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return values.map(() => null);
  const sorted = [...present].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.05)];
  const high =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const span = high - low || 1;
  return values.map((value) => {
    if (value === null) return null;
    const ratio = Math.min(1, Math.max(0, (value - low) / span));
    return invert ? 1 - ratio : ratio;
  });
}

function round(value: number | null, digits = 1) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildRouteView(
  track: ActivityTrack,
  options: { zones: ZoneBounds | null; bands: RouteBand[]; running?: boolean },
): RouteView | null {
  const route = track.route;
  if (!route) return null;
  const { fractions, meters } = routeFractions(route);
  const seriesFractions = distanceFractions(track.series, track.length);
  const lookup = (key: SeriesKey, fraction: number) => {
    const column = track.series[key];
    if (!column) return null;
    const index = seriesFractions
      ? nearestIndex(seriesFractions, fraction)
      : Math.round(fraction * (track.length - 1));
    return column[Math.min(Math.max(index, 0), column.length - 1)];
  };
  const sampledMeters = track.series.distance_m
    ?.filter((value) => value !== null)
    .at(-1);
  const totalMeters =
    sampledMeters && sampledMeters > 0 ? sampledMeters : meters;
  const pace = fractions.map((fraction) =>
    options.running === false
      ? null
      : round(paceFromSpeed(lookup("speed_mps", fraction)), 0),
  );
  const heartRate = fractions.map((fraction) =>
    round(lookup("heart_rate", fraction), 0),
  );
  const elevation = fractions.map((fraction) =>
    round(lookup("elevation_m", fraction), 1),
  );
  const elevationSeries = track.series.elevation_m;
  const profile =
    elevationSeries && track.length >= 2
      ? (() => {
          const base =
            seriesFractions ??
            Array.from(
              { length: track.length },
              (_, index) => index / (track.length - 1),
            );
          const points: { fraction: number; value: number }[] = [];
          elevationSeries.forEach((value, index) => {
            if (value !== null) points.push({ fraction: base[index], value });
          });
          return points.length >= 2
            ? {
                fractions: points.map((point) => round(point.fraction, 4)!),
                elevation: points.map((point) => round(point.value, 1)!),
              }
            : null;
        })()
      : null;
  return {
    route: route.map(([latitude, longitude]) => [latitude, longitude]),
    fractions: fractions.map((value) => round(value, 4)!),
    km: fractions.map((fraction) => round((fraction * totalMeters) / 1000, 2)!),
    pace,
    heartRate,
    elevation,
    zone: heartRate.map((value) => zoneOf(value, options.zones)),
    intensity: {
      pace: normalize(pace, true).map((value) => round(value, 2)),
      heartRate: normalize(heartRate).map((value) => round(value, 2)),
      elevation: normalize(elevation).map((value) => round(value, 2)),
    },
    profile,
    elevationRange: profile
      ? {
          min: Math.min(...profile.elevation),
          max: Math.max(...profile.elevation),
        }
      : null,
    bands: options.bands,
    distanceKm: totalMeters / 1000,
  };
}

export type LapSpan = {
  durationSeconds: number | null;
  distanceMeters: number | null;
};

export function effortBands(
  laps: readonly LapSpan[],
  overallPace: number | null,
): { distance: RouteBand[]; time: RouteBand[] } {
  const empty = { distance: [], time: [] };
  const usable = laps.every(
    (lap) =>
      lap.durationSeconds !== null &&
      lap.distanceMeters !== null &&
      lap.distanceMeters > 0,
  );
  if (!usable || laps.length < 3 || overallPace === null) return empty;
  const totalSeconds = laps.reduce((sum, lap) => sum + lap.durationSeconds!, 0);
  const totalMeters = laps.reduce((sum, lap) => sum + lap.distanceMeters!, 0);
  const distance: RouteBand[] = [];
  const time: RouteBand[] = [];
  let elapsed = 0;
  let covered = 0;
  laps.forEach((lap, index) => {
    const seconds = lap.durationSeconds!;
    const meters = lap.distanceMeters!;
    const pace = seconds / (meters / 1000);
    if (seconds >= 60 && pace <= overallPace * 0.92) {
      const label = `Lap ${index + 1}`;
      distance.push({
        from: covered / totalMeters,
        to: (covered + meters) / totalMeters,
        label,
      });
      time.push({
        from: elapsed / totalSeconds,
        to: (elapsed + seconds) / totalSeconds,
        label,
      });
    }
    elapsed += seconds;
    covered += meters;
  });
  return distance.length > 0 && distance.length < laps.length
    ? { distance, time }
    : empty;
}

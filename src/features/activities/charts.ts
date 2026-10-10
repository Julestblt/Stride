import {
  paceFromSpeed,
  type ActivityTrack,
  type RouteBand,
  type ZoneBounds,
} from "./track";

export const chartWidth = 900;
const topPadding = 22;
const bottomPadding = 20;

export type ChartBand = { x: number; width: number; label: string };
export type InspectionSample = {
  x: number;
  y: number | null;
  value: string | null;
  position: string;
};
export type LineChart = {
  samples: InspectionSample[];
  height: number;
  path: string;
  minLabel: string;
  maxLabel: string;
};
export type HeartRateChart = LineChart & {
  zoneBand: { y: number; height: number } | null;
  peak: { x: number; y: number; value: number } | null;
};
export type ScatterChart = {
  height: number;
  points: { x: number; y: number }[];
  paceLabels: [string, string];
  heartRateLabels: [string, string];
};
export type ChartsView = {
  duration: number | null;
  axis: "elapsed time" | "sample position";
  timeLabels: [string, string, string];
  bands: ChartBand[];
  pace: LineChart | null;
  heartRate: HeartRateChart | null;
  cadence: LineChart | null;
  elevation: LineChart | null;
  scatter: ScatterChart | null;
};

export function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function percentile(sorted: readonly number[], ratio: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function domainOf(values: (number | null)[], trim: boolean) {
  const present = values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (present.length < 2) return null;
  const low = trim ? percentile(present, 0.04) : present[0];
  const high = trim ? percentile(present, 0.96) : present[present.length - 1];
  const span = high - low || 1;
  return { min: low - span * 0.05, max: high + span * 0.05 };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function path(
  xs: readonly number[],
  values: readonly (number | null)[],
  domain: { min: number; max: number },
  height: number,
  invert: boolean,
) {
  let drawing = false;
  let data = "";
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const y = yOf(value, domain, height, invert);
    data += `${drawing ? "L" : "M"}${round(xs[index])},${round(y)}`;
    drawing = true;
  });
  return data;
}

function yOf(
  value: number,
  domain: { min: number; max: number },
  height: number,
  invert: boolean,
) {
  const usable = height - topPadding - bottomPadding;
  const ratio =
    (Math.min(domain.max, Math.max(domain.min, value)) - domain.min) /
    (domain.max - domain.min || 1);
  return topPadding + (invert ? ratio : 1 - ratio) * usable;
}

export function buildChartsView(
  track: ActivityTrack,
  options: { zones: ZoneBounds | null; bands: RouteBand[]; running?: boolean },
): ChartsView | null {
  if (track.length < 2) return null;
  const elapsed = track.series.elapsed_s;
  const completeElapsed =
    elapsed?.length === track.length &&
    elapsed.every(
      (value): value is number => value !== null && Number.isFinite(value),
    ) &&
    elapsed[0] >= 0 &&
    elapsed.every(
      (value, index) => index === 0 || value >= elapsed[index - 1]!,
    );
  const duration =
    completeElapsed && elapsed.at(-1)! > elapsed[0] ? elapsed.at(-1)! : null;
  const axis = duration !== null ? "elapsed time" : "sample position";
  const xs = Array.from(
    { length: track.length },
    (_, index) =>
      (duration !== null
        ? elapsed![index]! / duration
        : index / (track.length - 1)) * chartWidth,
  );
  const samplesOf = (
    values: readonly (number | null)[],
    domain: { min: number; max: number },
    height: number,
    invert: boolean,
    format: (value: number) => string,
  ): InspectionSample[] =>
    xs.map((x, index) => {
      const value = values[index] ?? null;
      return {
        x: round(x),
        y: value === null ? null : round(yOf(value, domain, height, invert)),
        value: value === null ? null : format(value),
        position:
          duration !== null
            ? `Temps écoulé · ${formatClock(elapsed![index]!)}`
            : `Échantillon ${index + 1} sur ${track.length}`,
      };
    });
  const measurement = (value: number) =>
    value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const bands = (duration !== null ? options.bands : []).map((band) => ({
    x: round(band.from * chartWidth),
    width: round((band.to - band.from) * chartWidth),
    label: band.label,
  }));
  const paceValues = (
    options.running === false ? [] : (track.series.speed_mps ?? [])
  ).map(paceFromSpeed);
  const paceDomain = domainOf(paceValues, true);
  const paceHeight = 140;
  const pace: LineChart | null = paceDomain
    ? {
        samples: samplesOf(
          paceValues,
          paceDomain,
          paceHeight,
          true,
          (value) => `${formatClock(value)} min/km`,
        ),
        height: paceHeight,
        path: path(xs, paceValues, paceDomain, paceHeight, true),
        minLabel: formatClock(paceDomain.min),
        maxLabel: formatClock(paceDomain.max),
      }
    : null;

  const heartRates = track.series.heart_rate ?? [];
  const heartDomain = domainOf(heartRates, false);
  const heartHeight = 120;
  let heartRate: HeartRateChart | null = null;
  if (heartDomain) {
    let peakIndex = -1;
    heartRates.forEach((value, index) => {
      if (
        value !== null &&
        (peakIndex === -1 || value > (heartRates[peakIndex] ?? 0))
      )
        peakIndex = index;
    });
    const zone = options.zones?.[3];
    const top = zone ? yOf(zone.upper + 1, heartDomain, heartHeight, false) : 0;
    const bottom = zone ? yOf(zone.lower, heartDomain, heartHeight, false) : 0;
    heartRate = {
      samples: samplesOf(
        heartRates,
        heartDomain,
        heartHeight,
        false,
        (value) => `${measurement(value)} bpm`,
      ),
      height: heartHeight,
      path: path(xs, heartRates, heartDomain, heartHeight, false),
      minLabel: String(Math.round(heartDomain.min)),
      maxLabel: String(Math.round(heartDomain.max)),
      zoneBand:
        zone && bottom > top
          ? { y: round(top), height: round(bottom - top) }
          : null,
      peak:
        peakIndex >= 0
          ? {
              x: round(xs[peakIndex]),
              y: round(
                yOf(heartRates[peakIndex]!, heartDomain, heartHeight, false),
              ),
              value: Math.round(heartRates[peakIndex]!),
            }
          : null,
    };
  }

  const lineOf = (
    values: (number | null)[] | undefined,
    height: number,
    format: (value: number) => string,
    unit: string,
  ): LineChart | null => {
    if (!values) return null;
    const domain = domainOf(values, false);
    if (!domain) return null;
    return {
      samples: samplesOf(
        values,
        domain,
        height,
        false,
        (value) => `${measurement(value)} ${unit}`,
      ),
      height,
      path: path(xs, values, domain, height, false),
      minLabel: format(domain.min),
      maxLabel: format(domain.max),
    };
  };

  const scatterHeight = 260;
  const scatterPoints = track.series.heart_rate
    ? paceValues
        .map((value, index) => ({ pace: value, heartRate: heartRates[index] }))
        .filter(
          (point): point is { pace: number; heartRate: number } =>
            point.pace !== null && point.heartRate !== null,
        )
    : [];
  const scatterPace = domainOf(
    scatterPoints.map((point) => point.pace),
    true,
  );
  const scatterHeart = domainOf(
    scatterPoints.map((point) => point.heartRate),
    false,
  );
  const scatter: ScatterChart | null =
    scatterPace && scatterHeart && scatterPoints.length >= 5
      ? {
          height: scatterHeight,
          points: scatterPoints.map((point) => ({
            x: round(
              ((Math.min(
                scatterPace.max,
                Math.max(scatterPace.min, point.pace),
              ) -
                scatterPace.min) /
                (scatterPace.max - scatterPace.min || 1)) *
                chartWidth,
            ),
            y: round(yOf(point.heartRate, scatterHeart, scatterHeight, false)),
          })),
          paceLabels: [
            formatClock(scatterPace.min),
            formatClock(scatterPace.max),
          ],
          heartRateLabels: [
            String(Math.round(scatterHeart.min)),
            String(Math.round(scatterHeart.max)),
          ],
        }
      : null;

  return {
    duration,
    axis,
    timeLabels:
      duration !== null
        ? ["0:00", formatClock(duration / 2), formatClock(duration)]
        : ["0%", "50%", "100%"],
    bands,
    pace,
    heartRate,
    cadence: lineOf(
      track.series.cadence,
      140,
      (value) => String(Math.round(value)),
      "pas/min",
    ),
    elevation: lineOf(
      track.series.elevation_m,
      140,
      (value) => `${Math.round(value)} m`,
      "m",
    ),
    scatter,
  };
}

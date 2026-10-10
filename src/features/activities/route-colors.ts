import type { ExpressionSpecification } from "maplibre-gl";
import type { RouteView } from "./track";

export type ColorMode = "zones" | "pace" | "heartRate" | "elevation";

export const colorModes: { mode: ColorMode; label: string }[] = [
  { mode: "zones", label: "Zones" },
  { mode: "pace", label: "Allure" },
  { mode: "heartRate", label: "FC" },
  { mode: "elevation", label: "Altitude" },
];

export const zoneHex = {
  1: "#3d4238",
  2: "#5e8fb8",
  3: "#a9c94a",
  4: "#e8f59a",
  5: "#ff6a3d",
} as const;

export type RoutePalette = Record<1 | 2 | 3 | 4 | 5, string>;

function channels(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rampColor(value: number, palette: RoutePalette = zoneHex) {
  const ramp = [palette[2], palette[4], palette[5]];
  const clamped = Math.min(1, Math.max(0, value));
  const scaled = clamped * (ramp.length - 1);
  const lower = Math.min(ramp.length - 2, Math.floor(scaled));
  const ratio = scaled - lower;
  const from = channels(ramp[lower]);
  const to = channels(ramp[lower + 1]);
  const mixed = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * ratio),
  );
  return `rgb(${mixed.join(",")})`;
}

export function availableModes(view: RouteView) {
  const has = (values: (number | null)[]) =>
    values.some((value) => value !== null);
  return colorModes.filter(({ mode }) =>
    mode === "zones"
      ? has(view.zone)
      : mode === "pace"
        ? has(view.intensity.pace)
        : mode === "heartRate"
          ? has(view.intensity.heartRate)
          : has(view.intensity.elevation),
  );
}

export function vertexColors(
  view: RouteView,
  mode: ColorMode,
  palette: RoutePalette = zoneHex,
) {
  const values: (number | null)[] =
    mode === "zones"
      ? view.zone
      : mode === "pace"
        ? view.intensity.pace
        : mode === "heartRate"
          ? view.intensity.heartRate
          : view.intensity.elevation;
  let previous: number | null = values.find((value) => value !== null) ?? null;
  return values.map((value) => {
    const current = value ?? previous;
    previous = current;
    if (current === null) return palette[1];
    return mode === "zones"
      ? palette[
          Math.min(5, Math.max(1, Math.round(current))) as 1 | 2 | 3 | 4 | 5
        ]
      : rampColor(current, palette);
  });
}

export function gradientStops(
  view: RouteView,
  mode: ColorMode,
  palette: RoutePalette = zoneHex,
) {
  const colors = vertexColors(view, mode, palette);
  const stops: [number, string][] = [];
  view.fractions.forEach((fraction, index) => {
    if (stops.length > 0 && fraction <= stops[stops.length - 1][0]) return;
    stops.push([fraction, colors[index]]);
  });
  return stops;
}

export function lineGradient(
  view: RouteView,
  mode: ColorMode,
  palette: RoutePalette = zoneHex,
): ExpressionSpecification {
  const stops = gradientStops(view, mode, palette);
  if (stops.length < 2) {
    const color = stops[0]?.[1] ?? palette[3];
    return ["step", ["line-progress"], color, 1, color];
  }
  if (mode === "zones") {
    const expression: ExpressionSpecification = [
      "step",
      ["line-progress"],
      stops[0][1],
    ];
    let last = stops[0][1];
    for (const [fraction, color] of stops.slice(1)) {
      if (color === last || fraction <= 0) continue;
      expression.push(fraction, color);
      last = color;
    }
    if (expression.length === 3)
      return ["step", ["line-progress"], stops[0][1], 1, stops[0][1]];
    return expression;
  }
  const expression: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["line-progress"],
  ];
  stops.forEach(([fraction, color], index) =>
    expression.push(index === 0 ? 0 : fraction, color),
  );
  return expression;
}

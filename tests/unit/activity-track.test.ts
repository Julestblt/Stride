import { describe, expect, it } from "vitest";
import {
  createExpression,
  latest,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  activityRowSchema,
  activityTitle,
} from "../../src/features/activities/activities";
import { activityDetailRowSchema } from "../../src/features/activities/detail";
import { buildActivityView } from "../../src/features/activities/activity-view";
import { buildChartsView } from "../../src/features/activities/charts";
import {
  gradientStops,
  lineGradient,
} from "../../src/features/activities/route-colors";
import {
  buildRouteView,
  parseTrack,
  paceFromSpeed,
  routeFractions,
  timeInZones,
} from "../../src/features/activities/track";

const zones = [
  { zone: 1, lower: 110, upper: 123 },
  { zone: 2, lower: 124, upper: 137 },
  { zone: 3, lower: 138, upper: 151 },
  { zone: 4, lower: 152, upper: 165 },
  { zone: 5, lower: 166, upper: 180 },
];

function row(values: Record<string, unknown> = {}) {
  return {
    status: "available",
    route: [
      [48.82, 2.41],
      [48.825, 2.415],
      [48.83, 2.42],
    ],
    bounds: { min_lat: 48.82, min_lon: 2.41, max_lat: 48.83, max_lon: 2.42 },
    series: {
      elapsed_s: [0, 300, 600],
      distance_m: [0, 1000, 2000],
      speed_mps: [3, null, 4],
      heart_rate: [130, 155, 170],
      elevation_m: [20, 30, 25],
    },
    heart_rate_histogram: { "100": 10, "130": 30, "155": 40, "170": 20 },
    ...values,
  };
}

function activity(type = "running") {
  return activityDetailRowSchema.parse({
    id: "a",
    activity_type: type,
    activity_name: " Evening run ",
    route_name: null,
    started_at: "2026-10-10T18:00:00Z",
    local_started_at: null,
    distance_meters: 2000,
    duration_seconds: 600,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    average_heart_rate: null,
    max_heart_rate: null,
    average_cadence: null,
    average_power_watts: null,
    max_power_watts: null,
    aerobic_training_effect: null,
    anaerobic_training_effect: null,
    calories: null,
    workout_rpe: null,
    workout_feel: null,
    detail_imported_at: null,
  });
}

function track(values: Record<string, unknown> = {}) {
  const parsed = parseTrack(row(values));
  if (!parsed) throw new Error("Expected fixture track");
  return parsed;
}

describe("normalized activity tracks", () => {
  it("reads the latitude/longitude contract and preserves aligned samples", () => {
    const parsed = track();
    expect(parsed.route?.[0]).toEqual([48.82, 2.41]);
    expect(parsed.length).toBe(3);
    const view = buildRouteView(parsed, { zones, bands: [] });
    expect(view?.distanceKm).toBe(2);
    expect(view?.km).toEqual([0, 1, 2]);
    expect(view?.pace).toEqual([333, null, 250]);
    expect(view?.zone).toEqual([2, 4, 5]);
    expect(view?.elevationRange).toEqual({ min: 20, max: 30 });
  });

  it("keeps samples-only activities without inventing GPS", () => {
    const parsed = track({ route: null, bounds: null });
    expect(buildRouteView(parsed, { zones, bands: [] })).toBeNull();
    expect(
      buildChartsView(parsed, { zones, bands: [] })?.heartRate?.peak?.value,
    ).toBe(170);
  });

  it("returns safe unavailable states for missing or malformed rows", () => {
    expect(parseTrack(null)).toBeNull();
    expect(parseTrack(row({ status: "unavailable" }))).toBeNull();
    expect(parseTrack(row({ route: null, series: null }))).toBeNull();
    expect(
      parseTrack(
        row({
          route: [
            [100, 200],
            [101, 201],
          ],
          series: null,
        }),
      ),
    ).toBeNull();
  });

  it("does not turn pauses or missing speeds into pace", () => {
    expect(paceFromSpeed(null)).toBeNull();
    expect(paceFromSpeed(0)).toBeNull();
    expect(paceFromSpeed(0.5)).toBeNull();
    expect(paceFromSpeed(4)).toBe(250);
  });

  it("measures zone time from full-resolution histogram instead of reduced charts", () => {
    expect(timeInZones(track().histogram, zones)).toEqual([
      { zone: 5, seconds: 20 },
      { zone: 4, seconds: 40 },
      { zone: 3, seconds: 0 },
      { zone: 2, seconds: 30 },
      { zone: 1, seconds: 10 },
    ]);
    expect(timeInZones(track().histogram, null)).toBeNull();
    expect(timeInZones([], zones)).toBeNull();
  });

  it("leaves zone assignments absent when calibration is missing", () => {
    const view = buildRouteView(track(), { zones: null, bands: [] });
    expect(view?.zone).toEqual([null, null, null]);
    expect(view?.heartRate).toEqual([130, 155, 170]);
  });

  it("keeps repeated GPS vertices from producing duplicate gradient stops", () => {
    const parsed = track({
      route: [
        [48.82, 2.41],
        [48.82, 2.41],
        [48.83, 2.42],
      ],
    });
    const view = buildRouteView(parsed, { zones, bands: [] });
    expect(view).not.toBeNull();
    const stops = gradientStops(view!, "zones");
    expect(
      stops.every(
        ([fraction], index) => index === 0 || fraction > stops[index - 1][0],
      ),
    ).toBe(true);
    expect(JSON.stringify(lineGradient(view!, "pace"))).not.toContain("null");
    expect(
      routeFractions([
        [48, 2],
        [48, 2],
      ]).meters,
    ).toBe(0);
  });

  it("starts a new chart path after missing samples instead of bridging the gap", () => {
    const chart = buildChartsView(track(), { zones, bands: [] });
    expect(chart?.pace?.path.match(/M/g)).toHaveLength(2);
    expect(chart?.heartRate?.peak?.value).toBe(170);
  });

  it("never displays running pace for cycling tracks", () => {
    const view = buildActivityView({
      activity: activity("cycling"),
      segments: [],
      track: track(),
      zones,
    });
    expect(view.charts?.pace).toBeNull();
    expect(view.charts?.scatter).toBeNull();
    expect(view.route?.pace.every((value) => value === null)).toBe(true);
    expect(view.charts?.heartRate).not.toBeNull();
  });

  it("keeps existing detail working without a track", () => {
    expect(
      buildActivityView({
        activity: activity(),
        segments: [],
        track: null,
        zones,
      }),
    ).toEqual({ route: null, charts: null, zoneTime: null });
  });

  it("prefers normalized provider names and retains legacy title fallbacks", () => {
    expect(activityTitle(activity())).toBe("Evening run");
    const legacy = activityRowSchema.parse({
      id: "a",
      activity_type: "running",
      route_name: null,
      started_at: "2026-10-10T18:00:00Z",
      local_started_at: null,
      distance_meters: null,
      duration_seconds: null,
      elevation_gain_meters: null,
      average_heart_rate: null,
    });
    expect(activityTitle(legacy)).toBe("Course à pied");
  });
});

describe("chart and map regressions", () => {
  it("produces valid MapLibre gradients for constant zones and missing HR", () => {
    for (const heartRates of [
      [130, 130, 130],
      [null, null, null],
    ]) {
      const parsed = track({
        series: { elapsed_s: [0, 1, 2], heart_rate: heartRates },
      });
      const view = buildRouteView(parsed, { zones, bands: [] });
      expect(
        createExpression(
          lineGradient(view!, "zones"),
          "line-gradient",
          latest.paint_line["line-gradient"] as StylePropertySpecification,
        ).result,
      ).toBe("success");
    }
  });

  it("labels incomplete elapsed time as samples without inventing timestamps", () => {
    const parsed = track({
      route: null,
      series: {
        elapsed_s: [0, null, 20, 100],
        heart_rate: [110, 120, 130, 140],
      },
    });
    const view = buildChartsView(parsed, {
      zones,
      bands: [{ from: 0.2, to: 0.5, label: "T1" }],
    });
    expect(view?.timeLabels.join(" ")).not.toContain("0:00");
    expect(view?.bands).toEqual([]);
    const xs = Array.from(
      view!.heartRate!.path.matchAll(/[ML]([\d.]+),/g),
      (match) => Number(match[1]),
    );
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const absent = buildChartsView(
      track({ series: { heart_rate: [110, 120, 130] } }),
      { zones, bands: [] },
    );
    expect(absent?.timeLabels.join(" ")).not.toContain("0:00");
  });
});

describe("chart sample inspection", () => {
  it("aligns recorded values, plotted points and actual elapsed times for every unit", () => {
    const view = buildChartsView(
      track({
        route: null,
        series: {
          elapsed_s: [10, 20, 60],
          speed_mps: [4, null, 3],
          heart_rate: [130, null, 170],
          cadence: [168, null, 172.5],
          elevation_m: [20, null, 25.75],
        },
      }),
      { zones, bands: [] },
    );
    expect(view?.pace?.samples[0]).toMatchObject({
      value: "4:10 min/km",
      position: "Temps écoulé · 0:10",
      x: 150,
    });
    expect(view?.heartRate?.samples[2].value).toBe("170 bpm");
    expect(view?.cadence?.samples[2].value).toBe("172,5 pas/min");
    expect(view?.elevation?.samples[2].value).toBe("25,75 m");
    for (const chart of [
      view?.pace,
      view?.heartRate,
      view?.cadence,
      view?.elevation,
    ]) {
      expect(chart?.samples).toHaveLength(3);
      expect(chart?.samples[1]).toEqual({
        x: 300,
        y: null,
        value: null,
        position: "Temps écoulé · 0:20",
      });
      expect(chart?.samples[2].y).not.toBeNull();
    }
  });

  it("reports true outlier pace even when its plotted position is trimmed", () => {
    const speeds = Array.from({ length: 100 }, (_, index) =>
      index === 50 ? 1 : 4,
    );
    const view = buildChartsView(
      track({ route: null, series: { speed_mps: speeds } }),
      { zones, bands: [] },
    );
    expect(view?.pace?.samples[50]).toMatchObject({
      value: "16:40 min/km",
      y: 120,
      position: "Échantillon 51 sur 100",
    });
  });

  it.each([
    [0, null, 20],
    [0, 20, 10],
    [0, 0, 0],
    [-1, 10, 20],
  ])(
    "uses sample labels when elapsed times are incomplete or invalid: %j",
    (...elapsed) => {
      const view = buildChartsView(
        track({
          route: null,
          series: { elapsed_s: elapsed, heart_rate: [110, 120, 130] },
        }),
        { zones, bands: [] },
      );
      expect(view?.heartRate?.samples.map((sample) => sample.position)).toEqual(
        ["Échantillon 1 sur 3", "Échantillon 2 sur 3", "Échantillon 3 sur 3"],
      );
    },
  );
});

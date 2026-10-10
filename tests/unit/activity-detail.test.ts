import { describe, expect, it } from "vitest";
import {
  activityDetailRowSchema,
  effortStats,
  lapTable,
  segmentRowSchema,
} from "../../src/features/activities/detail";
import { formatLocalDate } from "../../src/features/app-shell/shell";

function activity(values: Record<string, unknown> = {}) {
  return activityDetailRowSchema.parse({
    id: "4f1c2a8e-0a8b-4d39-9f43-6b1a5d0c7e21",
    activity_type: "running",
    route_name: null,
    started_at: "2026-10-06T05:12:00Z",
    local_started_at: "2026-10-06T07:12:00",
    distance_meters: 11300,
    duration_seconds: 3520,
    elevation_gain_meters: 64,
    elevation_loss_meters: 58,
    average_heart_rate: 152,
    max_heart_rate: 176,
    average_cadence: 168.4,
    average_power_watts: null,
    max_power_watts: 0,
    aerobic_training_effect: 3.4,
    anaerobic_training_effect: "1.8",
    detail_imported_at: "2026-10-07T04:12:00Z",
    ...values,
  });
}

function segment(values: Record<string, unknown> = {}) {
  return segmentRowSchema.parse({
    segment_type: "lap",
    segment_index: 0,
    distance_meters: 2270,
    duration_seconds: 600,
    average_heart_rate: 161,
    average_cadence: 182,
    average_power_watts: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    ...values,
  });
}

describe("activity detail rows", () => {
  it("reads the athlete-local start time and drops zero or missing measures", () => {
    const row = activity();
    expect(row.date).toBe("2026-10-06");
    expect(row.localTime).toBe("07:12");
    expect(row.maxPowerWatts).toBeNull();
    expect(row.anaerobicTrainingEffect).toBe(1.8);
    expect(activity({ local_started_at: null }).localTime).toBeNull();
  });
});

describe("lap table", () => {
  it("derives pace per lap and keeps lap order", () => {
    const table = lapTable(activity(), [
      segment({
        segment_index: 1,
        distance_meters: 320,
        duration_seconds: 120,
      }),
      segment({ segment_index: 0 }),
    ]);
    expect(table?.title).toBe("Tours");
    expect(table?.rows.map((row) => row.label)).toEqual(["1", "2"]);
    expect(table?.rows[0].cells).toMatchObject({
      duration: "10:00",
      distance: "2,27",
      pace: "4:24",
      heartRate: "161",
      cadence: "182",
      elevation: null,
    });
    expect(table?.rows[1].cells.pace).toBe("6:15");
  });

  it("only lists columns with at least one stored value", () => {
    const table = lapTable(activity(), [
      segment({ segment_index: 0 }),
      segment({ segment_index: 1 }),
    ]);
    expect(table?.columns.map((column) => column.key)).toEqual([
      "duration",
      "distance",
      "pace",
      "heartRate",
      "cadence",
    ]);
  });

  it("falls back to splits and needs at least two segments", () => {
    const splits = [
      segment({ segment_type: "split", segment_index: 0 }),
      segment({ segment_type: "split", segment_index: 1 }),
    ];
    expect(lapTable(activity(), [segment(), ...splits])?.title).toBe(
      "Segments",
    );
    expect(lapTable(activity(), [segment()])).toBeNull();
    expect(lapTable(activity(), [])).toBeNull();
  });

  it("never derives a pace for non-running sessions", () => {
    const table = lapTable(activity({ activity_type: "cycling" }), [
      segment({ segment_index: 0 }),
      segment({ segment_index: 1 }),
    ]);
    expect(table?.columns.map((column) => column.key)).not.toContain("pace");
  });
});

describe("effort stats", () => {
  it("lists only stored effort measures with French formatting", () => {
    expect(
      effortStats(activity()).map((stat) => [
        stat.label,
        stat.value,
        stat.unit,
      ]),
    ).toEqual([
      ["Effet aérobie", "3,4", undefined],
      ["Effet anaérobie", "1,8", undefined],
      ["Cadence moy.", "168", "pas/min"],
      ["FC max", "176", "bpm"],
      ["D−", "58", "m"],
    ]);
    expect(
      effortStats(
        activity({
          aerobic_training_effect: null,
          anaerobic_training_effect: null,
          average_cadence: null,
          max_heart_rate: null,
          elevation_loss_meters: null,
        }),
      ),
    ).toEqual([]);
  });

  it("formats the import date in Paris time", () => {
    expect(formatLocalDate("2026-10-07T22:30:00Z")).toBe("08/10/2026");
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate("not a date")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  climbingVam,
  improvementHistory,
  recordsModel,
} from "@/features/progress/record-history";
import { recordsView } from "@/features/progress/records-view";
import type { GarminPrediction } from "@/features/progress/garmin-predictions";
import { bestEffortSeconds, fitnessRecords } from "@/features/progress/records";
import type {
  ProgressActivity,
  ProgressHistory,
  ProgressLap,
} from "@/features/progress/history";
const today = "2026-10-12";
const run = (
  id: string,
  day: string,
  values: Partial<ProgressActivity> = {},
): ProgressActivity => ({
  id,
  day,
  name: id,
  type: "running",
  distance: 10000,
  duration: 2700,
  gain: 0,
  ...values,
});
const lap = (
  index: number,
  values: Partial<ProgressLap> = {},
): ProgressLap => ({
  activityId: "a",
  index,
  distance: 1000,
  duration: 250,
  heartRate: null,
  gain: null,
  loss: null,
  ...values,
});
const history = (activities: ProgressActivity[] = []): ProgressHistory => ({
  activities,
  laps: [],
  races: [],
  vo2: [],
  load: [],
});
const climb = (grade = 0.14) => ({
  elapsed_s: [0, 240, 480, 720, 960, 1200, 1440],
  distance_m: [0, 400, 800, 1200, 1600, 2000, 2400],
  elevation_m: Array.from({ length: 7 }, (_, i) => 100 + i * 400 * grade),
});

describe("record evidence", () => {
  it("does not bridge missing or invalid laps and rejects malformed activity values", () => {
    expect(bestEffortSeconds([lap(0), lap(2)], 2000, null, null)).toBeNull();
    expect(
      bestEffortSeconds([lap(0), lap(1, { duration: -10 })], 2000, null, null),
    ).toBeNull();
    expect(bestEffortSeconds([], 1000, 1000, -1)).toBeNull();
    expect(bestEffortSeconds([], 1000, 1051, 300)).toBeNull();
    expect(bestEffortSeconds([lap(0), lap(1)], 2000, null, null)).toBe(500);
  });
  it("keeps six distances and separates road from trail, treadmill and future activities", () => {
    const model = recordsModel(
      history([
        run("a", "2026-01-01"),
        run("trail", "2026-02-01", { type: "trail_running", duration: 1000 }),
        run("treadmill", "2026-03-01", {
          type: "treadmill_running",
          duration: 1000,
        }),
        run("future", "2027-01-01", { duration: 1000 }),
      ]),
      [],
      today,
    );
    expect(model.road).toHaveLength(6);
    expect(model.road.find((r) => r.key === "10k")?.current?.activityId).toBe(
      "a",
    );
    expect(model.activities).toHaveLength(3);
  });
  it("retains the earliest deterministic tie and strict improvement history", () => {
    const model = recordsModel(
      history([
        run("z", "2026-01-01"),
        run("a", "2026-01-01"),
        run("tie", "2026-02-01"),
        run("better", "2026-03-01", { duration: 2600 }),
      ]),
      [],
      today,
    );
    const road = model.road.find((r) => r.key === "10k")!;
    expect(road.history.map((p) => p.activityId)).toEqual(["a", "better"]);
  });
  it("keeps Forme records available", () => {
    expect(fitnessRecords([run("a", "2026-01-01")], []).efforts[0].key).toBe(
      "10k",
    );
  });
  it("uses Monday weeks across years and excludes future summaries", () => {
    const model = recordsModel(
      history([
        run("a", "2025-12-31", { gain: 200 }),
        run("b", "2026-01-04", { gain: 300 }),
        run("c", "2026-01-05", { gain: null }),
        run("future", "2027-01-01", { gain: 99999 }),
      ]),
      [],
      today,
    );
    expect(
      model.endurance.find((r) => r.key === "weeklyGain")?.current,
    ).toMatchObject({ day: "2025-12-29", value: 500 });
    expect(
      model.endurance.find((r) => r.key === "weeklyDistance")?.current?.value,
    ).toBe(20000);
    expect(model.busiestWeek).toMatchObject({
      start: "2025-12-29",
      meters: 20000,
      gain: 500,
    });
  });
  it("omits incomplete weekly gain while retaining complete distance and observed zero gain", () => {
    const input = history([
      run("a", "2026-01-01", { gain: 200 }),
      run("b", "2026-01-02", { gain: null }),
    ]);
    const model = recordsModel(input, [], today);
    expect(
      model.endurance.find((r) => r.key === "weeklyGain")?.current,
    ).toBeNull();
    expect(
      model.endurance.find((r) => r.key === "weeklyDistance")?.current?.value,
    ).toBe(20000);
    input.activities.forEach((a) => {
      a.gain = 0;
    });
    expect(
      recordsModel(input, [], today).endurance.find(
        (r) => r.key === "weeklyGain",
      )?.current?.value,
    ).toBe(0);
  });
  it("omits incomplete weekly distance independently of complete gain", () => {
    const model = recordsModel(
      history([
        run("a", "2026-01-01", { gain: 200 }),
        run("b", "2026-01-02", { gain: 300, distance: null }),
      ]),
      [],
      today,
    );
    expect(
      model.endurance.find((r) => r.key === "weeklyDistance")?.current,
    ).toBeNull();
    expect(
      model.endurance.find((r) => r.key === "weeklyGain")?.current?.value,
    ).toBe(500);
  });
  it("distinguishes missing elevation from observed zero", () => {
    const missing = recordsModel(
      history([run("a", "2026-01-01", { gain: null })]),
      [],
      today,
    );
    expect(missing.endurance.find((r) => r.key === "gain")?.current).toBeNull();
    const zero = recordsModel(history([run("a", "2026-01-01")]), [], today);
    expect(zero.endurance.find((r) => r.key === "gain")?.current?.value).toBe(
      0,
    );
    expect(
      improvementHistory([
        { day: "2026-01-01", value: 0, activityId: "a", name: "a" },
      ]),
    ).toEqual([]);
  });
});
describe("sampled climbing", () => {
  it("estimates 20 minute VAM with exact interpolated endpoints", () => {
    expect(climbingVam(climb())).toBeCloseTo(840);
    const series = {
      elapsed_s: [0, 250, 500, 750, 1000, 1250],
      distance_m: [0, 400, 800, 1200, 1600, 2000],
      elevation_m: [0, 56, 112, 168, 224, 280],
    };
    expect(climbingVam(series)).toBeCloseTo(806.4);
  });
  it("finds an optimum inside a sampling interval at the grade boundary", () => {
    expect(
      climbingVam({
        elapsed_s: [0, 300, 600, 900, 1200, 1500],
        distance_m: [0, 500, 1000, 1500, 2000, 2500],
        elevation_m: [0, 0, 60, 140, 220, 340],
      }),
    ).toBeCloseTo(960);
  });
  it("rejects gaps, downhill, grade outside bounds, missing and malformed arrays", () => {
    expect(
      climbingVam({
        ...climb(),
        elapsed_s: [0, 301, 602, 903, 1204, 1505, 1806],
      }),
    ).toBeNull();
    expect(
      climbingVam({
        ...climb(),
        elevation_m: [100, 160, 150, 210, 250, 310, 350],
      }),
    ).toBeNull();
    expect(climbingVam(climb(0.11))).toBeNull();
    expect(climbingVam(climb(0.17))).toBeNull();
    expect(climbingVam({ ...climb(), distance_m: [0, 400] })).toBeNull();
    expect(
      climbingVam({
        ...climb(),
        elapsed_s: [0, 240, 240, 720, 960, 1200, 1440],
      }),
    ).toBeNull();
    expect(
      climbingVam({
        ...climb(),
        elevation_m: [0, 56, null, 168, 224, 280, 336],
      }),
    ).toBeNull();
    expect(climbingVam({})).toBeNull();
  });
});
const prediction = (
  key: GarminPrediction["key"],
  seconds: number,
): GarminPrediction => ({
  key,
  label: key,
  meters: 0,
  seconds,
  asOf: today,
  previous: null,
});

describe("records presentation facts", () => {
  it("puts a road record within 3 % of the Garmin prediction in reach", () => {
    const input = history([run("a", "2025-11-09", { name: "10 km de Paris" })]);
    const view = recordsView({
      model: recordsModel(input, [], today),
      predictions: [prediction("10k", 2721), prediction("half_marathon", 6000)],
      vo2: [],
      threshold: null,
      today,
    });
    expect(view.headline).toBe("Ton 10K est à portée.");
    expect(view.paragraph).toBe(
      "Garmin te prédit 45:21 sur 10K, à 21 secondes de ton record de novembre. Une course test bien placée te dira si tu peux le battre.",
    );
    expect(view.reach).toMatchObject({
      record: "45:00",
      prediction: "45:21",
      gap: "écart 0:21",
      tone: "warning",
    });
    expect(view.reach?.coachHref).toMatch(/^\/coach\/nouvelle\?texte=/);
    expect(view.speed.map((row) => [row.label, row.value, row.side])).toEqual([
      ["5K", null, null],
      ["10K", "45:00", "prévision 45:21"],
      ["Semi-marathon", null, "prévision 1:40:00"],
      ["Marathon", null, null],
    ]);
    expect(view.speed[1].detail).toBe("10 km de Paris · nov. 2025");
    expect(view.speed[3].detail).toBe("jamais couru");
  });

  it("marks a recent improvement as new", () => {
    const input = history([
      run("old", "2026-03-01"),
      run("new", "2026-10-01", { duration: 2600 }),
    ]);
    const view = recordsView({
      model: recordsModel(input, [], today),
      predictions: [],
      vo2: [],
      threshold: null,
      today,
    });
    expect(view.speed[1]).toMatchObject({
      value: "43:20",
      side: "−1:40 · nouveau",
      tone: "success",
      href: "/activities/new",
    });
  });

  it("lists the four endurance records with the busiest week", () => {
    const input = history([
      run("long", "2026-09-06", {
        type: "trail_running",
        distance: 80_000,
        gain: 6100,
        name: "CCC",
      }),
      run("short", "2026-09-05", { distance: 12_000, gain: 400 }),
    ]);
    const view = recordsView({
      model: recordsModel(
        input,
        [{ activityId: "long", series: climb() }],
        today,
      ),
      predictions: [],
      vo2: [],
      threshold: null,
      today,
    });
    expect(view.endurance.map((row) => [row.label, row.value])).toEqual([
      ["Plus longue sortie", "80 km"],
      ["D+ sur une sortie", "6\u202f100 m"],
      ["VAM sur 20 min", "840 m/h"],
      ["Semaine la plus chargée", "92 km"],
    ]);
    expect(view.endurance[3].detail).toBe("6\u202f500 m D+ · août 2026");
  });

  it("reads markers from Garmin, the profile override and VO2 history", () => {
    const view = recordsView({
      model: recordsModel(history(), [], today),
      predictions: [],
      vo2: [
        { day: "2026-06-01", value: 51 },
        { day: "2026-10-10", value: 52 },
      ],
      threshold: { speedMps: 1000 / 278, heartRateBpm: 171, override: 168 },
      today,
    });
    expect(
      view.markers.map((marker) => [marker.label, marker.value, marker.detail]),
    ).toEqual([
      ["Allure seuil", "4:38", "Garmin"],
      ["FC seuil", "168", "Ta valeur"],
      ["VO₂ max", "52", "+1 en 3 mois"],
      ["VAM · 20 min", null, "Pas encore de montée mesurée"],
    ]);
  });

  it("provides empty states", () => {
    const view = recordsView({
      model: recordsModel(history(), [], today),
      predictions: [],
      vo2: [],
      threshold: null,
      today,
    });
    expect(view.headline).toBe("Tes records attendent ton historique.");
    expect(view.empty).toBe(true);
    expect(view.reach).toBeNull();
    expect(view.endurance).toEqual([]);
  });
});

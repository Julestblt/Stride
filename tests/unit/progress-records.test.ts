import { describe, expect, it } from "vitest";
import {
  climbingVam,
  improvementHistory,
  recordsModel,
} from "@/features/progress/record-history";
import {
  recordsView,
  parseRecordFilter,
  recordCount,
} from "@/features/progress/records-view";
import { formatClock } from "@/features/progress/format";
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
    const view = recordsView(model, history(), today, "road");
    expect(view.improvements.map((p) => p.activityId)).toEqual(["better"]);
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
describe("records presentation facts", () => {
  it("requires recent VO2 and exposes signed gaps without Garmin record attribution", () => {
    const input = history([run("a", "2026-01-01")]);
    input.vo2 = [{ day: "2026-09-12", value: 55 }];
    const model = recordsModel(input, [], today);
    expect(
      recordsView(model, input, today, "all").predictions.find(
        (p) => p.key === "10k",
      )?.gap,
    ).toBeLessThan(0);
    input.vo2[0].day = "2026-09-11";
    expect(recordsView(model, input, today, "all").predictions).toEqual([]);
  });
  it("describes an empty selected category while other records remain available", () => {
    const enduranceOnly = history([
      run("trail", "2026-01-01", { type: "trail_running" }),
    ]);
    const roadReading = recordsView(
      recordsModel(enduranceOnly, [], today),
      enduranceOnly,
      today,
      "road",
    );
    expect(roadReading.events).toEqual([]);
    expect(roadReading.headline).toBe(
      "Aucun record sur route n’est encore documenté.",
    );
    expect(roadReading.paragraph).toContain("sur route ou piste");
    expect(roadReading.paragraph).not.toContain("Aucune activité importée");
    const roadOnly = history([
      run("a", "2026-01-01", { distance: null, duration: null, gain: null }),
    ]);
    roadOnly.laps = [lap(0)];
    const enduranceReading = recordsView(
      recordsModel(roadOnly, [], today),
      roadOnly,
      today,
      "trail",
    );
    expect(enduranceReading.events).toEqual([]);
    expect(enduranceReading.headline).toBe(
      "Aucun record d’endurance n’est encore documenté.",
    );
    expect(enduranceReading.paragraph).toContain("filtre Route");
    const roadView = recordsView(
      recordsModel(roadOnly, [], today),
      roadOnly,
      today,
      "road",
    );
    expect(roadView.paragraph).toContain("1 distance sur route");
    expect(roadView.takeaways[1].text).toContain("1 distance documentée");
    expect(recordCount(1, "repère")).toBe("1 repère");
    expect(recordCount(2, "repère")).toBe("2 repères");
  });
  it("predicts and compares 5 km goals while excluding past goals and retaining forecast confidence", () => {
    const input = history([
      run("a", "2026-01-01", { distance: 5000, duration: 1500 }),
    ]);
    input.vo2 = [{ day: today, value: 55 }];
    input.races = [
      {
        id: "past",
        name: "Course passée",
        day: "2026-10-11",
        kind: "road",
        distanceKm: 5,
        priority: "A",
      },
      {
        id: "today",
        name: "5 km aujourd’hui",
        day: today,
        kind: "road",
        distanceKm: 5,
        priority: "A",
      },
      {
        id: "future",
        name: "Marathon à venir",
        day: "2026-11-01",
        kind: "road",
        distanceKm: 42.2,
        priority: "A",
      },
    ];
    const view = recordsView(
      recordsModel(input, [], today),
      input,
      today,
      "all",
    );
    expect(view.opportunities.map((o) => o.race.id)).toEqual([
      "today",
      "future",
    ]);
    const five = view.predictions.find((p) => p.key === "5k")!;
    expect(five.gap).toBeLessThan(0);
    expect(view.opportunities[0].text).toContain(formatClock(five.seconds));
    expect(view.opportunities[0].text).toContain(
      `Écart au record : −${formatClock(Math.abs(five.gap!))}`,
    );
    expect(view.opportunities[0].text).toContain("confiance modérée");
    expect(view.opportunities[1].text).toContain("confiance faible");
  });
  it("provides empty states and validates URL filters", () => {
    const input = history(),
      model = recordsModel(input, [], today);
    expect(recordsView(model, input, today, "all").headline).toBe(
      "Tes records attendent ton historique.",
    );
    expect(parseRecordFilter("anything")).toBe("all");
    expect(parseRecordFilter(["trail"])).toBe("trail");
  });
});

import { describe, expect, it } from "vitest";
import { buildCourse, type RawPoint } from "@/features/races/course";
import { gradesOf, walkPortions } from "@/features/races/grade";
import { nightPlan } from "@/features/races/night";
import {
  describeItems,
  nutritionSegment,
  segmentItems,
} from "@/features/races/nutrition";
import {
  simulate,
  distanceAtElapsed,
  elapsedAt,
  stopTotalSeconds,
  targetPace,
} from "@/features/races/simulation";
import { localMinutes, sunTimes, zonedEpoch } from "@/features/races/sun";
import {
  cutoffElapsedMinutes,
  waypointMarks,
  defaultWatchLabel,
  type Waypoint,
} from "@/features/races/waypoints";
import {
  formatClock,
  formatDuration,
  formatKm,
  formatMargin,
  formatPace,
  parseClock,
  parseHoursMinutes,
} from "@/features/races/format";
import {
  slotTimes,
  summarizeNormals,
  summarizeForecast,
  type WeatherSlot,
} from "@/features/races/weather";
import {
  defaultPlan,
  type RaceSummary,
  type StoredCourse,
} from "@/features/races/race";
import { courseModel, planModel } from "@/features/races/workspace";
import { roadReading } from "@/features/races/reading";
import { checklistTemplateFor } from "@/features/races/checklists";

const metersPerDegree = 111_195;

function rolling(lengthM: number): RawPoint[] {
  return Array.from({ length: lengthM / 10 + 1 }, (_, index) => ({
    lat: 48.8 + (index * 10) / metersPerDegree,
    lon: 2.3,
    ele: 100 + 40 * Math.sin((index * 10) / 800),
  }));
}

function waypoint(
  id: string,
  kind: Waypoint["kind"],
  distanceM: number,
  cutoff: number | null = null,
): Waypoint {
  return {
    id,
    kind,
    name: id,
    distanceM,
    cutoffMinutes: cutoff,
    services: [],
    watchLabel: null,
    alertDistanceM: 500,
    voiceNote: null,
    todo: null,
    nutritionNote: null,
    source: "athlete",
    needsReview: false,
    revision: 1,
  };
}

describe("race simulation", () => {
  const course = buildCourse(rolling(40_000))!;
  const grades = gradesOf(course);
  const portions = walkPortions(course, 10, grades);
  const waypoints = [
    waypoint("start", "start", 0),
    waypoint("r1", "aid", 15_000, 9 * 60),
    waypoint("e2", "water", 25_000),
    waypoint("finish", "finish", course.distanceM, 13 * 60),
  ];
  const settings = {
    targetSeconds: 4 * 3600,
    walkPaceSecondsPerKm: 690,
    aidStopSeconds: 300,
    waterStopSeconds: 120,
    startMinutes: 7 * 60,
  };
  const simulation = simulate(course, grades, portions, waypoints, settings);

  it("hits the target duration including stops", () => {
    expect(simulation.feasible).toBe(true);
    expect(
      Math.abs(simulation.finishSeconds - settings.targetSeconds),
    ).toBeLessThan(2);
    expect(simulation.segments).toHaveLength(3);
    const moving = simulation.segments.reduce(
      (sum, segment) => sum + segment.movingSeconds,
      0,
    );
    expect(Math.round(moving + 420)).toBeCloseTo(settings.targetSeconds, -1);
  });

  it("computes ordered passages, clock times and cutoff margins", () => {
    const [start, r1, e2, finish] = simulation.passages;
    expect(start.elapsedSeconds).toBe(0);
    expect(r1.elapsedSeconds).toBeLessThan(e2.elapsedSeconds);
    expect(e2.elapsedSeconds - r1.elapsedSeconds).toBeGreaterThan(300);
    expect(r1.cutoffSeconds).toBe(2 * 3600);
    expect(r1.marginSeconds).toBe(2 * 3600 - r1.elapsedSeconds);
    expect(finish.marginSeconds).toBe(6 * 3600 - finish.elapsedSeconds);
    expect(finish.clockMinutes).toBeCloseTo(7 * 60 + 240, 0);
  });

  it("slows down with fatigue and maps time back to distance", () => {
    expect(simulation.fade).toBeGreaterThan(0);
    const half = distanceAtElapsed(course, simulation, 7200);
    expect(elapsedAt(course, simulation, half)).toBeCloseTo(7200, -1);
    expect(half).toBeGreaterThan(course.distanceM / 2);
  });

  it("flags impossible targets", () => {
    const fast = simulate(course, grades, portions, waypoints, {
      ...settings,
      targetSeconds: 1800,
    });
    expect(fast.feasible).toBe(false);
  });
});

describe("target pace", () => {
  const stops = { aidStopSeconds: 300, waterStopSeconds: 120 };
  const stations = [
    waypoint("start", "start", 0),
    ...Array.from({ length: 8 }, (_, index) =>
      waypoint(`r${index + 1}`, "aid", (index + 1) * 12_000),
    ),
    waypoint("e1", "water", 102_000),
    waypoint("v", "caution", 110_000),
    waypoint("finish", "finish", 120_700),
  ];

  it("counts station stops strictly inside the course", () => {
    expect(stopTotalSeconds(stations, 120_700, stops)).toBe(8 * 300 + 120);
    expect(stopTotalSeconds(stations, 50_000, stops)).toBe(4 * 300);
    expect(stopTotalSeconds([], 120_700, stops)).toBe(0);
  });

  it("gives the target pace and the pace excluding stops", () => {
    const pace = targetPace({
      targetSeconds: 18.5 * 3600,
      distanceM: 120_700,
      stopSeconds: stopTotalSeconds(stations, 120_700, stops),
    })!;
    expect(formatPace(pace.overall)).toBe("9:12");
    expect(formatPace(pace.moving!)).toBe("8:51");
  });

  it("keeps the overall pace without stops", () => {
    const pace = targetPace({
      targetSeconds: 39 * 60,
      distanceM: 10_000,
      stopSeconds: 0,
    })!;
    expect(formatPace(pace.overall)).toBe("3:54");
    expect(pace.moving).toBe(pace.overall);
  });

  it("returns nothing without a target or a distance", () => {
    expect(
      targetPace({ targetSeconds: null, distanceM: 10_000, stopSeconds: 0 }),
    ).toBeNull();
    expect(
      targetPace({ targetSeconds: 2400, distanceM: null, stopSeconds: 0 }),
    ).toBeNull();
  });
});

describe("road race simulation", () => {
  it("uses the target time as running time without trail stops or walking", () => {
    const course = buildCourse(rolling(10_000))!;
    const stored: StoredCourse = {
      ...course,
      source: "gpx",
      fileName: "10k.gpx",
      sourceActivityId: null,
      timeZone: "Europe/Paris",
      importedAt: "2026-10-11T00:00:00Z",
    };
    const race: RaceSummary = {
      id: "race",
      name: "10 km",
      kind: "road",
      date: null,
      distanceKm: 10,
      elevationGainM: null,
      priority: "B",
      targetSeconds: 39 * 60,
      revision: 1,
    };
    const model = courseModel(
      stored,
      [waypoint("aid", "aid", 5_000)],
      defaultPlan,
      race.kind,
    );
    const planned = planModel({
      model,
      race,
      plan: defaultPlan,
      scenario: { key: "target", label: "objectif", seconds: 39 * 60 },
      timeZone: stored.timeZone,
    });
    expect(model.waypoints.map((point) => point.kind)).toEqual([
      "start",
      "finish",
    ]);
    expect(model.portions).toEqual([]);
    expect(planned.simulation.stops).toEqual([]);
    expect(planned.simulation.finishSeconds).toBe(39 * 60);
    expect(planned.simulation.segments).toHaveLength(1);
    expect(planned.simulation.segments[0].paceSecondsPerKm).toBeCloseTo(
      (39 * 60) / 10,
      0,
    );
    const reading = roadReading({ model, planned, weather: null, date: null });
    expect(reading.body).toContain("3:54 /km");
    expect(reading.body).not.toMatch(/frontale|marche|ravito/i);
  });

  it("uses road preparation tasks without trail equipment templates", () => {
    expect(
      checklistTemplateFor("road", "prep_eve")?.map((item) => item.label),
    ).toContain("Préparer dossard, épingles, tenue et chaussures");
    expect(checklistTemplateFor("road", "gear_night")).toBeUndefined();
    expect(checklistTemplateFor("trail", "gear_night")?.length).toBeGreaterThan(
      0,
    );
  });
});

describe("waypoints", () => {
  it("numbers stations and builds watch labels", () => {
    const list = [
      waypoint("d", "start", 0),
      waypoint("1", "aid", 1),
      waypoint("2", "water", 2),
      waypoint("v", "caution", 3),
      waypoint("3", "aid", 4, 13 * 60 + 30),
      waypoint("a", "finish", 5),
    ];
    const marks = waypointMarks(list);
    expect(
      marks.map((mark) => ("label" in mark ? mark.label : mark.shape)),
    ).toEqual(["D", "1", "2", "diamond", "3", "A"]);
    expect(defaultWatchLabel(list[4], marks[4])).toBe("R3 · BH 13H30");
  });

  it("rolls cutoffs past midnight in course order", () => {
    expect(
      cutoffElapsedMinutes(
        [
          { cutoffMinutes: 13 * 60 },
          { cutoffMinutes: null },
          { cutoffMinutes: 22 * 60 },
          { cutoffMinutes: 105 },
          { cutoffMinutes: 195 },
        ],
        360,
      ),
    ).toEqual([420, null, 960, 1185, 1275]);
  });
});

describe("sun and night", () => {
  it("matches Paris sunrise and sunset on 20 March 2027", () => {
    const { sunrise, sunset } = sunTimes("2027-03-20", 48.8566, 2.3522);
    expect(localMinutes(sunrise!, "Europe/Paris")).toBeGreaterThanOrEqual(
      6 * 60 + 50,
    );
    expect(localMinutes(sunrise!, "Europe/Paris")).toBeLessThanOrEqual(
      6 * 60 + 58,
    );
    expect(localMinutes(sunset!, "Europe/Paris")).toBeGreaterThanOrEqual(
      19 * 60,
    );
    expect(localMinutes(sunset!, "Europe/Paris")).toBeLessThanOrEqual(
      19 * 60 + 8,
    );
  });

  it("converts local clock times across daylight saving changes", () => {
    expect(
      new Date(zonedEpoch("2027-03-20", 360, "Europe/Paris")).toISOString(),
    ).toBe("2027-03-20T05:00:00.000Z");
    expect(
      new Date(zonedEpoch("2027-07-01", 360, "Europe/Paris")).toISOString(),
    ).toBe("2027-07-01T04:00:00.000Z");
  });

  it("sums the dark hours of a long race", () => {
    const plan = nightPlan({
      date: "2027-03-20",
      startMinutes: 360,
      durationSeconds: 18.5 * 3600,
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris",
    });
    expect(plan.windows).toHaveLength(2);
    expect(plan.windows[0].fromSeconds).toBe(0);
    expect(plan.totalSeconds / 60).toBeGreaterThan(6 * 60 + 10);
    expect(plan.totalSeconds / 60).toBeLessThan(6 * 60 + 30);
  });
});

describe("nutrition", () => {
  it("splits carbohydrates into products", () => {
    expect(describeItems(segmentItems(120, 2, false, true))).toBe(
      "3 gels · 2 compotes · 1 barre",
    );
    expect(describeItems(segmentItems(160, 2.7, true, true))).toBe(
      "3 gels · 3 compotes · 1 barre · 1 gel caféiné",
    );
    expect(segmentItems(25, 0.4, false, true)).toEqual({
      gels: 1,
      compotes: 0,
      bars: 0,
      caffeineGels: 0,
    });
  });

  it("scales carbohydrates and water with time", () => {
    expect(
      nutritionSegment(7200, 0, {
        carbsPerHourG: 60,
        waterMlPerHour: 450,
        sodiumMgPerHour: 500,
        alarmMinutes: 20,
        nightCaffeine: true,
      }),
    ).toMatchObject({ carbsG: 120, waterL: 0.9 });
  });
});

describe("formatting", () => {
  it("formats French race values", () => {
    expect(formatKm(120_700)).toBe("120,7");
    expect(formatClock(24 * 60 + 30)).toBe("00:30");
    expect(formatDuration(18.5 * 3600)).toBe("18h30");
    expect(formatDuration(52 * 60)).toBe("52 min");
    expect(formatMargin(2 * 3600 + 300)).toBe("+2:05");
    expect(parseClock("6h05")).toBe(365);
    expect(parseClock("24:00")).toBeNull();
    expect(parseHoursMinutes("18h30")).toBe(66_600);
    expect(parseHoursMinutes("20h")).toBe(72_000);
    expect(parseHoursMinutes(formatDuration(39 * 60))).toBe(39 * 60);
  });
});

describe("weather", () => {
  function slot(
    clockMinutes: number,
    temperature: number,
    precipitationProbability: number,
    code: number,
  ): WeatherSlot {
    return {
      elapsedSeconds: 0,
      epochMs: 0,
      clockMinutes,
      distanceM: 0,
      lat: 0,
      lon: 0,
      night: false,
      temperature,
      precipitationProbability,
      code,
      apparentTemperature: temperature - 3,
      windKmh: 18,
      windDirection: 225,
      gustsKmh: 35,
    };
  }

  it("places two-hourly slots along an 18h30 race", () => {
    expect(
      slotTimes(360, 18.5 * 3600).map((seconds) => seconds / 3600),
    ).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });

  it("describes normals and forecasts", () => {
    const calm = [
      slot(360, 4, 10, 3),
      slot(720, 12, 25, 2),
      slot(1080, 10, 25, 3),
    ];
    expect(summarizeNormals(calm, 0.33)).toMatchObject({
      title: "Frais, souvent nuageux",
      detail: "4 → 12 °C · pluie 1 jour sur 3",
    });
    const showers = [
      slot(360, 3, 5, 1),
      slot(840, 13, 60, 80),
      slot(960, 12, 55, 80),
      slot(1440, 5, 5, 0),
    ];
    expect(summarizeForecast(showers)).toEqual({
      title: "Averses l’après-midi",
      detail: "3 → 13 °C · ressenti 0 °C au départ",
      facts: ["60 % à 14h", "18 km/h SO", "rafales 35"],
    });
  });
});

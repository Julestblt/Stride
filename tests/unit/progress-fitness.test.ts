import { describe, expect, it } from "vitest";
import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import { fitnessView } from "@/features/progress/fitness";
import {
  loadPoints,
  type ProgressActivity,
  type ProgressLap,
  type ProgressRace,
} from "@/features/progress/history";
import { buildLoadChart } from "@/features/progress/load";
import {
  cardiacDrift,
  fitnessMeasures,
  isClimbLap,
  isFlatLap,
} from "@/features/progress/measures";
import { addDays, parsePeriod, weekStart } from "@/features/progress/period";
import { predictSeconds } from "@/features/progress/predictions";
import { bestEffortSeconds, fitnessRecords } from "@/features/progress/records";
import {
  coachNote,
  fitnessReading,
  loadAdvice,
  loadNote,
} from "@/features/progress/reading";

const today = "2026-10-12";
const zones: HeartRateZones = {
  method: "karvonen",
  maximum: 190,
  resting: 50,
  restingSamples: 20,
  windowStart: "2026-09-15",
  windowEnd: today,
  zones: [
    { zone: 1, lower: 120, upper: 133 },
    { zone: 2, lower: 134, upper: 147 },
    { zone: 3, lower: 148, upper: 161 },
    { zone: 4, lower: 162, upper: 175 },
    { zone: 5, lower: 176, upper: 190 },
  ],
};

function run(
  id: string,
  day: string,
  values: Partial<ProgressActivity> = {},
): ProgressActivity {
  return {
    id,
    day,
    type: "running",
    name: null,
    distance: 8000,
    duration: 2800,
    gain: 30,
    ...values,
  };
}

function lap(
  activityId: string,
  index: number,
  values: Partial<ProgressLap> = {},
): ProgressLap {
  return {
    activityId,
    index,
    distance: 1000,
    duration: 330,
    heartRate: 145,
    gain: 4,
    loss: 4,
    ...values,
  };
}

function race(values: Partial<ProgressRace> = {}): ProgressRace {
  return {
    id: "race",
    name: "EcoTrail 120K",
    day: "2027-03-20",
    kind: "trail",
    distanceKm: 120,
    priority: "A",
    ...values,
  };
}

describe("progress period", () => {
  it("falls back to six months for unknown values", () => {
    expect(parsePeriod("1y")).toBe("1y");
    expect(parsePeriod(["12w", "6w"])).toBe("12w");
    expect(parsePeriod("forever")).toBe("6m");
    expect(parsePeriod(undefined)).toBe("6m");
  });

  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
  });
});

describe("race predictions", () => {
  it("matches the Daniels–Gilbert reference times", () => {
    expect(predictSeconds(50, 10_000)).toBeCloseTo(41 * 60 + 21, -1.5);
    expect(predictSeconds(50, 42_195)).toBeCloseTo(3 * 3600 + 10 * 60 + 49, -2);
    expect(predictSeconds(0, 10_000)).toBeNull();
  });
});

describe("lap classification", () => {
  it("separates flat and climbing laps", () => {
    expect(isFlatLap(lap("a", 0, { gain: 7, loss: 7 }))).toBe(true);
    expect(isFlatLap(lap("a", 0, { gain: 10, loss: 10 }))).toBe(false);
    expect(isFlatLap(lap("a", 0, { gain: null }))).toBe(false);
    expect(isFlatLap(lap("a", 0, { duration: 700 }))).toBe(false);
    expect(isClimbLap(lap("a", 0, { gain: 80 }))).toBe(true);
    expect(isClimbLap(lap("a", 0, { gain: 151 }))).toBe(false);
    expect(isClimbLap(lap("a", 0, { distance: 150, gain: 15 }))).toBe(false);
  });
});

describe("cardiac drift", () => {
  const steady = (heartRate: (index: number) => number) =>
    Array.from({ length: 18 }, (_, index) =>
      lap("long", index, { duration: 330, heartRate: heartRate(index) }),
    );

  it("is zero when heart rate and pace stay constant", () => {
    expect(cardiacDrift(steady(() => 140))).toBeCloseTo(0);
  });

  it("measures the second-half heart rate rise at equal pace", () => {
    expect(
      cardiacDrift(steady((index) => (index < 9 ? 140 : 154))),
    ).toBeCloseTo(10);
  });

  it("ignores runs shorter than 90 minutes", () => {
    expect(cardiacDrift(steady(() => 140).slice(0, 12))).toBeNull();
  });
});

describe("fitness measures", () => {
  const efficiencyHistory = () => {
    const activities: ProgressActivity[] = [];
    const laps: ProgressLap[] = [];
    for (let week = 0; week < 26; week++) {
      const day = addDays("2026-04-14", week * 7);
      const id = `run-${week}`;
      activities.push(run(id, day));
      for (let index = 0; index < 4; index++)
        laps.push(lap(id, index, { heartRate: 147, duration: 345 - week }));
    }
    activities.push(run("treadmill", today, { type: "treadmill_running" }));
    laps.push(lap("treadmill", 0, { heartRate: 147, duration: 200 }));
    return { activities, laps };
  };

  it("detects faster pace at the reference heart rate", () => {
    const { activities, laps } = efficiencyHistory();
    const measures = fitnessMeasures({
      activities,
      laps,
      vo2: [],
      zones,
      start: "2026-04-14",
      today,
    });
    expect(measures.referenceHeartRate).toBe(145);
    expect(measures.efficiency.trend).toBe("improving");
    expect(measures.efficiency.since).toBe("2026-04-14");
    expect(measures.efficiency.value!).toBeLessThan(
      measures.efficiency.baseline!,
    );
    expect(measures.climbing.value).toBeNull();
  });

  it("keeps the baseline on the first recorded data inside the period", () => {
    const { activities, laps } = efficiencyHistory();
    const measures = fitnessMeasures({
      activities,
      laps,
      vo2: [],
      zones,
      start: "2025-10-13",
      today,
    });
    expect(measures.efficiency.since).toBe("2026-04-14");
    expect(measures.efficiency.trend).toBe("improving");
  });

  it("reports missing data instead of zero", () => {
    const measures = fitnessMeasures({
      activities: [],
      laps: [],
      vo2: [],
      zones: null,
      start: "2026-04-14",
      today,
    });
    expect(measures.efficiency.value).toBeNull();
    expect(measures.threshold.value).toBeNull();
    expect(measures.vo2.value).toBeNull();
    expect(measures.drift.value).toBeNull();
  });

  it("flags rising long-run drift", () => {
    const activities: ProgressActivity[] = [];
    const laps: ProgressLap[] = [];
    [2, 2, 3, 9, 10, 11].forEach((drift, index) => {
      const id = `long-${index}`;
      activities.push(
        run(id, addDays("2026-06-01", index * 14), { duration: 18 * 330 }),
      );
      for (let segment = 0; segment < 18; segment++)
        laps.push(
          lap(id, segment, {
            heartRate: segment < 9 ? 140 : 140 * (1 + drift / 100),
          }),
        );
    });
    const measures = fitnessMeasures({
      activities,
      laps,
      vo2: [],
      zones,
      start: "2026-04-14",
      today,
    });
    expect(measures.drift.value).toBeCloseTo(10);
    expect(measures.drift.trend).toBe("investigate");
    expect(coachNote(measures)).toMatch(/sur 3 de tes 5 dernières sorties/);
  });
});

describe("condition chart", () => {
  const points = Array.from({ length: 60 }, (_, index) => ({
    day: addDays("2026-08-14", index),
    acute: 300 + index,
    chronic: index < 40 ? 200 + index * 5 : 395 - (index - 40) * 2,
  }));

  it("needs at least a week of Garmin loads", () => {
    expect(buildLoadChart(points.slice(0, 6), [], "2026-08-14", today)).toBe(
      null,
    );
  });

  it("measures the gap to the period peak and keeps races in range", () => {
    const chart = buildLoadChart(
      points,
      [race({ day: "2026-09-13", name: "TCO 62K" }), race()],
      "2026-08-14",
      today,
    )!;
    expect(chart.peak.condition).toBe(395);
    expect(chart.current.condition).toBe(357);
    expect(chart.gapToPeak).toBeCloseTo(38 / 395);
    expect(chart.markers).toEqual([{ day: "2026-09-13", name: "TCO 62K" }]);
    expect(loadNote(chart)).toMatch(/^Ta condition est 10 % sous son pic du/);
  });

  it("marks the days when fatigue is above condition", () => {
    const chart = buildLoadChart(
      Array.from({ length: 14 }, (_, index) => ({
        day: addDays("2026-09-29", index),
        acute: index === 3 || index >= 11 ? 500 : 300,
        chronic: 400,
      })),
      [],
      "2026-09-29",
      today,
    )!;
    expect(chart.overload).toEqual([
      { from: "2026-10-02", to: "2026-10-02" },
      { from: "2026-10-10", to: "2026-10-12" },
    ]);
    expect(chart.overloadDays).toBe(3);
    const advice = loadAdvice(chart, {
      currentWeekStart: "2026-10-12",
      currentLight: false,
      nextLightWeekStart: "2026-10-19",
    });
    expect(advice.text).toBe(
      "Fatigue 25 % au-dessus de ta condition depuis 3 jours. Ton plan prévoit une semaine allégée à partir du 19 octobre.",
    );
    expect(advice.actions.map((action) => action.label)).toEqual([
      "Voir la semaine",
      "Alléger ma semaine",
    ]);
    expect(advice.actions[0].href).toBe("/plan?week=2026-10-12");
    expect(advice.actions[1].href).toMatch(
      /^\/coach\/new\?text=Ma\+fatigue/,
    );
    expect(loadAdvice(chart, null).actions).toHaveLength(1);
  });

  it("ignores fatigue above condition when the Garmin load is stale", () => {
    const chart = buildLoadChart(
      Array.from({ length: 10 }, (_, index) => ({
        day: addDays("2026-09-30", index),
        acute: 500,
        chronic: 400,
      })),
      [],
      "2026-09-30",
      today,
    )!;
    expect(chart.overload).toEqual([{ from: "2026-09-30", to: "2026-10-09" }]);
    expect(chart.overloadDays).toBe(0);
    expect(loadAdvice(chart, null)).toEqual({
      text: loadNote(chart),
      actions: [],
    });
  });

  it("keeps the condition note when fatigue stays below condition", () => {
    const chart = buildLoadChart(
      Array.from({ length: 10 }, (_, index) => ({
        day: addDays("2026-10-03", index),
        acute: 300,
        chronic: 400,
      })),
      [],
      "2026-10-03",
      today,
    )!;
    expect(chart.overload).toEqual([]);
    expect(loadAdvice(chart, null)).toEqual({
      text: loadNote(chart),
      actions: [],
    });
  });

  it("pairs acute and chronic loads by day", () => {
    expect(
      loadPoints([
        { metric: "training_load_acute", day: "2026-10-01", value: 400 },
        { metric: "training_load_chronic", day: "2026-10-01", value: 380 },
        { metric: "training_load_acute", day: "2026-10-02", value: 410 },
      ]),
    ).toEqual([{ day: "2026-10-01", acute: 400, chronic: 380 }]);
  });
});

describe("records", () => {
  it("finds the fastest contiguous laps for a distance", () => {
    const laps = Array.from({ length: 12 }, (_, index) =>
      lap("a", index, { duration: index >= 2 ? 270 : 330 }),
    );
    expect(bestEffortSeconds(laps, 10_000, 12_000, 3360)).toBe(2700);
  });

  it("rejects windows that overshoot the distance", () => {
    const laps = [
      lap("a", 0, { distance: 6000 }),
      lap("a", 1, { distance: 6000 }),
    ];
    expect(bestEffortSeconds(laps, 10_000, 12_000, 3600)).toBeNull();
    expect(bestEffortSeconds([], 10_000, 10_200, 2550)).toBeCloseTo(2500);
  });

  it("keeps treadmill runs out of distance records", () => {
    const records = fitnessRecords(
      [
        run("road", "2026-03-01", { distance: 21_100, gain: 120 }),
        run("tread", "2026-03-02", {
          distance: 30_000,
          type: "treadmill_running",
        }),
        run("trail", "2026-03-05", { type: "trail_running", gain: 900 }),
      ],
      [],
    );
    expect(records.longest).toEqual({
      meters: 21_100,
      activityId: "road",
      day: "2026-03-01",
    });
    expect(records.weeklyGain).toEqual({
      meters: 930,
      weekStart: "2026-03-02",
    });
    expect(records.efforts.map((effort) => effort.key)).toEqual(["half"]);
  });
});

describe("fitness reading", () => {
  it("states when history is missing", () => {
    const measures = fitnessMeasures({
      activities: [],
      laps: [],
      vo2: [],
      zones,
      start: "2026-04-14",
      today,
    });
    expect(
      fitnessReading({
        activities: [],
        measures,
        load: null,
        start: "2026-04-14",
        today,
        periodPhrase: "six mois",
      }).headline,
    ).toBe("Pas encore assez d’historique pour lire ta forme.");
  });

  it("leaves the lap-based threshold pace to Records", () => {
    const empty = fitnessMeasures({
      activities: [],
      laps: [],
      vo2: [],
      zones,
      start: "2026-04-14",
      today,
    });
    const reading = fitnessReading({
      activities: [run("a", today)],
      measures: {
        ...empty,
        threshold: {
          ...empty.threshold,
          value: 270,
          baseline: 280,
          trend: "improving",
        },
      },
      load: null,
      start: "2026-04-14",
      today,
      periodPhrase: "six mois",
    });
    expect(reading.headline).not.toMatch(/seuil/);
    expect(reading.summary).not.toMatch(/seuil/);
  });

  it("keeps consistency unavailable without a training plan", () => {
    const view = fitnessView({
      history: { activities: [], laps: [], load: [], vo2: [], races: [] },
      zones: null,
      period: "6m",
      today,
    });
    const consistency = view.rows.find((row) => row.key === "consistency");
    expect(consistency?.value).toBe("—");
    expect(consistency?.trend).toBeUndefined();
    expect(view.load).toBeNull();
    expect(view.rows.map((row) => row.key)).toEqual([
      "efficiency",
      "climbing",
      "drift",
      "consistency",
    ]);
    expect(consistency?.href).toBe("/plan");
  });

  it("shows consistency from the active plan adherence", () => {
    const view = fitnessView({
      history: { activities: [], laps: [], load: [], vo2: [], races: [] },
      zones: null,
      period: "12w",
      today,
      adherence: {
        due: 10,
        done: 8,
        substituted: 1,
        missed: 1,
        keyDue: 4,
        keyDone: 3,
        share: 0.8,
        keyShare: 0.75,
        windows: [1, 0.5, null, 1, 1, 0.5, 1, 1],
      },
    });
    const consistency = view.rows.find((row) => row.key === "consistency");
    expect(consistency).toMatchObject({
      value: "80 %",
      detail: "Séances réalisées, 12 sem.",
      verdict: "8 sur 10 séances · séances clés 75 %",
      trend: "improving",
      tone: "success",
    });
  });

  it("keeps consistency empty when no plan session is due yet", () => {
    const view = fitnessView({
      history: { activities: [], laps: [], load: [], vo2: [], races: [] },
      zones: null,
      period: "6w",
      today,
      adherence: {
        due: 0,
        done: 0,
        substituted: 0,
        missed: 0,
        keyDue: 0,
        keyDone: 0,
        share: null,
        keyShare: null,
        windows: Array(8).fill(null),
      },
    });
    const consistency = view.rows.find((row) => row.key === "consistency");
    expect(consistency?.value).toBe("—");
    expect(consistency?.verdict).toBe("Aucune séance passée sur la période");
  });
});

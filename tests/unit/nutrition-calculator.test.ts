import { describe, expect, it } from "vitest";
import {
  ageOn,
  nutritionForDay,
  nutritionForDays,
  type NutritionDayInput,
  type NutritionDayResult,
  type NutritionResult,
} from "@/features/nutrition/calculator";
import { nutritionThresholdsVersion } from "@/features/nutrition/thresholds";

const male = {
  birthDate: "1991-05-01",
  sex: "male",
  heightCm: 175,
  weightKg: 70,
};

const female = {
  birthDate: "1996-01-15",
  sex: "female",
  heightCm: 165,
  weightKg: 60,
};

const garmin = { kcalPerDay: 500, source: "garmin" as const };

const day = (patch: Partial<NutritionDayInput> = {}): NutritionDayInput => ({
  date: "2026-10-20",
  profile: male,
  sessions: [],
  neat: garmin,
  ...patch,
});

function computed(result: NutritionResult): NutritionDayResult {
  if (!result.ok) throw new Error(`missing ${result.missing.join(",")}`);
  return result;
}

const run = (km: number, minutes: number, patch = {}) => ({
  sport: "run",
  distanceKm: km,
  durationSeconds: minutes * 60,
  ...patch,
});

describe("resting energy", () => {
  it("applies Mifflin-St Jeor for a man", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.inputsUsed.ageYears).toBe(35);
    expect(result.energy.restingKcal).toBe(1624);
  });

  it("applies Mifflin-St Jeor for a woman", () => {
    const result = computed(nutritionForDay(day({ profile: female })));
    expect(result.inputsUsed.ageYears).toBe(30);
    expect(result.energy.restingKcal).toBe(1320);
  });

  it("computes age on the requested day", () => {
    expect(ageOn("1991-10-21", "2026-10-20")).toBe(34);
    expect(ageOn("1991-10-20", "2026-10-20")).toBe(35);
  });
});

describe("NEAT", () => {
  it("defaults to a quarter of resting energy with low confidence", () => {
    const result = computed(nutritionForDay(day({ neat: undefined })));
    expect(result.energy.neatKcal).toBe(406);
    expect(result.inputsUsed.neat.source).toBe("default");
    expect(result.estimations[0]).toMatchObject({ code: "neat_default" });
    expect(result.confidence).toBe("low");
    expect(result.energy.targetKcal).toBe(2192);
    expect(result.energy.displayKcal).toBe(2200);
  });

  it("uses Garmin NEAT with high confidence when nothing is estimated", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.energy.neatKcal).toBe(500);
    expect(result.inputsUsed.neat.source).toBe("garmin");
    expect(result.estimations).toEqual([]);
    expect(result.confidence).toBe("high");
    expect(result.energy.targetKcal).toBe(2286);
    expect(result.energy.displayKcal).toBe(2300);
  });
});

describe("training energy", () => {
  it("costs about one kcal per kg per km on flat ground", () => {
    const result = computed(nutritionForDay(day({ sessions: [run(10, 50)] })));
    expect(result.energy.trainingKcal).toBe(700);
  });

  it("adds a climbing term for elevation gain", () => {
    const result = computed(
      nutritionForDay(
        day({ sessions: [run(10, 50, { elevationGainM: 500 })] }),
      ),
    );
    expect(result.energy.trainingKcal).toBe(1050);
  });

  it("estimates the distance from the duration and lowers confidence", () => {
    const result = computed(
      nutritionForDay(
        day({ sessions: [{ sport: "trail", durationSeconds: 3_600 }] }),
      ),
    );
    expect(result.estimations).toEqual([
      { code: "session_distance_from_duration", target: 0, value: 7.5 },
    ]);
    expect(result.energy.trainingKcal).toBe(525);
    expect(result.confidence).toBe("medium");
  });

  it("uses a per-minute cost for strength and mobility", () => {
    const result = computed(
      nutritionForDay(
        day({
          sessions: [
            { sport: "strength", durationSeconds: 1_800 },
            { sport: "mobility", durationSeconds: 1_200 },
          ],
        }),
      ),
    );
    expect(result.energy.trainingKcal).toBe(240);
    expect(result.dayType).toBe("easy");
  });
});

describe("day types and carbohydrates", () => {
  it("classifies a day without session as rest", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.dayType).toBe("rest");
    expect(result.carbs.grams).toEqual({ min: 210, max: 350 });
    expect(result.fueling).toEqual([]);
  });

  it("classifies a short easy run as easy", () => {
    const result = computed(
      nutritionForDay(day({ sessions: [run(8, 45, { kind: "easy" })] })),
    );
    expect(result.dayType).toBe("easy");
    expect(result.carbs.gPerKg).toEqual({ min: 3, max: 5 });
  });

  it("classifies tempo and hour-long runs as moderate", () => {
    const tempo = computed(
      nutritionForDay(day({ sessions: [run(10, 45, { kind: "tempo" })] })),
    );
    const hour = computed(nutritionForDay(day({ sessions: [run(12, 70)] })));
    expect(tempo.dayType).toBe("moderate");
    expect(hour.dayType).toBe("moderate");
    expect(tempo.carbs.grams).toEqual({ min: 350, max: 490 });
  });

  it("classifies long runs, key and interval sessions as long or hard", () => {
    const long = computed(nutritionForDay(day({ sessions: [run(18, 100)] })));
    const key = computed(
      nutritionForDay(day({ sessions: [run(8, 45, { isKey: true })] })),
    );
    const intervals = computed(
      nutritionForDay(day({ sessions: [run(10, 50, { kind: "intervals" })] })),
    );
    expect([long.dayType, key.dayType, intervals.dayType]).toEqual([
      "long_or_hard",
      "long_or_hard",
      "long_or_hard",
    ]);
    expect(long.carbs.grams).toEqual({ min: 420, max: 700 });
    expect(long.protein.recoveryIntakeWithinHours).toBe(2);
  });

  it("loads carbohydrates the day before a race over 90 minutes", () => {
    const races = [
      { date: "2026-10-21", distanceKm: 42.2, expectedDurationSeconds: 12_600 },
    ];
    const eve = computed(nutritionForDay(day({ races })));
    const raceDay = computed(
      nutritionForDay(day({ date: "2026-10-21", races })),
    );
    expect(eve.dayType).toBe("pre_race");
    expect(eve.carbs.grams).toEqual({ min: 560, max: 840 });
    expect(eve.inputsUsed.nextRace).toEqual(races[0]);
    expect(raceDay.dayType).toBe("race");
    expect(raceDay.carbs.gPerKg).toEqual({ min: 8, max: 12 });
    expect(raceDay.energy.trainingKcal).toBe(2954);
    expect(raceDay.fueling).toEqual([
      {
        target: "race",
        durationSeconds: 12_600,
        ultra: false,
        gramsPerHour: { min: 30, max: 60 },
        totalGrams: { min: 105, max: 210 },
      },
    ]);
  });

  it("does not load before a short race", () => {
    const result = computed(
      nutritionForDay(day({ races: [{ date: "2026-10-21", distanceKm: 10 }] })),
    );
    expect(result.dayType).toBe("rest");
  });

  it("does not count a race session twice on race day", () => {
    const races = [{ date: "2026-10-20", distanceKm: 10 }];
    const result = computed(
      nutritionForDay(
        day({ races, sessions: [run(10, 45, { kind: "race" })] }),
      ),
    );
    expect(result.energy.trainingKcal).toBe(700);
    expect(result.carbs.gPerKg).toEqual({ min: 6, max: 10 });
    expect(result.estimations).toEqual([
      { code: "race_duration_from_distance", target: "race", value: 3_600 },
    ]);
  });

  it("asks 30 to 60 g/h in training sessions over 90 minutes", () => {
    const result = computed(nutritionForDay(day({ sessions: [run(18, 100)] })));
    expect(result.fueling).toEqual([
      {
        target: 0,
        durationSeconds: 6_000,
        ultra: false,
        gramsPerHour: { min: 30, max: 60 },
        totalGrams: { min: 50, max: 100 },
      },
    ]);
  });
});

describe("ultra fueling", () => {
  it("asks 60 to 90 g/h in a long trail race", () => {
    const races = [
      {
        date: "2026-10-20",
        sport: "trail" as const,
        distanceKm: 50,
        expectedDurationSeconds: 21_600,
        elevationGainM: 2_500,
      },
    ];
    const result = computed(nutritionForDay(day({ races })));
    expect(result.fueling[0]).toMatchObject({
      ultra: true,
      gramsPerHour: { min: 60, max: 90 },
      totalGrams: { min: 360, max: 540 },
    });
  });

  it("treats a trail marathon race as an ultra effort", () => {
    const races = [
      {
        date: "2026-10-20",
        sport: "trail" as const,
        distanceKm: 42.2,
        expectedDurationSeconds: 13_800,
      },
    ];
    const result = computed(nutritionForDay(day({ races })));
    expect(result.fueling[0]?.ultra).toBe(true);
  });

  it("treats a training session over four hours as an ultra effort", () => {
    const result = computed(
      nutritionForDay(
        day({
          sessions: [
            { sport: "trail", distanceKm: 35, durationSeconds: 18_000 },
          ],
        }),
      ),
    );
    expect(result.fueling[0]).toMatchObject({
      ultra: true,
      totalGrams: { min: 300, max: 450 },
    });
  });
});

describe("protein and fat", () => {
  it("spreads protein over four to five intakes", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.protein.grams).toEqual({ min: 112, max: 140 });
    expect(result.protein.intakes).toEqual({ min: 4, max: 5 });
    expect(result.protein.gramsPerIntake).toEqual({ min: 21, max: 28 });
    expect(result.protein.recoveryIntakeWithinHours).toBeNull();
  });

  it("gives fat the remainder of the target", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.fat).toEqual({
      grams: 74,
      gPerKg: 1.06,
      floorApplied: false,
    });
  });

  it("keeps fat at its floor when carbs and protein exceed the target", () => {
    const result = computed(
      nutritionForDay(
        day({
          races: [
            {
              date: "2026-10-21",
              distanceKm: 42.2,
              expectedDurationSeconds: 12_600,
            },
          ],
        }),
      ),
    );
    expect(result.fat).toEqual({ grams: 56, gPerKg: 0.8, floorApplied: true });
  });
});

describe("light deficit", () => {
  it("is not applied unless requested", () => {
    const result = computed(nutritionForDay(day()));
    expect(result.deficit).toEqual({ status: "not_requested" });
  });

  it("applies a bounded 10 to 15 percent deficit on a rest day", () => {
    const result = computed(nutritionForDay(day({ deficitRequested: true })));
    expect(result.deficit).toEqual({
      status: "applied",
      kcal: { min: 300, max: 343 },
      targetKcal: { min: 1943, max: 1986 },
    });
  });

  it("caps the deficit at 500 kcal", () => {
    const result = computed(
      nutritionForDay(
        day({
          deficitRequested: true,
          sessions: [run(14, 75, { kind: "easy" })],
        }),
      ),
    );
    expect(result.dayType).toBe("moderate");
    expect(result.deficit).toMatchObject({
      status: "applied",
      kcal: { min: 327, max: 490 },
    });
    const bigger = computed(
      nutritionForDay(
        day({
          deficitRequested: true,
          profile: { ...male, weightKg: 95 },
          sessions: [run(16, 85)],
        }),
      ),
    );
    expect(bigger.deficit).toMatchObject({ kcal: { max: 500 } });
  });

  it.each([
    ["long_or_hard_day", day({ sessions: [run(18, 100)] })],
    [
      "pre_race_day",
      day({
        races: [
          {
            date: "2026-10-21",
            distanceKm: 21.1,
            expectedDurationSeconds: 6_000,
          },
        ],
      }),
    ],
    ["race_day", day({ races: [{ date: "2026-10-20", distanceKm: 10 }] })],
    ["taper_week", day({ weekType: "taper" })],
    ["race_week", day({ weekType: "race" })],
    ["health_flags", day({ healthFlags: ["fatigue"] })],
  ] as const)("refuses the deficit for %s", (reason, input) => {
    const result = computed(
      nutritionForDay({ ...input, deficitRequested: true }),
    );
    expect(result.deficit).toEqual({ status: "refused", reasons: [reason] });
  });

  it("lists every refusal reason at once", () => {
    const result = computed(
      nutritionForDay(
        day({
          deficitRequested: true,
          weekType: "race",
          healthFlags: ["illness", "poor_readiness"],
          races: [{ date: "2026-10-20", distanceKm: 10 }],
        }),
      ),
    );
    expect(result.deficit).toEqual({
      status: "refused",
      reasons: ["race_day", "race_week", "health_flags"],
    });
  });
});

describe("missing profile data", () => {
  it("lists every missing field instead of guessing", () => {
    expect(nutritionForDay(day({ profile: {} }))).toEqual({
      ok: false,
      version: nutritionThresholdsVersion,
      date: "2026-10-20",
      missing: ["birthDate", "sex", "heightCm", "weightKg"],
    });
  });

  it("treats an unspecified sex as missing", () => {
    const result = nutritionForDay(
      day({ profile: { ...male, sex: "unspecified" } }),
    );
    expect(result).toMatchObject({ ok: false, missing: ["sex"] });
  });

  it("treats a null weight and an invalid birth date as missing", () => {
    const result = nutritionForDay(
      day({ profile: { ...male, birthDate: "2030-01-01", weightKg: null } }),
    );
    expect(result).toMatchObject({
      ok: false,
      missing: ["birthDate", "weightKg"],
    });
  });
});

describe("ranges and determinism", () => {
  it("returns the same result for the same input", () => {
    const input = day({ sessions: [run(18, 100, { elevationGainM: 300 })] });
    expect(nutritionForDay(input)).toEqual(nutritionForDay(input));
  });

  it("computes each day of a range with its own sessions", () => {
    const results = nutritionForDays({
      from: "2026-10-19",
      to: "2026-10-21",
      profile: male,
      neat: garmin,
      neatByDate: { "2026-10-21": { kcalPerDay: 600, source: "garmin" } },
      sessions: [{ date: "2026-10-20", ...run(18, 100) }],
      races: [],
    }).map(computed);
    expect(results.map((result) => [result.date, result.dayType])).toEqual([
      ["2026-10-19", "rest"],
      ["2026-10-20", "long_or_hard"],
      ["2026-10-21", "rest"],
    ]);
    expect(results[1]?.inputsUsed.sessions).toEqual([run(18, 100)]);
    expect(results[2]?.energy.neatKcal).toBe(600);
  });
});

import { describe, expect, it } from "vitest";
import type { ProgressRace } from "@/features/progress/history";
import { addDays } from "@/features/progress/period";
import {
  checkinFieldSchema,
  raceRecoveries,
  readinessLevel,
  recoveryModel,
  recoveryNights,
  restingRange,
  usualRange,
  type RecoveryNight,
} from "@/features/progress/recovery";
import { formatSleep, recoveryView } from "@/features/progress/recovery-view";

const today = "2026-10-12";

function nights(
  count: number,
  values: (age: number) => Partial<RecoveryNight>,
): RecoveryNight[] {
  return Array.from({ length: count }, (_, index) => {
    const age = count - 1 - index;
    return {
      day: addDays(today, -age),
      readiness: 70,
      sleepSeconds: 26_400,
      sleepScore: 82,
      hrv: 58 + (index % 3) - 1,
      hrvStatus: "BALANCED",
      restingHeartRate: 45,
      ...values(age),
    };
  });
}

function race(day: string): ProgressRace {
  return {
    id: day,
    name: "Trail 62K",
    day,
    kind: "trail",
    distanceKm: 62,
    priority: "B",
  };
}

describe("recovery observations", () => {
  it("groups Garmin metrics by night", () => {
    expect(
      recoveryNights([
        {
          metric: "sleep_duration_seconds",
          day: today,
          value: 25_000,
          text: null,
        },
        { metric: "hrv_status", day: today, value: null, text: "BALANCED" },
        {
          metric: "training_readiness",
          day: "2026-10-11",
          value: 64,
          text: null,
        },
      ]),
    ).toEqual([
      expect.objectContaining({ day: "2026-10-11", readiness: 64, hrv: null }),
      expect.objectContaining({
        day: today,
        sleepSeconds: 25_000,
        hrvStatus: "BALANCED",
      }),
    ]);
  });

  it("needs a week of nights for a usual range", () => {
    expect(usualRange([50, 52, 54, 56, 58, 60])).toBeNull();
    expect(usualRange([50, 52, 54, 56, 58, 60, 62])).toEqual({
      low: 52,
      high: 60,
    });
    expect(restingRange([44, 44, 45, 45, 46, 46, 50])).toEqual({
      low: 45,
      high: 46,
    });
  });

  it("validates check-in answers", () => {
    expect(
      checkinFieldSchema.safeParse({ field: "legs", value: "fresh" }).success,
    ).toBe(true);
    expect(
      checkinFieldSchema.safeParse({ field: "legs", value: "tired" }).success,
    ).toBe(false);
    expect(
      checkinFieldSchema.safeParse({ field: "mood", value: "low" }).success,
    ).toBe(false);
  });
});

describe("recovery signals", () => {
  it("flags a short night and a low HRV night", () => {
    const model = recoveryModel({
      nights: nights(30, (age) =>
        age === 0 ? { readiness: 58, sleepSeconds: 21_120, hrv: 46 } : {},
      ),
      load: [],
      checkin: null,
      races: [],
      today,
    });
    expect(model.readiness).toMatchObject({
      today: 58,
      average: 70,
      level: "moderate",
      trend: "watch",
    });
    expect(model.sleep).toMatchObject({ streak: 1, trend: "watch" });
    expect(model.hrv).toMatchObject({
      last: 46,
      position: "below",
      streak: 1,
      trend: "watch",
    });
    expect(model.restingHeartRate?.position).toBe("within");
  });

  it("escalates two nights in a row under the range", () => {
    const model = recoveryModel({
      nights: nights(30, (age) => (age <= 1 ? { hrv: 45 } : {})),
      load: [],
      checkin: null,
      races: [],
      today,
    });
    expect(model.hrv).toMatchObject({ streak: 2, trend: "investigate" });
  });

  it("treats a high resting heart rate as unfavorable", () => {
    const model = recoveryModel({
      nights: nights(30, (age) => (age <= 1 ? { restingHeartRate: 50 } : {})),
      load: [],
      checkin: null,
      races: [],
      today,
    });
    expect(model.restingHeartRate).toMatchObject({
      position: "above",
      streak: 2,
      trend: "investigate",
    });
  });

  it("ignores stale measures instead of showing them as today", () => {
    const model = recoveryModel({
      nights: nights(10, () => ({})).map((night) => ({
        ...night,
        day: addDays(night.day, -5),
      })),
      load: [],
      checkin: null,
      races: [],
      today,
    });
    expect(model.readiness).toBeNull();
    expect(model.sleep).toBeNull();
    expect(model.hrv).toBeNull();
  });

  it("maps Garmin readiness levels", () => {
    expect(readinessLevel(75)).toBe("high");
    expect(readinessLevel(74)).toBe("moderate");
    expect(readinessLevel(25)).toBe("low");
    expect(readinessLevel(24)).toBe("poor");
  });
});

describe("race recovery", () => {
  it("counts days until HRV returns to the pre-race range", () => {
    const raceDay = addDays(today, -20);
    const history = nights(60, (age) => {
      const after = 20 - age;
      return after >= 1 && after <= 5 ? { hrv: 44 } : {};
    });
    expect(raceRecoveries(history, [race(raceDay)], today)).toEqual([
      {
        id: raceDay,
        name: "Trail 62K",
        day: raceDay,
        days: 6,
        ongoing: null,
      },
    ]);
  });

  it("reports an ongoing recovery and skips races without baseline", () => {
    const history = nights(40, (age) => (age <= 3 ? { hrv: 40 } : {}));
    expect(
      raceRecoveries(
        history,
        [race(addDays(today, -4)), race("2026-01-01"), race("2026-11-01")],
        today,
      ),
    ).toEqual([expect.objectContaining({ days: null, ongoing: 4 })]);
  });
});

describe("recovery reading", () => {
  it("names sleep as the cause when HRV holds", () => {
    const view = recoveryView(
      recoveryModel({
        nights: nights(30, (age) =>
          age === 0 ? { readiness: 58, sleepSeconds: 21_120 } : {},
        ),
        load: [],
        checkin: {
          day: today,
          legs: "fresh",
          soreness: null,
          stress: null,
          updatedAt: null,
        },
        races: [],
        today,
      }),
    );
    expect(view.headline).toBe("Une courte nuit sur de bonnes bases.");
    expect(view.summary).toContain("vient surtout du sommeil");
    expect(view.summary).toContain("jambes fraîches");
    expect(view.deviations.find((item) => item.key === "sleep")).toMatchObject({
      value: "−1h28",
      caption: "Sommeil 5h52",
    });
    expect(view.deviations.find((item) => item.key === "legs")?.value).toBe(
      "Fraîches",
    );
  });

  it("states missing nights honestly", () => {
    const view = recoveryView(
      recoveryModel({ nights: [], load: [], checkin: null, races: [], today }),
    );
    expect(view.headline).toBe(
      "Pas encore assez de nuits mesurées pour lire ta récupération.",
    );
    expect(view.readiness).toBeNull();
    expect(view.races).toEqual([]);
  });

  it("formats sleep durations", () => {
    expect(formatSleep(21_120)).toBe("5h52");
    expect(formatSleep(3_600)).toBe("1h00");
  });
});

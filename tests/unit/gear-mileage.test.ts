import { describe, expect, it } from "vitest";
import {
  garminLimitMeters,
  pairWear,
  replacementDate,
  startingDistanceFor,
  wearIsHigh,
  weeklyKm,
} from "@/features/gear/mileage";

describe("pair mileage", () => {
  it("adds starting km to the distance Garmin counted", () => {
    const wear = pairWear({
      startingDistanceM: 412_000,
      garminDistanceM: 182_000,
      lifespanKm: 800,
    });
    expect(wear).toMatchObject({
      totalKm: 594,
      startingKm: 412,
      garminKm: 182,
      percent: 74,
      remainingKm: 206,
      worn: false,
    });
    expect(wearIsHigh(wear)).toBe(true);
  });

  it("stores the km Garmin cannot hold as the starting distance", () => {
    expect(startingDistanceFor(594, 182_000)).toBe(412_000);
    expect(startingDistanceFor(100, 182_000)).toBe(0);
  });

  it("sets Garmin's wear limit to the lifespan left after the starting km", () => {
    expect(garminLimitMeters(800, 412_000)).toBe(388_000);
    expect(garminLimitMeters(400, 500_000)).toBe(1000);
  });

  it("projects the replacement date from the last eight weeks", () => {
    const wear = pairWear({
      startingDistanceM: 412_000,
      garminDistanceM: 182_000,
      lifespanKm: 800,
    });
    const activities = Array.from({ length: 8 }, (_, week) => ({
      day: `2026-${week < 2 ? "10" : "09"}-${String(20 - week * 2).padStart(2, "0")}`,
      distanceM: 29_000,
    }));
    expect(weeklyKm(activities, "2026-10-20")).toBe(29);
    expect(replacementDate(wear, activities, "2026-10-20")).toBe("2026-12-09");
  });

  it("has no projection without recent runs and is due today once worn", () => {
    const fresh = pairWear({
      startingDistanceM: 0,
      garminDistanceM: 10_000,
      lifespanKm: 700,
    });
    const worn = pairWear({
      startingDistanceM: 700_000,
      garminDistanceM: 20_000,
      lifespanKm: 700,
    });
    expect(replacementDate(fresh, [], "2026-10-20")).toBeNull();
    expect(worn.worn).toBe(true);
    expect(replacementDate(worn, [], "2026-10-20")).toBe("2026-10-20");
  });
});

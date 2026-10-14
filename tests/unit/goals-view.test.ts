import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatRaceDistance,
  formatTarget,
  splitRaces,
  type GoalRace,
} from "@/features/settings/goals-view";

const race = (
  id: string,
  priority: "A" | "B" | "C",
  date: string | null,
  extra: Partial<GoalRace["values"]> = {},
): GoalRace => ({
  id,
  values: {
    race_kind: "trail",
    name: id,
    race_date: date,
    distance_km: 10,
    elevation_gain_m: null,
    priority,
    target_duration_seconds: null,
    ...extra,
  },
});

describe("splitRaces", () => {
  it("separates upcoming and past races and reports missing priorities", () => {
    const result = splitRaces(
      [
        race("late", "A", "2027-03-20"),
        race("done", "B", "2026-09-27"),
        race("soon", "C", "2026-11-22"),
      ],
      "2026-10-13",
    );
    expect(result.upcoming.map((item) => item.id)).toEqual(["soon", "late"]);
    expect(result.past.map((item) => item.id)).toEqual(["done"]);
    expect(result.primary?.id).toBe("late");
    expect(result.missing).toEqual(["B"]);
  });
});

describe("race formatting", () => {
  it("formats distance, elevation and target", () => {
    expect(
      formatRaceDistance(
        race("a", "A", null, {
          distance_km: 120,
          elevation_gain_m: 2000,
        }).values,
      ),
    ).toBe("120 km · 2 000 m");
    expect(
      formatRaceDistance(
        race("a", "A", null, {
          distance_km: 10,
          elevation_gain_m: 0,
        }).values,
      ),
    ).toBe("10 km · plat");
    expect(formatTarget(66600)).toBe("18:30");
    expect(daysUntil("2027-03-20", "2026-10-07")).toBe(164);
  });
});

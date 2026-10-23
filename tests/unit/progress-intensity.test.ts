import { describe, expect, it } from "vitest";
import { intensityDistribution } from "@/features/progress/intensity";

const today = "2026-10-12";
const zones = [
  { zone: 1, lower: 120, upper: 133 },
  { zone: 2, lower: 134, upper: 147 },
  { zone: 3, lower: 148, upper: 161 },
  { zone: 4, lower: 162, upper: 175 },
  { zone: 5, lower: 176, upper: 190 },
];

describe("intensity distribution", () => {
  it("splits four weeks of heart-rate time into easy, tempo and hard", () => {
    const result = intensityDistribution(
      [
        {
          activityId: "easy",
          day: "2026-10-10",
          histogram: [
            [130, 3000],
            [140, 3000],
          ],
        },
        {
          activityId: "hard",
          day: "2026-10-01",
          histogram: [
            [140, 1000],
            [155, 500],
            [170, 1500],
          ],
        },
        { activityId: "old", day: "2026-09-01", histogram: [[180, 9000]] },
      ],
      zones,
      today,
    )!;
    expect(result.runs).toBe(2);
    expect(result.shares.map((share) => Math.round(share.share * 100))).toEqual(
      [78, 6, 17],
    );
    expect(result.shares.map((share) => share.onTarget)).toEqual([
      false,
      false,
      true,
    ]);
    expect(result.drift).toBeNull();
  });

  it("lists easy runs that drift into zone 3", () => {
    const drifting = (day: string) => ({
      activityId: day,
      day,
      histogram: [
        [140, 2000],
        [150, 1000],
      ] as [number, number][],
    });
    const result = intensityDistribution(
      [
        drifting("2026-10-11"),
        drifting("2026-10-09"),
        { activityId: "steady", day: "2026-10-07", histogram: [[140, 3000]] },
      ],
      zones,
      today,
    )!;
    expect(result.drift).toMatchObject({ count: 2, easyRuns: 3, bpm: 148 });
    expect(result.drift?.note).toBe(
      "Tes footings glissent en Z3 : 2 sorties faciles sur 3 passent plus de 20 % du temps au-dessus de 148 bpm.",
    );
  });

  it("is unavailable without zones or histograms", () => {
    expect(intensityDistribution([], zones, today)).toBeNull();
    expect(
      intensityDistribution(
        [{ activityId: "a", day: today, histogram: [[140, 60]] }],
        null,
        today,
      ),
    ).toBeNull();
  });
});

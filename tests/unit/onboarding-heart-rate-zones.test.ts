import { describe, expect, it } from "vitest";
import { calculateHeartRateZones } from "../../src/features/onboarding/heart-rate-zones";

const today = new Date("2026-10-10T12:00:00Z");
const observations = Array.from({ length: 8 }, (_, index) => ({
  metric: "resting_heart_rate_bpm",
  value: 47 + index,
  observedOn: `2026-10-0${index + 1}`,
}));
const calculate = (maximum: number | null, samples = observations) =>
  calculateHeartRateZones({ maximum, observations: samples, today });

describe("estimated heart-rate zones", () => {
  it("uses the median of recent resting observations for Karvonen", () => {
    expect(calculate(200)).toMatchObject({
      method: "karvonen",
      resting: 50.5,
      restingSamples: 8,
      windowStart: "2026-09-13",
      windowEnd: "2026-10-10",
      zones: [
        { zone: 1, lower: 125, upper: 139 },
        { zone: 2, lower: 140, upper: 154 },
        { zone: 3, lower: 155, upper: 169 },
        { zone: 4, lower: 170, upper: 184 },
        { zone: 5, lower: 185, upper: 200 },
      ],
    });
  });
  it("falls back to percentage maximum with insufficient valid recent samples", () => {
    const samples = [
      ...observations.slice(0, 6),
      { ...observations[0], observedOn: "2026-09-12" },
      { ...observations[0], observedOn: "2026-10-11" },
      { ...observations[0], value: 200 },
      { ...observations[0], value: NaN },
    ];
    expect(calculate(199, samples)).toMatchObject({
      method: "percentage_maximum",
      resting: null,
      zones: [
        { zone: 1, lower: 100, upper: 118 },
        { zone: 2, lower: 119, upper: 138 },
        { zone: 3, lower: 139, upper: 158 },
        { zone: 4, lower: 159, upper: 178 },
        { zone: 5, lower: 179, upper: 199 },
      ],
    });
    expect(calculate(199, [])?.method).toBe("percentage_maximum");
  });
  it("rejects absent, non-finite, non-positive and collapsed inputs", () => {
    for (const maximum of [null, NaN, Infinity, 0, -1, 2])
      expect(calculate(maximum)).toBeNull();
    expect(
      calculateHeartRateZones({
        maximum: 200,
        observations,
        today: new Date(NaN),
      }),
    ).toBeNull();
  });
  it("keeps every rounded integer range contiguous", () => {
    const zones = calculate(193)?.zones ?? [];
    expect(zones).toHaveLength(5);
    for (let index = 1; index < zones.length; index++)
      expect(zones[index].lower).toBe(zones[index - 1].upper + 1);
  });
});

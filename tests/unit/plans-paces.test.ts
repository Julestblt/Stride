import { describe, expect, it, vi } from "vitest";
import type { OnboardingContext } from "../../src/server/onboarding/context";

const { loadPlanningInput } = vi.hoisted(() => ({
  loadPlanningInput: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../src/server/plans/draft", () => ({ loadPlanningInput }));
import {
  loadIntensityPaceRanges,
  loadIntensityPaces,
} from "../../src/server/plans/paces";

describe("intensity paces loader", () => {
  it("returns no paces when the planning input cannot be read", async () => {
    loadPlanningInput.mockRejectedValue(new Error("history unavailable"));
    await expect(
      loadIntensityPaceRanges({} as OnboardingContext),
    ).resolves.toBeNull();
    await expect(
      loadIntensityPaces({} as OnboardingContext),
    ).resolves.toBeNull();
  });

  it("exposes pace ranges and their midpoints", async () => {
    loadPlanningInput.mockResolvedValue({
      today: "2026-10-14",
      input: {
        targets: {
          flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-10-01" },
          garminLactateThreshold: null,
          bestEfforts: [],
          vo2Max: null,
          garminZones: null,
          strideZones: null,
        },
      },
    });
    const context = {} as OnboardingContext;
    const ranges = await loadIntensityPaceRanges(context);
    expect(ranges?.easy).toEqual({
      fastSecondsPerKm: 321,
      slowSecondsPerKm: 365,
    });
    expect((await loadIntensityPaces(context))?.easy).toBe(343);
  });
});

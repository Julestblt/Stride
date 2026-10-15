import { describe, expect, it, vi } from "vitest";
import type { OnboardingContext } from "../../src/server/onboarding/context";

vi.mock("server-only", () => ({}));
vi.mock("../../src/server/plans/draft", () => ({
  loadPlanningInput: vi.fn(async () => {
    throw new Error("history unavailable");
  }),
}));
import { loadIntensityPaces } from "../../src/server/plans/paces";

describe("intensity paces loader", () => {
  it("returns no paces when the planning input cannot be read", async () => {
    await expect(
      loadIntensityPaces({} as OnboardingContext),
    ).resolves.toBeNull();
  });
});

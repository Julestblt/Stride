import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/features/onboarding/profile";
import { changedProfileSources } from "@/features/settings/profile";

describe("settings profile provenance", () => {
  it("keeps an unchanged Garmin value attributed to Garmin while attributing an athlete edit to the athlete", () => {
    const current = {
      ...emptyProfile,
      first_name: "Jules",
      weight_kg: 68.2,
      value_sources: {
        weight_kg: { source: "garmin" as const, observed_on: "2026-10-07" },
      },
    };
    expect(
      changedProfileSources({ first_name: "Jules", weight_kg: 68.2 }, current),
    ).toEqual({});
    expect(
      changedProfileSources({ first_name: "Jules", weight_kg: 69 }, current),
    ).toEqual({ weight_kg: { source: "athlete" } });
  });
});

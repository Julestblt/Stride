import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/features/onboarding/profile";
import { athleteModelShares, formatMemberSince } from "@/features/settings/athlete-model";

describe("athleteModelShares", () => {
  it("treats unanswered fields as Stride estimates", () => {
    expect(athleteModelShares(emptyProfile)).toEqual({
      garmin: 0,
      athlete: 0,
      estimate: 100,
      openQuestions: 10,
    });
  });

  it("splits answered fields between Garmin and the athlete", () => {
    const shares = athleteModelShares({
      ...emptyProfile,
      first_name: "Jules",
      height_cm: 178,
      weight_kg: 68,
      value_sources: {
        weight_kg: { source: "garmin", observed_on: "2026-10-01" },
      },
    });
    expect(shares).toEqual({
      garmin: 10,
      athlete: 20,
      estimate: 70,
      openQuestions: 7,
    });
  });
});

describe("formatMemberSince", () => {
  it("formats the month and year in French", () => {
    expect(formatMemberSince("2026-10-05T09:00:00Z")).toBe("oct. 2026");
    expect(formatMemberSince(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type {
  AthleteProfileView,
  ProfileFact,
} from "@/features/onboarding/athlete-profile";
import { emptyProfile } from "@/features/onboarding/profile";
import {
  athleteModelShares,
  formatMemberSince,
} from "@/features/settings/athlete-model";

const fact = (
  key: string,
  source: ProfileFact["source"],
  value: string | null,
): ProfileFact => ({ key, label: key, value, source, detail: "" });

const view = (
  facts: ProfileFact[],
  extras: Partial<AthleteProfileView> = {},
): AthleteProfileView => ({
  firstName: null,
  activityCount: 0,
  history: null,
  sleepNights: 0,
  heartRateZones: null,
  habits: { final: true, items: [] },
  weeks: [],
  sections: [{ key: "training", title: "", facts }],
  ...extras,
});

describe("athleteModelShares", () => {
  it("falls back to Stride estimates when nothing is observed", () => {
    const shares = athleteModelShares(view([]), emptyProfile);
    expect(shares).toMatchObject({ garmin: 0, athlete: 0, estimate: 100 });
  });

  it("counts Garmin, athlete and Stride-derived signals", () => {
    const shares = athleteModelShares(
      view(
        [
          fact("vo2_max", "garmin", "52"),
          fact("hrv", "garmin", "60 ms"),
          fact("sleep", "garmin", "7 h"),
          fact("terrain", "garmin", "Trail"),
          fact("availability", "athlete", "5 jours"),
          fact("focus", "athlete", null),
        ],
        {
          heartRateZones: {} as AthleteProfileView["heartRateZones"],
        },
      ),
      emptyProfile,
    );
    expect(shares).toEqual({
      garmin: 57,
      athlete: 14,
      estimate: 29,
      openQuestions: 11,
    });
  });
});

describe("formatMemberSince", () => {
  it("formats the month and year in French", () => {
    expect(formatMemberSince("2026-10-05T09:00:00Z")).toBe("oct. 2026");
    expect(formatMemberSince(null)).toBeNull();
  });
});

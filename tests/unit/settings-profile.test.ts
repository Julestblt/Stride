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

import {
  changedDraftFields,
  profileDraft,
  profileDraftSchema,
  parseFrenchBirthDate,
  frenchBirthDate,
} from "@/features/settings/profile";
import {
  eligibleRunningMaximum,
  effectiveRunningMaximum,
} from "@/features/settings/heart-rate";

const snapshot = {
  values: {
    ...emptyProfile,
    first_name: "Jules",
    birth_date: "1991-06-14",
    sex: "male" as const,
    height_cm: 178,
    weight_kg: 68.2,
  },
  revision: 1,
  maximumOverride: null,
  thresholdOverride: null,
  thresholdSource: null,
  photoUrl: null,
};
describe("profile drafts", () => {
  it("validates optional overrides and requires a threshold source", () => {
    const draft = profileDraft(snapshot);
    expect(profileDraftSchema.safeParse(draft).success).toBe(true);
    expect(
      profileDraftSchema.safeParse({
        ...draft,
        threshold_heart_rate_override: 172,
      }).success,
    ).toBe(false);
    expect(
      profileDraftSchema.safeParse({
        ...draft,
        threshold_heart_rate_override: 172,
        threshold_heart_rate_source: "field",
      }).success,
    ).toBe(true);
    expect(
      profileDraftSchema.safeParse({
        ...draft,
        running_max_heart_rate_override: 231,
      }).success,
    ).toBe(false);
    expect(
      profileDraftSchema.safeParse({
        ...draft,
        running_max_heart_rate_override: 185.5,
      }).success,
    ).toBe(false);
  });
  it("tracks changes and reconstructs the original draft on cancel", () => {
    const original = profileDraft(snapshot);
    expect(
      changedDraftFields(
        { ...original, weight_kg: 69, running_max_heart_rate_override: 185 },
        original,
      ),
    ).toEqual(["weight_kg", "running_max_heart_rate_override"]);
    expect(changedDraftFields(profileDraft(snapshot), original)).toEqual([]);
  });
  it("round-trips French dates and rejects impossible dates", () => {
    expect(parseFrenchBirthDate(frenchBirthDate("1991-06-14"))).toBe(
      "1991-06-14",
    );
    expect(
      profileDraftSchema.safeParse({
        ...profileDraft(snapshot),
        birth_date: parseFrenchBirthDate("31 / 02 / 1991"),
      }).success,
    ).toBe(false);
  });
});
describe("running maximum policy", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const run = {
    provider: "garmin",
    activityType: "trail_running",
    startedAt: "2026-09-27T08:00:00Z",
    maximum: 188,
  };
  it("excludes cycling, future and old runs, other providers and invalid values", () => {
    expect(eligibleRunningMaximum(run, now)).toBe(true);
    for (const patch of [
      { activityType: "cycling" },
      { provider: "other" },
      { startedAt: "2026-10-14T08:00:00Z" },
      { startedAt: "2025-10-12T08:00:00Z" },
      { maximum: 99 },
      { maximum: null },
    ])
      expect(eligibleRunningMaximum({ ...run, ...patch }, now)).toBe(false);
  });
  it("keeps the manual maximum until reverted, including newer imports", () => {
    expect(effectiveRunningMaximum(185, 200)).toBe(185);
    expect(effectiveRunningMaximum(null, 188)).toBe(188);
    expect(effectiveRunningMaximum(null, null)).toBeNull();
  });
});

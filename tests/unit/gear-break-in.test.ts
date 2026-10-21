import { describe, expect, it } from "vitest";
import { breakIn, racePair } from "@/features/gear/break-in";

const ecotrail = {
  id: "ecotrail",
  name: "EcoTrail Paris 120K",
  date: "2027-03-20",
  terrain: "trail" as const,
};
const vincennes = {
  id: "vincennes",
  name: "10K Vincennes",
  date: "2026-12-06",
  terrain: "road" as const,
};
const rocket = {
  id: "rocket",
  category: "race" as const,
  terrain: "road" as const,
  retired: false,
};
const zegama = {
  id: "zegama",
  category: "daily" as const,
  terrain: "trail" as const,
  retired: false,
};

describe("race pair break-in", () => {
  it.each([
    [12, "new"],
    [30, "breaking_in"],
    [49.9, "breaking_in"],
    [50, "broken_in"],
  ] as const)("%s km is %s", (km, status) => {
    expect(breakIn(km, 12).status).toBe(status);
  });

  it("uses the pair linked on the race gear list first", () => {
    expect(
      racePair(
        ecotrail,
        ["zegama"],
        [rocket, zegama],
        [vincennes, ecotrail],
        "2026-10-21",
      ),
    ).toEqual({ pairId: "zegama", source: "checklist" });
  });

  it("falls back to the race pair reserved for that race", () => {
    expect(
      racePair(
        vincennes,
        [],
        [rocket, zegama],
        [vincennes, ecotrail],
        "2026-10-21",
      ),
    ).toEqual({ pairId: "rocket", source: "reserved" });
    expect(
      racePair(
        ecotrail,
        [],
        [rocket, zegama],
        [vincennes, ecotrail],
        "2026-10-21",
      ),
    ).toBeNull();
  });

  it("ignores a retired linked pair", () => {
    expect(
      racePair(
        ecotrail,
        ["zegama"],
        [rocket, { ...zegama, retired: true }],
        [vincennes, ecotrail],
        "2026-10-21",
      ),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  reviewAgainstGpx,
  type RoadbookPoint,
} from "@/features/races/roadbook";

const point: RoadbookPoint = {
  kind: "aid",
  name: "Ravito des Crêtes",
  distanceM: 21000,
  cutoffMinutes: null,
  services: ["water"],
  needsReview: false,
};

describe("roadbook position review", () => {
  it("flags unmatched and conflicting imported positions", () => {
    expect(reviewAgainstGpx([point], [])[0].needsReview).toBe(true);
    expect(
      reviewAgainstGpx([point], [{ name: point.name, distanceM: 22000 }])[0]
        .needsReview,
    ).toBe(true);
    expect(
      reviewAgainstGpx([point], [{ name: point.name, distanceM: 21200 }])[0]
        .needsReview,
    ).toBe(false);
  });
});

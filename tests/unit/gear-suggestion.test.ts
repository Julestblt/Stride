import { describe, expect, it } from "vitest";
import {
  defaultGarminActivity,
  defaultLifespanKm,
} from "@/features/gear/model";
import { shoeSuggestion } from "@/features/gear/suggestion";

const known = {
  known: true,
  brand: " HOKA ",
  model: "Speedgoat",
  version: "7",
  category: "daily" as const,
  terrain: "trail" as const,
  description:
    "Très accrocheuse et bien amortie, pour les longues sorties sur sentiers techniques",
};

describe("shoe suggestion", () => {
  it("keeps a known model and ends the description with a period", () => {
    expect(shoeSuggestion(known)).toEqual({
      brand: "HOKA",
      model: "Speedgoat",
      version: "7",
      category: "daily",
      terrain: "trail",
      description:
        "Très accrocheuse et bien amortie, pour les longues sorties sur sentiers techniques.",
    });
  });

  it("returns nothing for an unknown model or an empty answer", () => {
    expect(shoeSuggestion({ ...known, known: false })).toBeNull();
    expect(
      shoeSuggestion({
        ...known,
        category: null,
        terrain: null,
        description: null,
      }),
    ).toBeNull();
  });

  it("drops a description longer than the column allows", () => {
    expect(
      shoeSuggestion({ ...known, description: "x".repeat(241) })?.description,
    ).toBeNull();
  });

  it("sets defaults from the type and terrain", () => {
    expect(defaultLifespanKm("race", "road")).toBe(400);
    expect(defaultLifespanKm("daily", "trail")).toBe(700);
    expect(defaultLifespanKm("daily", "road")).toBe(800);
    expect(defaultGarminActivity("trail")).toBe("trail_running");
    expect(defaultGarminActivity("mixed")).toBe("running");
  });
});

import { describe, expect, it } from "vitest";
import { appSectionLabel } from "@/features/app-shell/route-state";

describe("appSectionLabel", () => {
  it("names the app section from the first path segment", () => {
    expect(appSectionLabel("/activities/1f0c/details")).toBe("Activités");
    expect(appSectionLabel("/progress/health")).toBe("Progression");
    expect(appSectionLabel("/today")).toBe("Aujourd’hui");
  });

  it("falls back to Stride outside a known section", () => {
    expect(appSectionLabel("/")).toBe("Stride");
    expect(appSectionLabel("/inconnu")).toBe("Stride");
  });
});

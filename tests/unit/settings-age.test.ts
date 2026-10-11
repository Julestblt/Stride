import { describe, expect, it } from "vitest";
import { ageOn } from "@/features/settings/age";

describe("ageOn", () => {
  it("changes age on the birthday, including after a leap-year birth", () => {
    expect(ageOn("1991-06-14", "2026-06-13")).toBe(34);
    expect(ageOn("1991-06-14", "2026-06-14")).toBe(35);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2000-02-29", "2026-03-01")).toBe(26);
  });
});

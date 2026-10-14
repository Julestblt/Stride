import { describe, expect, it } from "vitest";
import {
  recentLabel,
  relativeSince,
  timelineCells,
} from "@/features/garmin/settings-view";

describe("timelineCells", () => {
  it("marks years before the oldest data as empty and the first year as partial", () => {
    const { years, cells } = timelineCells("2023-06-10", 2026);
    expect(years[0]).toBe(2018);
    expect(years.at(-1)).toBe(2026);
    expect(cells).toEqual([
      "none",
      "none",
      "none",
      "none",
      "none",
      "partial",
      "full",
      "full",
      "full",
    ]);
  });

  it("returns no coverage without a start date", () => {
    expect(
      timelineCells(null, 2026).cells.every((cell) => cell === "none"),
    ).toBe(true);
  });
});

describe("relative labels", () => {
  const now = new Date("2026-10-14T08:00:00Z");
  it("formats minutes, hours and days", () => {
    expect(relativeSince("2026-10-14T07:48:00Z", now)).toBe("il y a 12 min");
    expect(relativeSince("2026-10-14T05:00:00Z", now)).toBe("il y a 3 h");
    expect(relativeSince("2026-10-11T08:00:00Z", now)).toBe("il y a 3 j");
  });

  it("labels today with the clock time", () => {
    expect(recentLabel("2026-10-14T05:12:00Z", now)).toBe("Aujourd’hui 07:12");
  });
});

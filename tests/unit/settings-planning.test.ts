import { describe, expect, it } from "vitest";
import {
  defaultTimeZone,
  isTimeZone,
  isUnavailableOn,
  localToday,
  toPlanningConstraints,
} from "@/features/plans/constraints";
import {
  currentPeriods,
  formatPeriod,
  formatWeeklyCeiling,
  parseUnavailabilityInput,
  parseWeeklyCeiling,
  timeZoneLabel,
  timeZoneOptions,
} from "@/features/settings/planning";

const period = (id: string, starts_on: string, ends_on: string) => ({
  id,
  starts_on,
  ends_on,
  kind: "travel",
  reason: null,
  revision: 1,
});

describe("toPlanningConstraints", () => {
  it("falls back to Europe/Paris without a profile or with an unknown zone", () => {
    expect(toPlanningConstraints(null, []).timeZone).toBe(defaultTimeZone);
    expect(
      toPlanningConstraints(
        { time_zone: "Mars/Olympus", max_weekly_minutes: null },
        [],
      ).timeZone,
    ).toBe(defaultTimeZone);
  });

  it("keeps the athlete's zone, ceiling and sorted known periods", () => {
    const constraints = toPlanningConstraints(
      { time_zone: "America/New_York", max_weekly_minutes: 420 },
      [
        period("b", "2026-12-20", "2026-12-27"),
        period("a", "2026-11-10", "2026-11-12"),
        { ...period("c", "2026-11-01", "2026-11-02"), kind: "injury" },
      ],
    );
    expect(constraints.timeZone).toBe("America/New_York");
    expect(constraints.maxWeeklyMinutes).toBe(420);
    expect(constraints.unavailablePeriods.map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("tells whether a date falls in a period, bounds included", () => {
    const constraints = toPlanningConstraints(null, [
      period("a", "2026-11-10", "2026-11-12"),
    ]);
    expect(isUnavailableOn(constraints, "2026-11-10")).toBe(true);
    expect(isUnavailableOn(constraints, "2026-11-12")).toBe(true);
    expect(isUnavailableOn(constraints, "2026-11-13")).toBe(false);
  });
});

describe("time zones", () => {
  it("accepts IANA zones only", () => {
    expect(isTimeZone("Europe/Paris")).toBe(true);
    expect(isTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isTimeZone("UTC")).toBe(false);
    expect(isTimeZone("Europe/Atlantis")).toBe(false);
  });

  it("computes the local date in the athlete's zone", () => {
    const now = new Date("2026-10-14T23:30:00Z");
    expect(localToday("Europe/Paris", now)).toBe("2026-10-15");
    expect(localToday("America/New_York", now)).toBe("2026-10-14");
  });

  it("labels zones by city in French order", () => {
    expect(timeZoneLabel("America/Argentina/Buenos_Aires")).toBe(
      "Buenos Aires (America / Argentina)",
    );
    const options = timeZoneOptions();
    expect(options).toContainEqual({
      value: "Europe/Paris",
      label: "Paris (Europe)",
    });
    expect(options.every((option) => option.value.includes("/"))).toBe(true);
  });
});

describe("parseWeeklyCeiling", () => {
  it("reads hours in the usual French forms", () => {
    expect(parseWeeklyCeiling("6")).toBe(360);
    expect(parseWeeklyCeiling("6 h")).toBe(360);
    expect(parseWeeklyCeiling("6h30")).toBe(390);
    expect(parseWeeklyCeiling("6 h 30")).toBe(390);
    expect(parseWeeklyCeiling("6:30")).toBe(390);
    expect(parseWeeklyCeiling("6,5")).toBe(390);
  });

  it("treats an empty value as no ceiling", () => {
    expect(parseWeeklyCeiling("  ")).toBeNull();
  });

  it("rejects values outside one to forty hours or malformed", () => {
    expect(parseWeeklyCeiling("0,5")).toBeUndefined();
    expect(parseWeeklyCeiling("1")).toBe(60);
    expect(parseWeeklyCeiling("40")).toBe(2_400);
    expect(parseWeeklyCeiling("40 h 30")).toBeUndefined();
    expect(parseWeeklyCeiling("6h75")).toBeUndefined();
    expect(parseWeeklyCeiling("beaucoup")).toBeUndefined();
  });

  it("formats a ceiling back for editing", () => {
    expect(formatWeeklyCeiling(390)).toBe("6 h 30");
    expect(formatWeeklyCeiling(360)).toBe("6 h");
    expect(formatWeeklyCeiling(null)).toBe("");
    expect(parseWeeklyCeiling(formatWeeklyCeiling(425))).toBe(425);
  });
});

describe("parseUnavailabilityInput", () => {
  const input = {
    start: "10/11/2026",
    end: "16/11/2026",
    kind: "travel",
    reason: "  Congrès  ",
  };

  it("converts French dates and trims the reason", () => {
    expect(parseUnavailabilityInput(input)).toEqual({
      ok: true,
      value: {
        starts_on: "2026-11-10",
        ends_on: "2026-11-16",
        kind: "travel",
        reason: "Congrès",
      },
    });
    expect(
      parseUnavailabilityInput({ ...input, end: "10/11/2026", reason: "" }),
    ).toMatchObject({ ok: true, value: { reason: null } });
  });

  it("explains each invalid input", () => {
    const error = (patch: Partial<typeof input>) => {
      const result = parseUnavailabilityInput({ ...input, ...patch });
      return result.ok ? null : result.error;
    };
    expect(error({ start: "31/02/2026" })).toBe("dates");
    expect(error({ end: "" })).toBe("dates");
    expect(error({ end: "09/11/2026" })).toBe("order");
    expect(error({ end: "11/11/2027" })).toBe("length");
    expect(error({ kind: "injury" })).toBe("kind");
    expect(error({ reason: "x".repeat(121) })).toBe("reason");
  });
});

describe("period display", () => {
  it("formats single days and ranges in French", () => {
    expect(formatPeriod({ startsOn: "2026-11-10", endsOn: "2026-11-10" })).toBe(
      "Le 10/11/2026",
    );
    expect(formatPeriod({ startsOn: "2026-11-10", endsOn: "2026-11-16" })).toBe(
      "Du 10/11/2026 au 16/11/2026",
    );
  });

  it("hides periods that ended before today", () => {
    const { unavailablePeriods } = toPlanningConstraints(null, [
      period("past", "2026-10-01", "2026-10-13"),
      period("ongoing", "2026-10-10", "2026-10-14"),
      period("next", "2026-11-10", "2026-11-12"),
    ]);
    expect(
      currentPeriods(unavailablePeriods, "2026-10-14").map((item) => item.id),
    ).toEqual(["ongoing", "next"]);
  });
});

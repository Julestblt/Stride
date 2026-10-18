import { describe, expect, it } from "vitest";
import {
  calendarBand,
  calendarRules,
  checkCalendar,
  kmEffort,
  roleOfPriority,
  type CalendarRaceInput,
} from "@/features/races/calendar";

function race(
  id: string,
  date: string | null,
  distanceKm: number | null,
  role: CalendarRaceInput["role"],
  extra: Partial<CalendarRaceInput> = {},
): CalendarRaceInput {
  return {
    id,
    name: id,
    date,
    distanceKm,
    elevationGainM: null,
    kind: "road",
    role,
    ...extra,
  };
}

function codes(inputs: CalendarRaceInput[]) {
  return checkCalendar(inputs).conflicts.map((conflict) => conflict.code);
}

describe("kmEffort and bands", () => {
  it("adds one km per 100 m of gain on trail and ignores gain on road", () => {
    expect(kmEffort(10, 500, "trail")).toBe(15);
    expect(kmEffort(10, 500, "road")).toBe(10);
    expect(kmEffort(120, 1459, "trail")).toBe(134.6);
  });

  it.each([
    [15, 14, 10],
    [15.1, 21, 14],
    [30, 21, 14],
    [30.1, 28, 14],
    [60, 28, 14],
    [60.1, 42, 21],
  ])("uses the band of a %s km-effort race", (effort, recovery, taper) => {
    const band = calendarBand(effort);
    expect(band.recoveryDays).toBe(recovery);
    expect(band.taperDays).toBe(taper);
  });

  it("exposes the thresholds table", () => {
    expect(calendarRules.bands).toHaveLength(4);
    expect(calendarRules.funBeforeHardRaceDays).toBe(7);
  });

  it("maps priorities to roles", () => {
    expect(roleOfPriority("A")).toBe("primary");
    expect(roleOfPriority("B")).toBe("preparation");
    expect(roleOfPriority("C")).toBe("fun");
  });
});

describe("checkCalendar", () => {
  it("labels French weekdays and weekends", () => {
    const days = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    const result = checkCalendar(
      days.map((date) => race(date, date, 5, "fun")),
    );
    expect(result.races.map((item) => item.weekday)).toEqual([
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
      "dimanche",
    ]);
    expect(result.races.map((item) => item.weekend)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("accepts a valid season and describes its windows", () => {
    const result = checkCalendar(
      [
        race("ultra", "2027-03-20", 120, "primary", {
          kind: "trail",
          elevationGainM: 1459,
        }),
        race("ten", "2026-12-06", 10, "preparation"),
      ],
      { today: "2026-10-18" },
    );
    expect(result.conflicts).toEqual([]);
    expect(result.races.map((item) => item.id)).toEqual(["ten", "ultra"]);
    const [ten, ultra] = result.races;
    expect(ten).toMatchObject({
      dateLabel: "06/12/2026",
      weekday: "dimanche",
      weekend: true,
      daysFromToday: 49,
      kmEffort: 10,
      recoveryDays: 14,
      recoveryEndsOn: "2026-12-20",
      taperDays: null,
      taperStartsOn: null,
    });
    expect(ultra).toMatchObject({
      dateLabel: "20/03/2027",
      weekday: "samedi",
      kmEffort: 134.6,
      recoveryDays: 42,
      taperDays: 21,
      taperStartsOn: "2027-02-27",
    });
    expect(result.gaps).toEqual([
      { fromRaceId: "ten", toRaceId: "ultra", days: 104, weeks: 14.9 },
    ]);
  });

  it("flags a fun race inside the primary taper", () => {
    const result = checkCalendar([
      race("half", "2027-04-11", 21.1, "primary"),
      race("fun", "2027-04-04", 5, "fun"),
    ]);
    expect(result.conflicts).toEqual([
      {
        code: "inside_taper",
        firstRaceId: "fun",
        secondRaceId: "half",
        requiredDays: 14,
        actualDays: 7,
      },
    ]);
  });

  it("flags a preparation race whose recovery overlaps the taper", () => {
    const result = checkCalendar([
      race("ten", "2027-03-21", 10, "preparation"),
      race("marathon", "2027-04-11", 42.2, "primary"),
    ]);
    expect(result.conflicts).toEqual([
      {
        code: "preparation_recovery_overlaps_taper",
        firstRaceId: "ten",
        secondRaceId: "marathon",
        requiredDays: 28,
        actualDays: 21,
      },
    ]);
    expect(
      codes([
        race("ten", "2027-03-14", 10, "preparation"),
        race("marathon", "2027-04-11", 42.2, "primary"),
      ]),
    ).toEqual([]);
  });

  it("requires the full recovery before a race run hard", () => {
    expect(
      checkCalendar([
        race("first", "2027-01-10", 21.1, "preparation"),
        race("second", "2027-01-24", 21.1, "preparation"),
      ]).conflicts,
    ).toEqual([
      {
        code: "recovery_too_short",
        firstRaceId: "first",
        secondRaceId: "second",
        requiredDays: 21,
        actualDays: 14,
      },
    ]);
  });

  it("requires the previous primary recovery before a new primary", () => {
    expect(
      codes([
        race("first", "2027-01-10", 42.2, "primary"),
        race("second", "2027-01-30", 42.2, "primary"),
      ]),
    ).toEqual(["recovery_too_short"]);
    expect(
      codes([
        race("first", "2027-01-10", 42.2, "primary"),
        race("second", "2027-02-09", 42.2, "primary"),
      ]),
    ).toEqual([]);
  });

  it("checks the last hard race recovery across a fun race", () => {
    expect(
      codes([
        race("first", "2027-01-10", 21.1, "preparation"),
        race("fun", "2027-01-21", 5, "fun"),
        race("second", "2027-01-28", 21.1, "preparation"),
      ]),
    ).toEqual(["recovery_too_short"]);
  });

  it("requires seven days between a fun race and the next hard race", () => {
    expect(
      checkCalendar([
        race("fun", "2027-01-10", 50, "fun", { kind: "trail" }),
        race("ten", "2027-01-15", 10, "preparation"),
      ]).conflicts,
    ).toEqual([
      {
        code: "fun_too_close",
        firstRaceId: "fun",
        secondRaceId: "ten",
        requiredDays: 7,
        actualDays: 5,
      },
    ]);
  });

  it("lets a fun race follow once half the recovery has passed", () => {
    expect(
      checkCalendar([
        race("marathon", "2027-01-10", 42.2, "preparation"),
        race("fun", "2027-01-20", 5, "fun"),
      ]).conflicts,
    ).toEqual([
      {
        code: "fun_too_soon",
        firstRaceId: "marathon",
        secondRaceId: "fun",
        requiredDays: 14,
        actualDays: 10,
      },
    ]);
    expect(
      codes([
        race("marathon", "2027-01-10", 42.2, "preparation"),
        race("fun", "2027-01-24", 5, "fun"),
      ]),
    ).toEqual([]);
  });

  it("returns undated and incomplete races without applying gap rules", () => {
    const undated = race("undated", null, 21.1, "preparation");
    const incomplete = race("incomplete", "2027-01-12", null, "preparation");
    const result = checkCalendar([
      race("ten", "2027-01-10", 10, "preparation"),
      undated,
      incomplete,
    ]);
    expect(result.undated).toEqual([undated]);
    expect(result.incomplete).toEqual([incomplete]);
    expect(result.races.map((item) => item.id)).toEqual(["ten"]);
    expect(result.gaps).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });
});

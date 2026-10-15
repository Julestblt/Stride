import { describe, expect, it } from "vitest";
import type { PlanState } from "@/features/plans/model/plan";
import {
  buildProgram,
  chartDescription,
  programNavigation,
  sessionFamilyOf,
  withRaceValues,
  type ProgramInput,
} from "@/features/plans/view/program";
import { easyRun, planState, thresholdSession } from "./plan-fixture";

function input(overrides: Partial<ProgramInput> = {}): ProgramInput {
  return {
    state: planState(),
    today: "2026-10-21",
    summary: "Quatre semaines de base.",
    matches: [],
    proposalKeys: [],
    races: [
      {
        id: "race-a",
        name: "Marathon de Paris",
        date: "2026-11-08",
        priority: "A",
        targetSeconds: null,
        distanceKm: null,
        elevationGainM: null,
      },
    ],
    ...overrides,
  };
}

function withRace(state: PlanState): PlanState {
  return {
    ...state,
    weeks: state.weeks.map((week, index) =>
      index === 1 ? { ...week, weekType: "recovery" } : week,
    ),
    sessions: [
      ...state.sessions,
      {
        ...easyRun(180),
        kind: "race",
        title: "Marathon de Paris",
        sessionKey: "s-2026-11-08-1",
        scheduledOn: "2026-11-08",
        targets: {
          durationSeconds: 10_800,
          distanceMeters: 42_195,
          elevationGainMeters: null,
        },
      },
    ],
  };
}

describe("program overview", () => {
  it("builds the primary program header from the stored plan", () => {
    const [program] = buildProgram(input()).programs;
    expect(program).toMatchObject({
      raceId: "race-a",
      tab: null,
      eyebrow: "Semaine 2 sur 4 · Base",
      title: "J-18 · Marathon de Paris",
      summary: "Quatre semaines de base.",
      nested: [],
      defaultWeekKey: "w-2026-10-19",
    });
    expect(program.kpis.map((kpi) => [kpi.label, kpi.value])).toEqual([
      ["Total prévu", "5 h"],
      ["Plus longue sortie", "1h30"],
      ["Semaine de pic", "3h10"],
    ]);
    expect(program.bands).toEqual([
      {
        key: "b-base-1",
        name: "Base",
        start: 0,
        span: 4,
        tone: "dim",
        current: true,
      },
    ]);
  });

  it("labels weeks from their type and a race week from the race", () => {
    const program = buildProgram(input({ state: withRace(planState()) }));
    expect(
      program.weeks.map((week) => [week.number, week.label, week.labelTone]),
    ).toEqual([
      [1, "Construction", "muted"],
      [2, "Allégée", "provider"],
      [3, "Construction", "muted"],
      [4, "Marathon de Paris · objectif", "accent"],
    ]);
    expect(program.weeks[3].race).toEqual({ letter: "A", primary: true });
    expect(program.weeks[1].isLight).toBe(true);
  });

  it("gives each day the family of its main session and rests elsewhere", () => {
    const [first] = buildProgram(input()).weeks;
    expect(first.families).toEqual([
      "rest",
      "easy",
      "rest",
      "threshold",
      "rest",
      "rest",
      "rest",
    ]);
    expect(first.totals.durationSeconds).toBe(5_700);
    expect(first.easySeconds + first.qualitySeconds).toBe(6_000);
    expect(first.qualitySeconds).toBe(4 * 360);
  });

  it("derives past completion and current progress from matching", () => {
    const program = buildProgram(
      input({
        matches: [
          {
            sessionKey: "s-2026-10-13-1",
            status: "completed",
            compliance: { duration: 0.98, distance: null },
          },
          {
            sessionKey: "s-2026-10-20-1",
            status: "partial",
            compliance: { duration: 0.6, distance: null },
          },
        ],
      }),
    );
    const [past, current, future] = program.weeks;
    expect(past.status).toBe("past");
    expect(past.completionPct).toBe(50);
    expect(current.status).toBe("current");
    expect(current.completionPct).toBeNull();
    expect(future.status).toBe("future");
    expect(program.currentWeekKey).toBe(current.weekKey);
    expect(current.done.durationSeconds).toBe(1_800);
    const tuesday = current.days[1];
    expect(tuesday).toMatchObject({
      state: "partial",
      compliancePct: 60,
      title: "Footing",
      summary: "50’",
    });
    expect(current.days[0]).toMatchObject({ family: "rest", state: "done" });
    expect(current.days[2]).toMatchObject({ isToday: true, state: null });
    expect(past.days[1]).toMatchObject({ state: "done", compliancePct: 98 });
    expect(past.days[3]).toMatchObject({ state: "missed" });
  });

  it("marks sessions targeted by a ready proposal", () => {
    const program = buildProgram(
      input({ proposalKeys: ["session:s-2026-10-22-1"] }),
    );
    const current = program.weeks[1];
    expect(current.proposed).toBe(true);
    expect(current.days[3].state).toBe("proposed");
    expect(program.weeks[0].proposed).toBe(false);
  });

  it("groups weeks by block with totals", () => {
    const [block] = buildProgram(input()).blocks;
    expect(block).toMatchObject({
      index: 1,
      name: "Base",
      span: "12 oct. → 8 nov. · 4 semaines",
      months: "oct.–nov.",
      current: true,
    });
    expect(block.totals.durationSeconds).toBe(5_700 + 11_400);
  });

  it("falls back to the plan title without a primary race", () => {
    const { programs } = buildProgram(input({ races: [] }));
    expect(programs).toHaveLength(1);
    expect(programs[0]).toMatchObject({
      raceId: null,
      tab: null,
      title: "Marathon de Paris",
    });
  });

  it("uses the target time in the title when the race has one", () => {
    const [program] = buildProgram(
      input({
        races: [
          {
            id: "race-a",
            name: "Marathon de Paris",
            date: "2026-11-08",
            priority: "A",
            targetSeconds: 11_400,
            distanceKm: null,
            elevationGainM: null,
          },
        ],
      }),
    ).programs;
    expect(program.title).toBe("Marathon de Paris · cible 3:10:00");
  });

  it("describes the volume chart", () => {
    const { weeks } = buildProgram(input());
    expect(chartDescription(weeks)).toBe(
      "Volume hebdomadaire prévu sur 4 semaines, de 0’ à 3h15",
    );
  });
});

function withNestedRace(state: PlanState): PlanState {
  return {
    ...state,
    plan: {
      ...state.plan,
      raceRoles: [
        { raceId: "race-a", role: "primary" },
        { raceId: "race-c", role: "secondary" },
      ],
    },
    blocks: [
      { ...state.blocks[0], endsOn: "2026-10-25" },
      {
        blockKey: "b-specific-1",
        kind: "specific",
        name: "Vitesse",
        startsOn: "2026-10-26",
        endsOn: "2026-11-08",
        objective: "La qualité devient de la vitesse.",
        raceId: "race-c",
      },
    ],
    weeks: state.weeks.map((week, index) =>
      index >= 2 ? { ...week, blockKey: "b-specific-1" } : week,
    ),
    sessions: [
      ...state.sessions,
      {
        ...thresholdSession(),
        sessionKey: "s-2026-10-28-1",
        scheduledOn: "2026-10-28",
      },
    ],
  };
}

const nestedRaces: ProgramInput["races"] = [
  {
    id: "race-a",
    name: "Marathon de Paris",
    date: "2026-11-08",
    priority: "A",
    targetSeconds: null,
    distanceKm: null,
    elevationGainM: null,
  },
  {
    id: "race-c",
    name: "10K Vincennes",
    date: "2026-11-01",
    priority: "C",
    targetSeconds: 2_670,
    distanceKm: null,
    elevationGainM: null,
  },
];

describe("race values", () => {
  const races = (
    distanceKm: number | null,
    elevationGainM: number | null,
  ): ProgramInput["races"] => [
    {
      id: "race-a",
      name: "Marathon de Paris",
      date: "2026-11-08",
      priority: "A",
      targetSeconds: null,
      distanceKm,
      elevationGainM,
    },
  ];
  const raceSession = (state: PlanState) =>
    state.sessions.find((session) => session.kind === "race")!;

  it("applies the resolved race distance and elevation to its race session", () => {
    const state = withRaceValues(withRace(planState()), races(48.9, 1_210));
    expect(raceSession(state).targets).toEqual({
      durationSeconds: 10_800,
      distanceMeters: 48_900,
      elevationGainMeters: 1_210,
    });
    const week = buildProgram(input({ state, races: races(48.9, 1_210) }))
      .weeks[3];
    const day = week.days.find((item) => item.date === "2026-11-08")!;
    expect(day.summary).toBe("48,9 km");
    expect(day.elevation).toBe("1\u202f210 m D+");
    expect(week.totals.distanceEstimated).toBe(false);
  });

  it("keeps stored targets for missing values and unmatched sessions", () => {
    const base = withRace(planState());
    expect(
      raceSession(withRaceValues(base, races(null, null))).targets,
    ).toEqual(raceSession(base).targets);
    expect(withRaceValues(base, [])).toBe(base);
    const elsewhere = races(48.9, 1_210).map((race) => ({
      ...race,
      date: "2026-11-15",
    }));
    expect(raceSession(withRaceValues(base, elsewhere)).targets).toEqual(
      raceSession(base).targets,
    );
  });

  it("links a race day to the plan race before another race that day", () => {
    const other = {
      ...races(null, null)[0],
      id: "race-other",
      name: "Course du même jour",
      priority: "C" as const,
    };
    const week = buildProgram(
      input({
        state: withRace(planState()),
        races: [other, ...races(null, null)],
      }),
    ).weeks[3];
    expect(week.days.find((day) => day.date === "2026-11-08")!.raceId).toBe(
      "race-a",
    );
  });

  it("links race days to their race and leaves other days to the panel", () => {
    const week = buildProgram(input({ state: withRace(planState()) })).weeks[3];
    const raceDay = week.days.find((day) => day.date === "2026-11-08")!;
    expect(raceDay.raceId).toBe("race-a");
    expect(week.days.filter((day) => day.raceId !== null)).toHaveLength(1);
    const unmatched = buildProgram(
      input({ state: withRace(planState()), races: [] }),
    ).weeks[3].days.find((day) => day.date === "2026-11-08")!;
    expect(unmatched.raceId).toBeNull();
    expect(unmatched.sessionKey).toBe("s-2026-11-08-1");
  });
});

describe("race programs", () => {
  it("adds a tab and a nested program for a race attached to blocks", () => {
    const [main, nested] = buildProgram(
      input({ state: withNestedRace(planState()), races: nestedRaces }),
    ).programs;
    expect(main.tab).toEqual({
      letter: "A",
      name: "Marathon de Paris",
      when: "dim. 8 nov. · J-18",
      detail: "S2 / 4",
      primary: true,
    });
    expect(main.nested).toEqual([
      {
        raceId: "race-c",
        letter: "C",
        name: "10K Vincennes",
        start: 2,
        span: 2,
      },
    ]);
    expect(
      main.bands.map((band) => [band.name, band.start, band.span]),
    ).toEqual([
      ["Base", 0, 2],
      ["Vitesse", 2, 2],
    ]);
    expect(main.weeks[2]).toMatchObject({
      label: "10K Vincennes · C",
      race: { letter: "C", primary: false },
    });
    expect(nested).toMatchObject({
      raceId: "race-c",
      tab: {
        letter: "C",
        name: "10K Vincennes",
        when: "dim. 1 nov. · J-11",
        detail: "débute le 26 oct.",
        primary: false,
      },
      eyebrow: "2 semaines · débute dans 5 jours",
      title: "10K Vincennes · cible 44:30",
      summary:
        "S’insère dans ton programme Marathon de Paris, semaines 3 à 4. La qualité devient de la vitesse.",
      defaultWeekKey: "w-2026-10-26",
    });
    expect(nested.weeks.map((week) => [week.number, week.weekKey])).toEqual([
      [1, "w-2026-10-26"],
      [2, "w-2026-11-02"],
    ]);
    expect(nested.kpis.map((kpi) => [kpi.label, kpi.value])).toEqual([
      ["Total", "50’"],
      ["De qualité", "1 séance"],
    ]);
  });

  it("derives upcoming milestones from the plan", () => {
    const state = withNestedRace(withRace(planState()));
    const [main] = buildProgram(input({ state, races: nestedRaces })).programs;
    expect(
      main.milestones.map((milestone) => [
        milestone.number,
        milestone.label,
        milestone.when,
      ]),
    ).toEqual([
      [2, "Allégée", "19–25 oct."],
      [2, "Pic de volume", "19–25 oct."],
      [3, "10K Vincennes", "dim. 1 nov."],
    ]);
  });
});

describe("session families", () => {
  it("separates trail long runs and maps recovery to easy", () => {
    const long = { ...easyRun(120), kind: "long" as const };
    const placed = { sessionKey: "s-1", scheduledOn: "2026-10-12" };
    expect(sessionFamilyOf({ ...long, ...placed })).toBe("long");
    expect(sessionFamilyOf({ ...long, sport: "trail", ...placed })).toBe(
      "long_trail",
    );
    expect(
      sessionFamilyOf({ ...easyRun(30), kind: "recovery", ...placed }),
    ).toBe("easy");
  });
});

describe("program navigation", () => {
  it("lists blocks and weeks with durations and states", () => {
    const nav = programNavigation(
      buildProgram(input({ state: withRace(planState()) })),
    );
    expect(nav.weekCount).toBe(4);
    expect(nav.blocks).toHaveLength(1);
    expect(nav.blocks[0]).toMatchObject({
      name: "Base",
      months: "oct.–nov.",
      status: "current",
    });
    expect(
      nav.blocks[0].weeks.map((week) => [week.label, week.status]),
    ).toEqual([
      ["Semaine 1", "past"],
      ["Semaine 2 · allégée", "current"],
      ["Semaine 3", "future"],
      ["Semaine 4", "future"],
    ]);
  });
});

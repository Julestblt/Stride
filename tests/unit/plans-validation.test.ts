import { describe, expect, it } from "vitest";
import { mondayOf } from "@/features/plans/model/dates";
import type {
  PlanSession,
  PlanState,
  PlanWeek,
} from "@/features/plans/model/plan";
import type { SimpleStep } from "@/features/plans/model/structure";
import type { ValidationInput } from "@/features/plans/validation/input";
import {
  validationReportSchema,
  type RuleId,
} from "@/features/plans/validation/report";
import { validatePlan } from "@/features/plans/validation/validate";

const today = "2026-10-14";

const step = (
  minutes: number,
  intensity: SimpleStep["intensity"],
): SimpleStep => ({
  type: "work",
  end: { kind: "time", seconds: Math.round(minutes * 60) },
  target: { kind: "rpe", min: 3, max: 8 },
  intensity,
});

type RunOptions = {
  kind?: PlanSession["kind"];
  sport?: PlanSession["sport"];
  distance?: number | null;
  elevation?: number | null;
  hardMinutes?: number;
};

const run = (
  key: string,
  date: string,
  minutes: number,
  options: RunOptions = {},
): PlanSession => {
  const kind = options.kind ?? "easy";
  const hard = options.hardMinutes ?? 0;
  return {
    sessionKey: key,
    scheduledOn: date,
    sport: options.sport ?? "run",
    kind,
    title: "Séance",
    purpose: "Test",
    isKey: kind !== "easy",
    priority: "normal",
    targets: {
      durationSeconds: Math.round(minutes * 60),
      distanceMeters: options.distance ?? null,
      elevationGainMeters: options.elevation ?? null,
    },
    structure:
      hard > 0
        ? [step(minutes - hard, "easy"), step(hard, "threshold")]
        : [step(minutes, "easy")],
    terrain: "road",
    origin: "template",
    contingencies: [],
  };
};

const state = (
  sessions: PlanSession[],
  weekTypes: Record<string, PlanWeek["weekType"]> = {},
  primaryRaceId: string | null = null,
): PlanState => {
  const mondays = [
    ...new Set(sessions.map((session) => mondayOf(session.scheduledOn))),
  ].sort();
  return {
    plan: {
      id: "plan",
      title: "Plan",
      startsOn: "2026-10-12",
      endsOn: "2027-01-31",
      timeZone: "Europe/Paris",
      primaryRaceId,
      raceRoles: [],
      confidence: { level: "normal", reasons: [] },
    },
    blocks: [
      {
        blockKey: "b-base-1",
        kind: "base",
        name: "Base",
        startsOn: "2026-10-12",
        endsOn: "2027-01-31",
        objective: "Construire",
        raceId: null,
      },
    ],
    weeks: mondays.map((weekStart) => ({
      weekKey: `w-${weekStart}`,
      weekStart,
      blockKey: "b-base-1",
      weekType: weekTypes[weekStart] ?? "build",
      targets: {
        durationSeconds: 0,
        distanceMeters: null,
        elevationGainMeters: null,
        qualitySessions: 0,
        longRunSeconds: null,
        intensitySplit: { easyPct: 80, moderatePct: 5, hardPct: 15 },
      },
      notes: null,
    })),
    sessions,
  };
};

const input = (
  candidate: PlanState,
  patch: Partial<ValidationInput> = {},
): ValidationInput => ({
  candidate,
  base: null,
  versions: null,
  today,
  matchedSessionKeys: new Set(),
  athlete: {
    availableWeekdays: null,
    weekdaySessionMinutes: null,
    maxWeeklyMinutes: null,
    unavailablePeriods: [],
  },
  races: [],
  history: { runs: [], weeks: [] },
  health: null,
  load: null,
  demands: null,
  specialistConstraints: [],
  ...patch,
});

const rule = (value: ValidationInput, id: RuleId) =>
  validatePlan(value).results.find((result) => result.ruleId === id)!;

const athlete = (patch: Partial<ValidationInput["athlete"]>) => ({
  athlete: { ...input(state([])).athlete, ...patch },
});

describe("report", () => {
  it("lists every rule once, validates against its schema and is stable", () => {
    const value = input(state([run("s1", "2026-10-15", 40)]));
    const report = validatePlan(value);
    expect(validationReportSchema.safeParse(report).success).toBe(true);
    expect(report.results.map((result) => result.ruleId)).toHaveLength(21);
    expect(validatePlan(value)).toEqual(report);
    expect(report.valid).toBe(true);
    expect(report.thresholdsVersion).toBe("2026-10-14");
  });

  it("never passes a rule silently when its data is missing", () => {
    const report = validatePlan(input(state([run("s1", "2026-10-15", 40)])));
    for (const id of ["I2", "C1", "C2", "C3", "H1", "E1", "P1", "P8", "D1"])
      expect(
        report.results.find((result) => result.ruleId === id)?.outcome,
      ).toBe("skipped");
  });

  it("is invalid only when a blocking rule fails", () => {
    const candidate = state([run("s1", "2026-10-15", 200)]);
    const warnOnly = validatePlan(
      input(candidate, {
        history: {
          runs: ["2026-10-01", "2026-10-05", "2026-10-10"].map((date) => ({
            date,
            durationSeconds: 3_600,
            distanceMeters: null,
          })),
          weeks: [],
        },
      }),
    );
    expect(
      warnOnly.results.find((result) => result.ruleId === "E1")?.outcome,
    ).toBe("fail");
    expect(warnOnly.valid).toBe(true);
    const blocked = validatePlan(
      input(candidate, athlete({ availableWeekdays: [1] })),
    );
    expect(blocked.valid).toBe(false);
  });
});

describe("integrity", () => {
  const base = state([
    run("past", "2026-10-13", 40),
    run("next", "2026-10-16", 40),
  ]);

  it("I1 blocks changes to past or matched sessions", () => {
    expect(rule(input(base, { base }), "I1").outcome).toBe("pass");
    const removedPast = state([base.sessions[1]]);
    expect(rule(input(removedPast, { base }), "I1")).toMatchObject({
      outcome: "fail",
      keys: ["past"],
    });
    const changedMatched = state([
      base.sessions[0],
      { ...base.sessions[1], title: "Autre" },
    ]);
    expect(
      rule(
        input(changedMatched, { base, matchedSessionKeys: new Set(["next"]) }),
        "I1",
      ).outcome,
    ).toBe("fail");
    expect(
      rule(input(state([run("old", "2026-10-13", 30)])), "I1").outcome,
    ).toBe("fail");
  });

  it("I2 checks the base version", () => {
    const value = state([run("s1", "2026-10-15", 40)]);
    expect(
      rule(input(value, { versions: { expected: 3, current: 3 } }), "I2")
        .outcome,
    ).toBe("pass");
    expect(
      rule(input(value, { versions: { expected: 3, current: 4 } }), "I2")
        .outcome,
    ).toBe("fail");
  });

  it("I3 blocks a structurally invalid state", () => {
    const value = state([run("s1", "2026-10-15", 40)]);
    expect(rule(input(value), "I3").outcome).toBe("pass");
    const broken = {
      ...value,
      weeks: [{ ...value.weeks[0], weekStart: "2026-10-13" }],
    };
    expect(rule(input(broken), "I3").outcome).toBe("fail");
  });

  it("I4 keeps A races in the plan", () => {
    const races = [
      {
        id: "race-a",
        date: "2026-11-15",
        priority: "A" as const,
        distanceKm: 42.2,
      },
    ];
    expect(
      rule(input(state([run("s1", "2026-10-15", 40)]), { races }), "I4"),
    ).toMatchObject({
      outcome: "fail",
      keys: ["race-a"],
    });
    expect(
      rule(
        input(state([run("race", "2026-11-15", 240, { kind: "race" })]), {
          races,
        }),
        "I4",
      ).outcome,
    ).toBe("pass");
  });
});

describe("athlete constraints", () => {
  it("C1 blocks unavailable days, periods and extra running days", () => {
    const thursday = state([run("s1", "2026-10-15", 40)]);
    expect(
      rule(input(thursday, athlete({ availableWeekdays: [4] })), "C1").outcome,
    ).toBe("pass");
    expect(
      rule(input(thursday, athlete({ availableWeekdays: [2] })), "C1"),
    ).toMatchObject({
      outcome: "fail",
      keys: ["s1"],
    });
    expect(
      rule(
        input(
          thursday,
          athlete({
            unavailablePeriods: [
              { startsOn: "2026-10-15", endsOn: "2026-10-15" },
            ],
          }),
        ),
        "C1",
      ).outcome,
    ).toBe("fail");
    const twoDays = state([
      run("s1", "2026-10-15", 40),
      run("s2", "2026-10-16", 40),
    ]);
    expect(
      rule(input(twoDays, athlete({ availableWeekdays: [4, 5] })), "C1")
        .outcome,
    ).toBe("pass");
    expect(
      rule(
        input(
          twoDays,
          athlete({ availableWeekdays: [4], unavailablePeriods: [] }),
        ),
        "C1",
      ).issues,
    ).toContain("too_many_running_days:2026-10-12");
  });

  it("C2 caps weekday sessions with the 10% tolerance, long runs excepted", () => {
    const cap = athlete({ weekdaySessionMinutes: 60 });
    expect(
      rule(input(state([run("s1", "2026-10-15", 66)]), cap), "C2").outcome,
    ).toBe("pass");
    expect(
      rule(input(state([run("s1", "2026-10-15", 66.1)]), cap), "C2").outcome,
    ).toBe("fail");
    expect(
      rule(
        input(state([run("s1", "2026-10-15", 120, { kind: "long" })]), cap),
        "C2",
      ).outcome,
    ).toBe("pass");
    expect(
      rule(input(state([run("s1", "2026-10-17", 120)]), cap), "C2").outcome,
    ).toBe("pass");
    expect(
      rule(
        input(
          state([run("s1", "2026-10-15", 120)]),
          athlete({ weekdaySessionMinutes: 90 }),
        ),
        "C2",
      ).outcome,
    ).toBe("skipped");
  });

  it("C2 enforces the weekly ceiling", () => {
    const week = (minutes: number) =>
      state([
        run("s1", "2026-10-15", 150),
        run("s2", "2026-10-18", minutes, { kind: "long" }),
      ]);
    const ceiling = athlete({ maxWeeklyMinutes: 300 });
    expect(rule(input(week(149), ceiling), "C2").outcome).toBe("pass");
    expect(rule(input(week(150), ceiling), "C2").outcome).toBe("pass");
    expect(rule(input(week(151), ceiling), "C2")).toMatchObject({
      outcome: "fail",
      issues: ["weekly_ceiling:2026-10-12"],
    });
  });

  it("C3 applies specialist constraints", () => {
    const value = state([
      run("q", "2026-10-15", 50, { kind: "threshold", hardMinutes: 20 }),
    ]);
    expect(rule(input(value), "C3").outcome).toBe("skipped");
    const constraint = {
      kind: "no_quality" as const,
      from: "2026-10-14",
      to: "2026-10-20",
      source: "recovery",
    };
    expect(
      rule(input(value, { specialistConstraints: [constraint] }), "C3").outcome,
    ).toBe("fail");
    expect(
      rule(
        input(value, {
          specialistConstraints: [{ ...constraint, from: "2026-10-16" }],
        }),
        "C3",
      ).outcome,
    ).toBe("pass");
  });
});

describe("health", () => {
  const condition = (severity: number, patch = {}) => ({
    health: {
      conditions: [
        {
          kind: "pain" as const,
          severity,
          status: "active" as const,
          worsening: false,
          systemicSymptoms: false,
          redFlag: false,
          ...patch,
        },
      ],
      readiness: [],
    },
  });
  const value = state([
    run("easy", "2026-10-15", 40),
    run("q", "2026-10-16", 50, { kind: "threshold", hardMinutes: 20 }),
    run("later", "2026-10-21", 40),
  ]);

  it("H1 stops running at 7/10 and on red flags", () => {
    expect(rule(input(value, condition(6)), "H1").outcome).toBe("pass");
    expect(rule(input(value, condition(7)), "H1")).toMatchObject({
      outcome: "fail",
      keys: ["easy", "q"],
      issues: ["referral"],
    });
    expect(
      rule(input(value, condition(2, { redFlag: true })), "H1").outcome,
    ).toBe("fail");
    expect(rule(input(value), "H1").outcome).toBe("skipped");
  });

  it("H2 removes quality sessions within 72 hours from 4/10", () => {
    expect(rule(input(value, condition(3)), "H2").outcome).toBe("pass");
    expect(rule(input(value, condition(4)), "H2")).toMatchObject({
      outcome: "fail",
      keys: ["q"],
    });
    const later = state([
      run("q", "2026-10-17", 50, { kind: "threshold", hardMinutes: 20 }),
    ]);
    expect(rule(input(later, condition(5)), "H2").outcome).toBe("pass");
  });

  it("H3 blocks quality on and after a red day and warns when unknown", () => {
    const readiness = (date: string, level: "red" | "unknown" | "green") => ({
      health: { conditions: [], readiness: [{ date, level }] },
    });
    expect(
      rule(input(value, readiness("2026-10-16", "red")), "H3"),
    ).toMatchObject({
      outcome: "fail",
      severity: "block",
    });
    expect(
      rule(input(value, readiness("2026-10-15", "red")), "H3").outcome,
    ).toBe("fail");
    expect(
      rule(input(value, readiness("2026-10-14", "red")), "H3").outcome,
    ).toBe("pass");
    expect(
      rule(input(value, readiness("2026-10-16", "unknown")), "H3"),
    ).toMatchObject({
      outcome: "fail",
      severity: "warn",
    });
    expect(
      rule(input(value, { health: { conditions: [], readiness: [] } }), "H3")
        .outcome,
    ).toBe("skipped");
  });
});

describe("single-session spikes", () => {
  const history = (runs: number) => ({
    history: {
      runs: ["2026-10-01", "2026-10-05", "2026-10-10"]
        .slice(0, runs)
        .map((date) => ({
          date,
          durationSeconds: 3_600,
          distanceMeters: null,
        })),
      weeks: [],
    },
  });
  const planned = (minutes: number) =>
    state([run("s1", "2026-10-15", minutes)]);

  it("E2 warns above 10% and E1 strongly above 30% of the 30-day longest run", () => {
    expect(rule(input(planned(66), history(3)), "E2").outcome).toBe("pass");
    expect(rule(input(planned(66.1), history(3)), "E2").outcome).toBe("fail");
    expect(rule(input(planned(78), history(3)), "E1").outcome).toBe("pass");
    expect(rule(input(planned(78), history(3)), "E2").outcome).toBe("fail");
    const strong = rule(input(planned(78.1), history(3)), "E1");
    expect(strong).toMatchObject({
      outcome: "fail",
      severity: "warn",
      strong: true,
    });
    expect(rule(input(planned(78.1), history(3)), "E2").outcome).toBe("pass");
  });

  it("prefers distance when both sides have it", () => {
    const value = input(
      state([run("s1", "2026-10-15", 30, { distance: 14_000 })]),
      {
        history: {
          runs: ["2026-10-01", "2026-10-05", "2026-10-10"].map((date) => ({
            date,
            durationSeconds: 3_600,
            distanceMeters: 10_000,
          })),
          weeks: [],
        },
      },
    );
    expect(rule(value, "E1").observed).toBeCloseTo(1.4);
  });

  it("skips without three runs in the previous 30 days", () => {
    expect(rule(input(planned(200), history(2)), "E1")).toMatchObject({
      outcome: "skipped",
      skipReason: "fewer_than_three_runs_in_30_days",
    });
  });
});

describe("weekly progression", () => {
  const history = (weeks: number, elevation: number | null = null) => ({
    history: {
      runs: [],
      weeks: ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]
        .slice(4 - weeks)
        .map((weekStart) => ({
          weekStart,
          durationSeconds: 18_000,
          elevationGainMeters: elevation,
        })),
    },
  });
  const week = (minutes: number, options: RunOptions = {}) =>
    state([
      run("s1", "2026-10-15", minutes / 2, options),
      run("s2", "2026-10-18", minutes / 2, options),
    ]);

  it("P1 warns above 10% and flags above 30% as strong", () => {
    expect(rule(input(week(330), history(4)), "P1").outcome).toBe("pass");
    expect(rule(input(week(332), history(4)), "P1")).toMatchObject({
      outcome: "fail",
      strong: false,
    });
    expect(rule(input(week(392), history(4)), "P1")).toMatchObject({
      outcome: "fail",
      strong: true,
    });
    expect(rule(input(week(400), history(3)), "P1").outcome).toBe("skipped");
  });

  it("P1 ignores deload weeks", () => {
    const value = state(week(400).sessions, { "2026-10-12": "recovery" });
    expect(rule(input(value, history(4)), "P1").outcome).toBe("skipped");
  });

  it("P2 warns above 15% more elevation on trail plans", () => {
    const trail = (meters: number) =>
      week(300, { sport: "trail", elevation: meters / 2 });
    expect(rule(input(trail(1150), history(4, 1000)), "P2").outcome).toBe(
      "pass",
    );
    expect(rule(input(trail(1152), history(4, 1000)), "P2").outcome).toBe(
      "fail",
    );
    expect(rule(input(week(300), history(4)), "P2").outcome).toBe("skipped");
  });
});

describe("week shape", () => {
  const four = (longMinutes: number) =>
    state([
      run("a", "2026-10-14", 65),
      run("b", "2026-10-15", 65),
      run("c", "2026-10-16", 65),
      run("long", "2026-10-18", longMinutes, { kind: "long" }),
    ]);

  it("P3 warns when the long run exceeds 35% with four runs", () => {
    expect(rule(input(four(105)), "P3").outcome).toBe("pass");
    expect(rule(input(four(106)), "P3")).toMatchObject({
      outcome: "fail",
      keys: ["long"],
    });
    expect(
      rule(
        input(
          state([
            run("a", "2026-10-15", 30),
            run("long", "2026-10-18", 120, { kind: "long" }),
          ]),
        ),
        "P3",
      ).outcome,
    ).toBe("skipped");
  });

  it("P4 warns on back-to-back quality and quality after the long run", () => {
    const quality = (key: string, date: string) =>
      run(key, date, 50, { kind: "threshold", hardMinutes: 10 });
    expect(
      rule(
        input(
          state([quality("q1", "2026-10-14"), quality("q2", "2026-10-16")]),
        ),
        "P4",
      ).outcome,
    ).toBe("pass");
    expect(
      rule(
        input(
          state([quality("q1", "2026-10-14"), quality("q2", "2026-10-15")]),
        ),
        "P4",
      ).outcome,
    ).toBe("fail");
    expect(
      rule(
        input(
          state([
            run("long", "2026-10-18", 120, { kind: "long" }),
            quality("q", "2026-10-19"),
          ]),
        ),
        "P4",
      ),
    ).toMatchObject({ outcome: "fail", keys: ["q"] });
  });

  it("P5 warns above 25% of hard time in a week", () => {
    const week = (hard: number) =>
      state([
        run("q", "2026-10-15", 100, { kind: "threshold", hardMinutes: hard }),
        run("e", "2026-10-17", 100),
      ]);
    expect(rule(input(week(50)), "P5").outcome).toBe("pass");
    expect(rule(input(week(51)), "P5").outcome).toBe("fail");
  });
});

describe("races", () => {
  const race = (distanceKm: number, date = "2026-12-20") => ({
    races: [{ id: "race-a", date, priority: "A" as const, distanceKm }],
  });
  const taperPlan = (taperMinutes: number, withQuality = true) =>
    state(
      [
        run("peak", "2026-11-25", 600),
        run(
          "t1",
          "2026-12-02",
          taperMinutes,
          withQuality ? { kind: "threshold", hardMinutes: 20 } : {},
        ),
        run("t2", "2026-12-09", taperMinutes),
        run("race", "2026-12-20", 240, { kind: "race" }),
      ],
      {},
      "race-a",
    );

  it("P6 expects a 40–60% taper that keeps intensity", () => {
    expect(rule(input(taperPlan(360), race(42.2)), "P6")).toMatchObject({
      outcome: "pass",
    });
    expect(rule(input(taperPlan(240), race(42.2)), "P6").outcome).toBe("pass");
    expect(rule(input(taperPlan(361), race(42.2)), "P6").issues).toEqual([
      "reduction_too_small",
    ]);
    expect(rule(input(taperPlan(239), race(42.2)), "P6").issues).toEqual([
      "reduction_too_large",
    ]);
    expect(rule(input(taperPlan(300, false), race(42.2)), "P6").issues).toEqual(
      ["no_intensity_kept"],
    );
    expect(rule(input(taperPlan(300), race(5)), "P6").skipReason).toBe(
      "race_under_10_km",
    );
  });

  it("P7 keeps quality away from an A race and rest after an ultra", () => {
    const quality = (date: string) =>
      state([
        run("q", date, 50, { kind: "threshold", hardMinutes: 10 }),
        run("race", "2026-12-20", 240, { kind: "race" }),
      ]);
    expect(rule(input(quality("2026-12-18"), race(21.1)), "P7").outcome).toBe(
      "fail",
    );
    expect(rule(input(quality("2026-12-17"), race(21.1)), "P7").outcome).toBe(
      "pass",
    );
    const after = (date: string) =>
      state([
        run("race", "2026-12-20", 600, { kind: "race" }),
        run("r", date, 30),
      ]);
    expect(rule(input(after("2026-12-23"), race(80)), "P7").outcome).toBe(
      "fail",
    );
    expect(rule(input(after("2026-12-24"), race(80)), "P7").outcome).toBe(
      "pass",
    );
    expect(rule(input(state([run("s", "2026-10-15", 30)])), "P7").outcome).toBe(
      "skipped",
    );
  });
});

describe("information rules", () => {
  const value = state([
    run("long", "2026-10-18", 150, { kind: "long", distance: 21_000 }),
  ]);

  it("P8 informs outside 0.8–1.5 and never blocks", () => {
    const load = (ratio: number, days = 42) => ({
      load: { acuteChronicRatio: ratio, days },
    });
    expect(rule(input(value, load(1.5)), "P8").outcome).toBe("pass");
    expect(rule(input(value, load(0.8)), "P8").outcome).toBe("pass");
    const high = validatePlan(input(value, load(1.51)));
    expect(high.results.find((result) => result.ruleId === "P8")).toMatchObject(
      {
        outcome: "fail",
        severity: "info",
      },
    );
    expect(high.valid).toBe(true);
    expect(rule(input(value, load(2, 27)), "P8").outcome).toBe("skipped");
  });

  it("D1 informs when the plan builds less than 70% of race demands", () => {
    const demands = (longestRunMeters: number) => ({
      demands: {
        longestRunMeters,
        weeklyElevationMeters: null,
        weeklyDurationSeconds: null,
      },
    });
    expect(rule(input(value, demands(30_000)), "D1").outcome).toBe("pass");
    expect(rule(input(value, demands(30_001)), "D1")).toMatchObject({
      outcome: "fail",
      severity: "info",
      issues: ["longest_run"],
    });
  });
});

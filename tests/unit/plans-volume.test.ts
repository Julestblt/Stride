import { describe, expect, it } from "vitest";
import type { PlanSession } from "@/features/plans/model/plan";
import {
  isRunningSession,
  sessionDistance,
} from "@/features/plans/model/volume";
import {
  intensityPaces,
  trainingTargets,
} from "@/features/plans/targets/targets";
import { buildProgram, type ProgramInput } from "@/features/plans/view/program";
import { easyRun, planState, thresholdSession } from "./plan-fixture";

const paces = { recovery: 400, easy: 360 };

const placed = (
  content: ReturnType<typeof easyRun>,
  sessionKey = "s-2026-10-15-1",
  scheduledOn = "2026-10-15",
): PlanSession => ({ ...content, sessionKey, scheduledOn });

const heartRateEasyRun = (minutes: number): PlanSession => {
  const run = placed(easyRun(minutes));
  return {
    ...run,
    structure: [
      {
        type: "warmup",
        end: { kind: "time", seconds: minutes * 60 },
        target: { kind: "heart_rate_range", minBpm: 120, maxBpm: 140 },
        intensity: "easy",
      },
    ],
  };
};

const thresholdMeters =
  Math.round((900 / 360) * 1000) +
  4 * Math.round((360 / 275) * 1000) +
  4 * Math.round((90 / 400) * 1000) +
  Math.round((600 / 360) * 1000);

describe("session distance", () => {
  it("gives strength and mobility sessions no distance", () => {
    const run = heartRateEasyRun(20);
    for (const [sport, kind] of [
      ["strength", "strength"],
      ["strength", "mobility"],
      ["run", "mobility"],
    ] as const)
      expect(sessionDistance({ ...run, sport, kind }, paces)).toBeNull();
  });

  it("estimates a heart-rate-targeted step from the athlete's pace", () => {
    expect(sessionDistance(heartRateEasyRun(30), paces)).toEqual({
      meters: 5_000,
      estimated: true,
    });
  });

  it("prefers a step's explicit pace over the athlete's pace", () => {
    expect(
      sessionDistance(placed(thresholdSession()), { ...paces, threshold: 200 }),
    ).toEqual({ meters: thresholdMeters, estimated: true });
  });

  it("uses a declared distance as is", () => {
    const run = placed(easyRun(30));
    expect(
      sessionDistance(
        { ...run, targets: { ...run.targets, distanceMeters: 6_000 } },
        paces,
      ),
    ).toEqual({ meters: 6_000, estimated: false });
  });

  it("reports an exact distance for distance steps", () => {
    const run = placed(easyRun(30));
    expect(
      sessionDistance({
        ...run,
        structure: [
          {
            type: "work",
            end: { kind: "distance", meters: 8_000, estimatedSeconds: 2_880 },
            target: { kind: "rpe", min: 3, max: 4 },
            intensity: "easy",
          },
        ],
      }),
    ).toEqual({ meters: 8_000, estimated: false });
  });

  it("leaves the distance unknown without an athlete pace", () => {
    expect(sessionDistance(heartRateEasyRun(30), null)).toBeNull();
    expect(
      sessionDistance(placed(thresholdSession()), { recovery: 400 }),
    ).toBeNull();
  });
});

describe("running sessions", () => {
  it("excludes strength, mobility, cross training and rest", () => {
    const run = placed(easyRun(30));
    expect(isRunningSession(run)).toBe(true);
    expect(isRunningSession({ ...run, sport: "trail", kind: "long" })).toBe(
      true,
    );
    expect(
      isRunningSession({ ...run, sport: "strength", kind: "strength" }),
    ).toBe(false);
    expect(isRunningSession({ ...run, kind: "mobility" })).toBe(false);
    expect(isRunningSession({ ...run, sport: "cross", kind: "cross" })).toBe(
      false,
    );
    expect(isRunningSession({ ...run, sport: "rest", kind: "rest" })).toBe(
      false,
    );
  });
});

describe("intensity paces", () => {
  it("takes the middle of each known pace range", () => {
    const targets = trainingTargets({
      today: "2026-10-14",
      flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-10-01" },
      garminLactateThreshold: null,
      bestEfforts: [],
      vo2Max: null,
      garminZones: null,
      strideZones: null,
    });
    const range = targets.intensities.easy.paceRange!;
    expect(intensityPaces(targets).easy).toBe(
      (range.fastSecondsPerKm + range.slowSecondsPerKm) / 2,
    );
  });

  it("omits intensities without a pace", () => {
    const targets = trainingTargets({
      today: "2026-10-14",
      flatLapThresholdPace: null,
      garminLactateThreshold: null,
      bestEfforts: [],
      vo2Max: null,
      garminZones: null,
      strideZones: null,
    });
    expect(intensityPaces(targets)).toEqual({});
  });
});

describe("program weekly volume", () => {
  const input = (overrides: Partial<ProgramInput> = {}): ProgramInput => ({
    state: planState(),
    today: "2026-10-21",
    summary: null,
    matches: [],
    proposalKeys: [],
    races: [],
    ...overrides,
  });

  it("includes estimated warmup and cooldown distance as approximate", () => {
    const { weeks, blocks, programs } = buildProgram(input({ paces }));
    expect(weeks[0].totals).toMatchObject({
      distanceMeters: 7_500 + thresholdMeters,
      distanceEstimated: true,
    });
    expect(weeks[0].days[3].summary).toMatch(/^50’ · ≈ \d+,\d km$/);
    expect(blocks[0].totals.distanceEstimated).toBe(true);
    expect(
      programs[0].kpis.find((kpi) => kpi.key === "distance")?.value,
    ).toMatch(/^≈ \d+ km$/);
  });

  it("excludes non-running sessions from duration, distance and elevation", () => {
    const state = planState();
    const strength: PlanSession = {
      ...placed(easyRun(30), "s-2026-10-16-1", "2026-10-16"),
      sport: "strength",
      kind: "strength",
      targets: {
        durationSeconds: 1_800,
        distanceMeters: 2_000,
        elevationGainMeters: 100,
      },
    };
    const [week] = buildProgram(
      input({ state: { ...state, sessions: [...state.sessions, strength] } }),
    ).weeks;
    expect(week.totals.durationSeconds).toBe(45 * 60 + 3_000);
    expect(week.totals.distanceMeters).toBeNull();
    expect(week.totals.elevationMeters).toBeNull();
  });

  it("shows no distance rather than a partial sum when a run is unknown", () => {
    const { weeks, blocks, programs } = buildProgram(input());
    expect(weeks[0].totals.distanceMeters).toBeNull();
    expect(blocks[0].totals.distanceMeters).toBeNull();
    expect(programs[0].kpis.map((kpi) => kpi.key)).not.toContain("distance");
  });

  it("sums completed runs only when every completed distance is known", () => {
    const state = planState();
    const declared = (session: PlanSession): PlanSession =>
      session.sessionKey === "s-2026-10-13-1"
        ? {
            ...session,
            targets: { ...session.targets, distanceMeters: 8_000 },
          }
        : session;
    const completed = (keys: string[]): ProgramInput["matches"] =>
      keys.map((sessionKey) => ({
        sessionKey,
        status: "completed",
        compliance: { duration: 1, distance: 1 },
      }));
    const withTarget = {
      ...state,
      sessions: state.sessions.map(declared),
      weeks: state.weeks.map((week) => ({
        ...week,
        targets: { ...week.targets, distanceMeters: 40_000 },
      })),
    };
    const [partial] = buildProgram(
      input({
        state: withTarget,
        matches: completed(["s-2026-10-13-1", "s-2026-10-15-1"]),
      }),
    ).weeks;
    expect(partial.done.distanceMeters).toBeNull();
    const [exact] = buildProgram(
      input({ state: withTarget, matches: completed(["s-2026-10-13-1"]) }),
    ).weeks;
    expect(exact.done).toMatchObject({
      distanceMeters: 8_000,
      distanceEstimated: false,
    });
    const [estimated] = buildProgram(
      input({
        state: withTarget,
        paces,
        matches: completed(["s-2026-10-13-1", "s-2026-10-15-1"]),
      }),
    ).weeks;
    expect(estimated.done).toMatchObject({
      distanceMeters: 8_000 + thresholdMeters,
      distanceEstimated: true,
    });
  });

  it("falls back to the week target as approximate", () => {
    const state = planState();
    const { weeks } = buildProgram(
      input({
        state: {
          ...state,
          weeks: state.weeks.map((week) => ({
            ...week,
            targets: { ...week.targets, distanceMeters: 40_000 },
          })),
        },
      }),
    );
    expect(weeks[0].totals).toMatchObject({
      distanceMeters: 40_000,
      distanceEstimated: true,
    });
  });
});

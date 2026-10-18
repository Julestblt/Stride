import { describe, expect, it } from "vitest";
import {
  compactPlanSchema,
  compactToPlanState,
  compactWeeksToRows,
  parseTarget,
  type CompactPlan,
} from "@/features/plans/compact/compact";
import { planStateSchema } from "@/features/plans/model/plan";

function compactPlan(): CompactPlan {
  return {
    title: "Préparation 10 km",
    summary: "Deux semaines de reprise puis une course.",
    startsOn: "2026-10-21",
    endsOn: "2026-11-01",
    primaryRaceId: "race-10k",
    raceRoles: [{ raceId: "race-10k", role: "primary" }],
    lowConfidenceReasons: [],
    weeks: [
      {
        weekStart: "2026-10-19",
        phase: "recovery",
        notes: "Récupération après le trail",
        sessions: [
          {
            date: "2026-10-22",
            sport: "run",
            kind: "easy",
            title: "Footing",
            purpose: "Relancer en douceur",
            key: false,
            km: 6,
            elevationGainMeters: null,
            terrain: "road",
            steps: [
              {
                type: "work",
                minutes: 40,
                intensity: "easy",
                target: "hr 130-145",
              },
            ],
          },
          {
            date: "2026-10-22",
            sport: "strength",
            kind: "strength",
            title: "Renforcement",
            purpose: "Gainage",
            key: false,
            km: null,
            elevationGainMeters: null,
            terrain: null,
            steps: [
              {
                type: "work",
                minutes: 20,
                intensity: "easy",
                target: "rpe 3-4",
              },
            ],
          },
        ],
      },
      {
        weekStart: "2026-10-26",
        phase: "build",
        notes: null,
        sessions: [
          {
            date: "2026-10-28",
            sport: "run",
            kind: "intervals",
            title: "Fractionné",
            purpose: "VMA",
            key: true,
            km: 9,
            elevationGainMeters: null,
            terrain: "track",
            steps: [
              {
                type: "warmup",
                minutes: 15,
                intensity: "easy",
                target: "hr 130-145",
              },
              {
                repeat: 5,
                steps: [
                  {
                    type: "work",
                    minutes: 3,
                    intensity: "interval",
                    target: "pace 3:45-3:55",
                  },
                  {
                    type: "recovery",
                    minutes: 2,
                    intensity: "recovery",
                    target: "none",
                  },
                ],
              },
              {
                type: "cooldown",
                minutes: 10,
                intensity: "easy",
                target: "none",
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("parseTarget", () => {
  it("reads pace, heart rate and RPE ranges in any order", () => {
    expect(parseTarget("pace 4:05-3:55")).toEqual({
      kind: "pace_range",
      fastSecondsPerKm: 235,
      slowSecondsPerKm: 245,
    });
    expect(parseTarget("HR 150–140")).toEqual({
      kind: "heart_rate_range",
      minBpm: 140,
      maxBpm: 150,
    });
    expect(parseTarget("rpe 6-7")).toEqual({ kind: "rpe", min: 6, max: 7 });
    expect(parseTarget("tempo")).toEqual({ kind: "none" });
  });
});

describe("compactToPlanState", () => {
  it("builds a schema-valid plan with unique keys and week targets", () => {
    const compact = compactPlanSchema.parse(compactPlan());
    const state = compactToPlanState(compact, "Europe/Paris");

    expect(planStateSchema.safeParse(state).success).toBe(true);
    const keys = state.sessions.map((session) => session.sessionKey);
    expect(new Set(keys).size).toBe(3);
    expect(
      state.blocks.map((block) => [block.kind, block.startsOn, block.endsOn]),
    ).toEqual([
      ["recovery", "2026-10-21", "2026-10-25"],
      ["build", "2026-10-26", "2026-11-01"],
    ]);
    const [first, second] = state.weeks;
    expect(first.targets.durationSeconds).toBe(60 * 60);
    expect(first.targets.distanceMeters).toBe(6000);
    expect(second.targets.qualitySessions).toBe(1);
    expect(second.targets.durationSeconds).toBe((15 + 5 * 5 + 10) * 60);
    expect(state.plan.confidence.level).toBe("normal");
    expect(state.plan.primaryRaceId).toBe("race-10k");
  });

  it("marks the plan low confidence when reasons are given", () => {
    const compact = {
      ...compactPlan(),
      lowConfidenceReasons: ["Historique court"],
    };
    const state = compactToPlanState(
      compactPlanSchema.parse(compact),
      "Europe/Paris",
    );
    expect(state.plan.confidence).toEqual({
      level: "low",
      reasons: ["Historique court"],
    });
  });
});

describe("compactWeeksToRows", () => {
  it("continues block ordinals and session keys after an existing plan", () => {
    const existing = compactToPlanState(compactPlan(), "Europe/Paris");
    const week = compactPlan().weeks[0];
    const rows = compactWeeksToRows(
      [
        {
          ...week,
          weekStart: "2026-11-02",
          sessions: week.sessions.map((session) => ({
            ...session,
            date: "2026-11-04",
          })),
        },
      ],
      { startsOn: "2026-11-02", endsOn: "2026-11-08", existing },
    );
    const existingKeys = existing.blocks.map((block) => block.blockKey);
    expect(existingKeys).toContain("b-recovery-1");
    expect(rows.blocks.map((block) => block.blockKey)).toEqual([
      "b-recovery-2",
    ]);
    expect(rows.blocks[0]).toMatchObject({
      startsOn: "2026-11-02",
      endsOn: "2026-11-08",
    });
    expect(rows.weeks.map((item) => item.weekKey)).toEqual(["w-2026-11-02"]);
    expect(rows.sessions.map((session) => session.sessionKey)).toEqual(
      week.sessions.map((_, index) => `s-2026-11-04-${index + 1}`),
    );
  });
});

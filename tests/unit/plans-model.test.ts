import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mondayOf } from "@/features/plans/model/dates";
import { blockKey, sessionKey, weekKey } from "@/features/plans/model/keys";
import {
  planStateSchema,
  sessionContentSchema,
  weekSchema,
} from "@/features/plans/model/plan";
import {
  structureIssues,
  structureTotals,
} from "@/features/plans/model/structure";
import { easyRun, planState, thresholdSession } from "./plan-fixture";

describe("structureTotals", () => {
  it("expands repeats and sums duration, distance and time per intensity", () => {
    const totals = structureTotals(thresholdSession().structure);
    expect(totals.durationSeconds).toBe(900 + 4 * (360 + 90) + 600);
    expect(totals.secondsByIntensity.threshold).toBe(1_440);
    expect(totals.secondsByIntensity.recovery).toBe(360);
    expect(totals.secondsByIntensity.easy).toBe(1_500);
    expect(totals.distanceComplete).toBe(false);
    expect(totals.distanceMeters).toBe(4 * Math.round((360 / 275) * 1000));
  });

  it("derives a distance step duration from its pace target", () => {
    const totals = structureTotals([
      {
        type: "work",
        end: { kind: "distance", meters: 1000 },
        target: {
          kind: "pace_range",
          fastSecondsPerKm: 240,
          slowSecondsPerKm: 250,
        },
        intensity: "interval",
      },
    ]);
    expect(totals.durationSeconds).toBe(245);
    expect(totals.distanceMeters).toBe(1000);
    expect(totals.distanceComplete).toBe(true);
  });

  it("reports an unknown duration for a distance step without pace or estimate", () => {
    const totals = structureTotals([
      {
        type: "work",
        end: { kind: "distance", meters: 1000 },
        target: { kind: "rpe", min: 7, max: 8 },
        intensity: "interval",
      },
    ]);
    expect(totals.durationSeconds).toBeNull();
  });
});

describe("structureIssues", () => {
  const structure = easyRun(60).structure;

  it("accepts steps within 10% of the declared duration", () => {
    expect(structureIssues(structure, 3_273, false)).toEqual([]);
    expect(structureIssues(structure, 4_000, false)).toEqual([]);
  });

  it("rejects steps more than 10% away from the declared duration", () => {
    expect(structureIssues(structure, 3_272, false)).toEqual([
      "duration_mismatch",
    ]);
    expect(structureIssues(structure, 4_001, false)).toEqual([
      "duration_mismatch",
    ]);
  });

  it("requires a targeted work step", () => {
    expect(
      structureIssues(
        [
          {
            type: "work",
            end: { kind: "time", seconds: 600 },
            target: { kind: "none" },
            intensity: "easy",
          },
        ],
        600,
        false,
      ),
    ).toEqual(["untargeted_work_step"]);
    expect(
      structureIssues(
        [
          {
            type: "warmup",
            end: { kind: "time", seconds: 600 },
            target: { kind: "rpe", min: 2, max: 3 },
            intensity: "easy",
          },
        ],
        600,
        false,
      ),
    ).toEqual(["missing_work_step"]);
  });

  it("keeps rest sessions empty", () => {
    expect(structureIssues([], 0, true)).toEqual([]);
    expect(structureIssues(structure, 3_600, true)).toEqual([
      "rest_with_structure",
    ]);
  });
});

describe("plan schemas", () => {
  it("accepts a complete plan state", () => {
    expect(planStateSchema.safeParse(planState()).success).toBe(true);
  });

  it("rejects a session whose structure misses its duration", () => {
    const session = easyRun(45);
    const result = sessionContentSchema.safeParse({
      ...session,
      targets: { ...session.targets, durationSeconds: 3_600 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects ordered ranges given backwards", () => {
    const session = easyRun(30);
    const result = sessionContentSchema.safeParse({
      ...session,
      structure: [
        {
          ...session.structure[0],
          target: { kind: "heart_rate_range", minBpm: 160, maxBpm: 140 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires Monday-based weeks and a 100% intensity split", () => {
    const week = planState().weeks[0];
    expect(
      weekSchema.safeParse({ ...week, weekStart: "2026-10-13" }).success,
    ).toBe(false);
    expect(
      weekSchema.safeParse({
        ...week,
        targets: {
          ...week.targets,
          intensitySplit: { easyPct: 80, moderatePct: 5, hardPct: 10 },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate keys and sessions outside the plan", () => {
    const state = planState();
    expect(
      planStateSchema.safeParse({
        ...state,
        sessions: [...state.sessions, state.sessions[0]],
      }).success,
    ).toBe(false);
    expect(
      planStateSchema.safeParse({
        ...state,
        sessions: [{ ...state.sessions[0], scheduledOn: "2026-11-20" }],
      }).success,
    ).toBe(false);
  });
});

describe("keys", () => {
  it("derives stable keys from logical slots", () => {
    expect(weekKey(mondayOf("2026-10-18"))).toBe("w-2026-10-12");
    expect(blockKey("lead_in", 1)).toBe("b-lead-in-1");
    expect(sessionKey("2026-10-20", ["s-2026-10-20-1"])).toBe("s-2026-10-20-2");
  });
});

describe("plans module boundary", () => {
  const files = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it("imports nothing from React, Next.js or Supabase", () => {
    for (const file of files("src/features/plans")) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(
        /from\s+["'](react|next|@supabase|@\/server)/,
      );
    }
  });
});

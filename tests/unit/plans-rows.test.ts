import { describe, expect, it } from "vitest";
import type { PlanState } from "@/features/plans/model/plan";
import { toPlanState, type PlanRows } from "@/features/plans/model/rows";
import { planState } from "./plan-fixture";

function toRows(state: PlanState): PlanRows {
  return {
    plan: {
      id: state.plan.id,
      title: state.plan.title,
      starts_on: state.plan.startsOn,
      ends_on: state.plan.endsOn,
      time_zone: state.plan.timeZone,
      primary_race_id: state.plan.primaryRaceId,
    },
    version: {
      version: 1,
      race_roles: state.plan.raceRoles,
      confidence: state.plan.confidence,
    },
    blocks: state.blocks.map((block) => ({
      block_key: block.blockKey,
      kind: block.kind,
      name: block.name,
      starts_on: block.startsOn,
      ends_on: block.endsOn,
      objective: block.objective,
      race_id: block.raceId,
    })),
    weeks: state.weeks.map((week) => ({
      week_key: week.weekKey,
      week_start: week.weekStart,
      block_key: week.blockKey,
      week_type: week.weekType,
      target_duration_s: week.targets.durationSeconds,
      target_distance_m: week.targets.distanceMeters,
      target_elevation_m: week.targets.elevationGainMeters,
      quality_sessions: week.targets.qualitySessions,
      long_run_target_s: week.targets.longRunSeconds,
      intensity_split: week.targets.intensitySplit,
      notes: week.notes,
    })),
    sessions: state.sessions.map((session) => ({
      session_key: session.sessionKey,
      scheduled_on: session.scheduledOn,
      sport: session.sport,
      kind: session.kind,
      title: session.title,
      purpose: session.purpose,
      is_key: session.isKey,
      priority: session.priority,
      targets: session.targets,
      structure: session.structure,
      terrain: session.terrain,
      origin: session.origin,
      contingencies: session.contingencies,
    })),
  };
}

describe("toPlanState", () => {
  it("rebuilds the plan state from stored rows", () => {
    const state = planState();
    expect(toPlanState(toRows(state))).toEqual(state);
  });

  it("orders rows by date regardless of storage order", () => {
    const state = planState();
    const rows = toRows(state);
    expect(
      toPlanState({
        ...rows,
        weeks: [...rows.weeks].reverse(),
        sessions: [...rows.sessions].reverse(),
      }),
    ).toEqual(state);
  });

  it("rejects rows that break the plan schema", () => {
    const rows = toRows(planState());
    expect(() =>
      toPlanState({
        ...rows,
        sessions: rows.sessions.map((session, index) =>
          index === 0 ? { ...session, kind: "sprint" } : session,
        ),
      }),
    ).toThrow();
    expect(() =>
      toPlanState({
        ...rows,
        version: { ...rows.version, confidence: null },
      }),
    ).toThrow();
    expect(() =>
      toPlanState({
        ...rows,
        weeks: [{ ...rows.weeks[0], block_key: "b-unknown" }],
      }),
    ).toThrow();
  });
});

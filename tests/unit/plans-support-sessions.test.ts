import { describe, expect, it } from "vitest";
import {
  isDoneStatus,
  matchStatuses,
  planAdherence,
  sessionStatuses,
} from "@/features/plans/matching/adherence";
import type { PlanState } from "@/features/plans/model/plan";
import { buildProgram } from "@/features/plans/view/program";
import {
  buildSessionPanel,
  type PanelMatch,
} from "@/features/plans/view/session-panel";
import { planState, supportSession } from "./plan-fixture";

function withSupport(): PlanState {
  const state = planState();
  return {
    ...state,
    sessions: [
      ...state.sessions,
      {
        ...supportSession("mobility", 20),
        sessionKey: "s-2026-10-14-1",
        scheduledOn: "2026-10-14",
      },
      {
        ...supportSession("strength", 30, "Gainage et fentes, 3 tours."),
        sessionKey: "s-2026-10-16-1",
        scheduledOn: "2026-10-16",
      },
    ],
  };
}

const today = "2026-10-21";

const checkedIn = {
  sessionKey: "s-2026-10-14-1",
  activityId: null,
  status: "checked_in",
  compliance: { duration: null, distance: null },
} satisfies PanelMatch;

function program(matches: PanelMatch[] = []) {
  return buildProgram({
    state: withSupport(),
    today,
    summary: null,
    matches,
    proposalKeys: [],
    races: [],
  });
}

function panel(sessionKey: string, matches: PanelMatch[] = [], on = today) {
  return buildSessionPanel({
    state: withSupport(),
    today: on,
    sessionKey,
    matches,
    proposals: [],
    activity: null,
    laps: [],
    series: null,
  })!;
}

describe("non-running sessions", () => {
  it("leaves a past mobility day neutral and a past strength day missed", () => {
    const [past] = program().weeks;
    expect(past.days[2]).toMatchObject({
      family: "mobility",
      state: null,
      blocks: [],
      summary: "20’",
    });
    expect(past.days[4]).toMatchObject({
      family: "strength",
      state: "missed",
      blocks: [],
    });
    expect(past.days[1].blocks.length).toBeGreaterThan(0);
  });

  it("keeps unmatched mobility out of adherence but counts it once matched", () => {
    const sessions = withSupport().sessions;
    const window = { start: "2026-10-12", today, windows: [] };
    expect(planAdherence({ sessions, matches: [], ...window })).toMatchObject({
      due: 4,
      missed: 4,
    });
    expect(
      planAdherence({
        sessions,
        matches: [{ sessionKey: "s-2026-10-14-1", status: "completed" }],
        ...window,
      }),
    ).toMatchObject({ due: 5, done: 1 });
  });

  it("shows a past mobility session without status or intensity", () => {
    const mobility = panel("s-2026-10-14-1");
    expect(mobility).toMatchObject({
      family: "mobility",
      status: null,
      intensity: false,
      untracked: true,
      summary: "Mobilité · 20 min",
      segments: [],
      steps: [],
    });
    expect(mobility.stats.map((stat) => stat.key)).toEqual(["duration"]);
  });

  it("keeps strength cues as plain content without effort targets", () => {
    const strength = panel("s-2026-10-16-1");
    expect(strength).toMatchObject({
      status: "missed",
      intensity: false,
      untracked: false,
      summary: "Renfo · 30 min",
      segments: [],
    });
    expect(
      strength.steps.map((step) => [step.cue, step.duration, step.target]),
    ).toEqual([["Gainage et fentes, 3 tours.", "30:00", ""]]);
  });

  it("keeps the intensity view for runs", () => {
    const run = panel("s-2026-10-13-1");
    expect(run).toMatchObject({ intensity: true, summary: null });
    expect(run.segments.length).toBeGreaterThan(0);
  });

  it("treats an athlete check-in as done without an activity", () => {
    expect(matchStatuses).toContain("checked_in");
    expect(
      ["completed", "partial", "checked_in", "substituted", "dismissed"].map(
        (status) => isDoneStatus(status as (typeof matchStatuses)[number]),
      ),
    ).toEqual([true, true, true, false, false]);
    expect(isDoneStatus(undefined)).toBe(false);
    expect(
      sessionStatuses([
        { sessionKey: "a", status: "completed" },
        { sessionKey: "a", status: "checked_in" },
      ]).get("a"),
    ).toBe("checked_in");
  });

  it("counts a checked-in mobility session as done in adherence", () => {
    expect(
      planAdherence({
        sessions: withSupport().sessions,
        matches: [checkedIn],
        start: "2026-10-12",
        today,
        windows: [],
      }),
    ).toMatchObject({ due: 5, done: 1, missed: 4 });
  });

  it("shows a checked-in mobility day as done in the week", () => {
    const [past] = program([checkedIn]).weeks;
    expect(past.days[2]).toMatchObject({ family: "mobility", state: "done" });
  });

  it("offers the check-in on a due mobility session only", () => {
    expect(panel("s-2026-10-14-1").checkIn).toEqual({ done: false });
    expect(panel("s-2026-10-14-1", [], "2026-10-14").checkIn).toEqual({
      done: false,
    });
    expect(panel("s-2026-10-14-1", [], "2026-10-13").checkIn).toBeNull();
    expect(panel("s-2026-10-16-1").checkIn).toBeNull();
    expect(panel("s-2026-10-13-1").checkIn).toBeNull();
  });

  it("shows a checked-in mobility session as done with an undo", () => {
    expect(panel("s-2026-10-14-1", [checkedIn])).toMatchObject({
      status: "done",
      checkIn: { done: true },
      completion: null,
    });
  });
});

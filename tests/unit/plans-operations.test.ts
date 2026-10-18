import { describe, expect, it } from "vitest";
import {
  applyOperations,
  isFrozenSession,
} from "@/features/plans/operations/apply";
import { planOperationSchema } from "@/features/plans/operations/operations";
import {
  context,
  easyRun,
  extendPlan,
  planState,
  thresholdSession,
} from "./plan-fixture";

const errorCodes = (result: ReturnType<typeof applyOperations>) =>
  result.ok ? [] : result.errors.map((error) => error.code);

describe("isFrozenSession", () => {
  it("freezes sessions before today or matched to an activity", () => {
    const ctx = context(["s-2026-10-20-1"]);
    expect(
      isFrozenSession({ sessionKey: "a", scheduledOn: "2026-10-13" }, ctx),
    ).toBe(true);
    expect(
      isFrozenSession({ sessionKey: "a", scheduledOn: "2026-10-14" }, ctx),
    ).toBe(false);
    expect(
      isFrozenSession(
        { sessionKey: "s-2026-10-20-1", scheduledOn: "2026-10-20" },
        ctx,
      ),
    ).toBe(true);
  });
});

describe("create_plan", () => {
  it("creates version content with every entity added", () => {
    const state = planState();
    const result = applyOperations(
      null,
      [{ op: "create_plan", state }],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.plan).toEqual(state.plan);
    expect(result.changeset.sessions.added).toHaveLength(5);
    expect(result.changeset.sessions.closed).toEqual([]);
  });

  it("refuses to create over an existing plan or alongside other operations", () => {
    const state = planState();
    expect(
      errorCodes(
        applyOperations(state, [{ op: "create_plan", state }], context()),
      ),
    ).toEqual(["plan_exists"]);
    expect(
      errorCodes(
        applyOperations(
          null,
          [
            { op: "create_plan", state },
            { op: "skip_session", sessionKey: "s-2026-10-20-1" },
          ],
          context(),
        ),
      ),
    ).toEqual(["invalid_operation"]);
  });

  it("requires a plan for every other operation", () => {
    expect(
      errorCodes(
        applyOperations(
          null,
          [{ op: "skip_session", sessionKey: "s-2026-10-20-1" }],
          context(),
        ),
      ),
    ).toEqual(["missing_plan"]);
  });
});

describe("move_session", () => {
  it("touches only the moved session key", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "move_session",
          sessionKey: "s-2026-10-22-1",
          toDate: "2026-10-23",
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.plan).toBeNull();
    expect(result.changeset.sessions.closed).toEqual(["s-2026-10-22-1"]);
    expect(result.changeset.sessions.added).toEqual([
      expect.objectContaining({
        sessionKey: "s-2026-10-22-1",
        scheduledOn: "2026-10-23",
      }),
    ]);
    expect(result.changeset.weeks).toEqual({ closed: [], added: [] });
    expect(result.changeset.blocks).toEqual({ closed: [], added: [] });
  });

  it("rejects unknown, frozen, past and out-of-plan moves", () => {
    const state = planState();
    const move = (sessionKey: string, toDate: string, matched: string[] = []) =>
      errorCodes(
        applyOperations(
          state,
          [{ op: "move_session", sessionKey, toDate }],
          context(matched),
        ),
      );
    expect(move("s-missing", "2026-10-23")).toEqual(["unknown_key"]);
    expect(move("s-2026-10-13-1", "2026-10-16")).toEqual(["frozen_session"]);
    expect(move("s-2026-10-20-1", "2026-10-21", ["s-2026-10-20-1"])).toEqual([
      "frozen_session",
    ]);
    expect(move("s-2026-10-20-1", "2026-10-13")).toEqual(["past_date"]);
    expect(move("s-2026-10-20-1", "2026-11-20")).toEqual(["outside_plan"]);
  });
});

describe("swap_sessions", () => {
  it("exchanges the dates of two future sessions", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "swap_sessions",
          firstKey: "s-2026-10-20-1",
          secondKey: "s-2026-10-22-1",
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dates = Object.fromEntries(
      result.state.sessions.map((session) => [
        session.sessionKey,
        session.scheduledOn,
      ]),
    );
    expect(dates["s-2026-10-20-1"]).toBe("2026-10-22");
    expect(dates["s-2026-10-22-1"]).toBe("2026-10-20");
    expect(result.changeset.sessions.closed.sort()).toEqual([
      "s-2026-10-20-1",
      "s-2026-10-22-1",
    ]);
  });

  it("rejects a swap with a frozen session", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [
            {
              op: "swap_sessions",
              firstKey: "s-2026-10-15-1",
              secondKey: "s-2026-10-13-1",
            },
          ],
          context(),
        ),
      ),
    ).toEqual(["frozen_session"]);
  });
});

describe("shorten_session", () => {
  const shorter = easyRun(30);

  it("shortens a session with a consistent structure", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "shorten_session",
          sessionKey: "s-2026-10-20-1",
          durationSeconds: 1_800,
          structure: shorter.structure,
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.sessions.added[0].targets.durationSeconds).toBe(
      1_800,
    );
  });

  it("rejects a longer duration and an inconsistent structure", () => {
    const shorten = (durationSeconds: number) =>
      errorCodes(
        applyOperations(
          planState(),
          [
            {
              op: "shorten_session",
              sessionKey: "s-2026-10-20-1",
              durationSeconds,
              structure: shorter.structure,
            },
          ],
          context(),
        ),
      );
    expect(shorten(3_600)).toEqual(["invalid_operation"]);
    expect(shorten(2_400)).toEqual(["invalid_structure"]);
  });
});

describe("replace_session", () => {
  it("keeps the key and date and replaces the content", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "replace_session",
          sessionKey: "s-2026-10-20-1",
          content: thresholdSession(),
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.sessions.added).toEqual([
      expect.objectContaining({
        sessionKey: "s-2026-10-20-1",
        scheduledOn: "2026-10-20",
        kind: "threshold",
      }),
    ]);
  });

  it("rejects replacing a past session", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [
            {
              op: "replace_session",
              sessionKey: "s-2026-10-13-1",
              content: easyRun(30),
            },
          ],
          context(),
        ),
      ),
    ).toEqual(["frozen_session"]);
  });
});

describe("skip_session", () => {
  it("removes a future session", () => {
    const result = applyOperations(
      planState(),
      [{ op: "skip_session", sessionKey: "s-2026-10-25-1" }],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.sessions).toEqual({
      closed: ["s-2026-10-25-1"],
      added: [],
    });
  });

  it("rejects skipping an unknown or matched session", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [{ op: "skip_session", sessionKey: "s-nope" }],
          context(),
        ),
      ),
    ).toEqual(["unknown_key"]);
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [{ op: "skip_session", sessionKey: "s-2026-10-25-1" }],
          context(["s-2026-10-25-1"]),
        ),
      ),
    ).toEqual(["frozen_session"]);
  });
});

describe("add_session", () => {
  it("adds a session with a fresh key on its date", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "add_session",
          session: { scheduledOn: "2026-10-20", content: easyRun(30) },
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.sessions.closed).toEqual([]);
    expect(
      result.changeset.sessions.added.map((session) => session.sessionKey),
    ).toEqual(["s-2026-10-20-2"]);
  });

  it("rejects past dates and dates outside the plan", () => {
    const add = (scheduledOn: string) =>
      errorCodes(
        applyOperations(
          planState(),
          [
            {
              op: "add_session",
              session: { scheduledOn, content: easyRun(30) },
            },
          ],
          context(),
        ),
      );
    expect(add("2026-10-13")).toEqual(["past_date"]);
    expect(add("2026-11-09")).toEqual(["outside_plan"]);
  });
});

describe("set_week_targets", () => {
  const targets = { ...planState().weeks[1].targets, durationSeconds: 12_000 };

  it("changes one week's targets", () => {
    const result = applyOperations(
      planState(),
      [{ op: "set_week_targets", weekKey: "w-2026-10-19", targets }],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.weeks.closed).toEqual(["w-2026-10-19"]);
    expect(result.changeset.sessions).toEqual({ closed: [], added: [] });
  });

  it("allows the current week but rejects past and unknown weeks", () => {
    const set = (weekKey: string, today = "2026-10-14") =>
      errorCodes(
        applyOperations(
          planState(),
          [{ op: "set_week_targets", weekKey, targets }],
          { today, matchedSessionKeys: new Set() },
        ),
      );
    expect(set("w-2026-10-12")).toEqual([]);
    expect(set("w-2026-10-12", "2026-10-19")).toEqual(["past_date"]);
    expect(set("w-2026-01-05")).toEqual(["unknown_key"]);
  });
});

describe("replace_range", () => {
  it("replaces the future sessions of a range", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "replace_range",
          from: "2026-10-19",
          to: "2026-10-25",
          sessions: [
            { scheduledOn: "2026-10-21", content: easyRun(40) },
            { scheduledOn: "2026-10-24", content: easyRun(80) },
          ],
        },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeset.sessions.closed.sort()).toEqual([
      "s-2026-10-20-1",
      "s-2026-10-22-1",
      "s-2026-10-25-1",
    ]);
    expect(
      result.changeset.sessions.added.map((session) => session.sessionKey),
    ).toEqual(["s-2026-10-21-1", "s-2026-10-24-1"]);
  });

  it("rejects ranges with past dates, frozen sessions or sessions outside the range", () => {
    const replace = (
      from: string,
      to: string,
      scheduledOn: string,
      matched: string[] = [],
    ) =>
      errorCodes(
        applyOperations(
          planState(),
          [
            {
              op: "replace_range",
              from,
              to,
              sessions: [{ scheduledOn, content: easyRun(40) }],
            },
          ],
          context(matched),
        ),
      );
    expect(replace("2026-10-12", "2026-10-18", "2026-10-16")).toEqual([
      "past_date",
    ]);
    expect(
      replace("2026-10-19", "2026-10-25", "2026-10-21", ["s-2026-10-22-1"]),
    ).toEqual(["frozen_session"]);
    expect(replace("2026-10-19", "2026-10-25", "2026-10-28")).toEqual([
      "invalid_operation",
    ]);
  });
});

describe("set_race_role", () => {
  it("sets and removes a plan race role without touching sessions", () => {
    const set = applyOperations(
      planState(),
      [{ op: "set_race_role", raceId: "race-b", role: "preparation" }],
      context(),
    );
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.changeset.plan?.raceRoles).toContainEqual({
      raceId: "race-b",
      role: "preparation",
    });
    expect(set.changeset.sessions).toEqual({ closed: [], added: [] });
    const removed = applyOperations(
      set.state,
      [{ op: "set_race_role", raceId: "race-b", role: null }],
      context(),
    );
    expect(removed.ok && removed.changeset.plan?.raceRoles).toEqual([
      { raceId: "race-a", role: "primary" },
    ]);
  });
});

describe("extend_plan", () => {
  it("moves the end, appends blocks, weeks and sessions and keeps earlier rows", () => {
    const before = planState();
    const result = applyOperations(before, [extendPlan()], context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.plan.endsOn).toBe("2026-11-22");
    expect(result.state.plan.raceRoles).toContainEqual({
      raceId: "race-b",
      role: "secondary",
    });
    expect(result.state.plan.primaryRaceId).toBe("race-a");
    expect(result.changeset.blocks).toEqual({
      closed: [],
      added: [expect.objectContaining({ blockKey: "b-build-1" })],
    });
    expect(result.changeset.weeks.closed).toEqual([]);
    expect(result.changeset.weeks.added.map((week) => week.weekKey)).toEqual([
      "w-2026-11-09",
      "w-2026-11-16",
    ]);
    expect(result.changeset.sessions.closed).toEqual([]);
    expect(
      result.changeset.sessions.added.map((session) => session.sessionKey),
    ).toEqual(["s-2026-11-10-1", "s-2026-11-17-1"]);
    expect(result.state.sessions.slice(0, before.sessions.length)).toEqual(
      before.sessions,
    );
  });

  it("makes a primary race the objective and the previous one a preparation race", () => {
    const result = applyOperations(
      planState(),
      [extendPlan({ role: "primary" })],
      context(),
    );
    expect(result.ok && result.state.plan.primaryRaceId).toBe("race-b");
    expect(result.ok && result.state.plan.raceRoles).toEqual([
      { raceId: "race-a", role: "preparation" },
      { raceId: "race-b", role: "primary" },
    ]);
  });

  it("rejects an end that does not move later or a stale previous end", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ endsOn: "2026-11-08" })],
          context(),
        ),
      ),
    ).toEqual(["outside_plan"]);
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ previousEndsOn: "2026-11-01" })],
          context(),
        ),
      ),
    ).toEqual(["invalid_operation"]);
  });

  it("rejects weeks or sessions inside the current plan or after the new end", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ weekStarts: ["2026-11-02", "2026-11-09"] })],
          context(),
        ),
      ),
    ).toEqual(["invalid_operation"]);
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ sessionDates: ["2026-11-05"] })],
          context(),
        ),
      ),
    ).toEqual(["outside_plan"]);
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ sessionDates: ["2026-11-25"] })],
          context(),
        ),
      ),
    ).toEqual(["outside_plan"]);
  });

  it("requires every added week and sessions inside them", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ weekStarts: ["2026-11-16"] })],
          context(),
        ),
      ),
    ).toEqual(["invalid_operation"]);
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [extendPlan({ endsOn: "2026-11-29" })],
          context(),
        ),
      ),
    ).toEqual(["invalid_operation"]);
  });

  it("must be the first operation and lets later operations use the new end", () => {
    const later = applyOperations(
      planState(),
      [{ op: "skip_session", sessionKey: "s-2026-10-20-1" }, extendPlan()],
      context(),
    );
    expect(errorCodes(later)).toEqual(["invalid_operation"]);
    const combined = applyOperations(
      planState(),
      [
        extendPlan(),
        {
          op: "add_session",
          session: { scheduledOn: "2026-11-21", content: easyRun(30) },
        },
      ],
      context(),
    );
    expect(combined.ok).toBe(true);
  });
});

describe("set_race_role primary", () => {
  it("moves the objective and turns the previous one into a preparation race", () => {
    const result = applyOperations(
      planState(),
      [{ op: "set_race_role", raceId: "race-b", role: "primary" }],
      context(),
    );
    expect(result.ok && result.state.plan.primaryRaceId).toBe("race-b");
    expect(result.ok && result.state.plan.raceRoles).toEqual([
      { raceId: "race-a", role: "preparation" },
      { raceId: "race-b", role: "primary" },
    ]);
  });
});

describe("operation batches", () => {
  it("rejects two operations on the same target", () => {
    const result = applyOperations(
      planState(),
      [
        {
          op: "move_session",
          sessionKey: "s-2026-10-22-1",
          toDate: "2026-10-23",
        },
        { op: "skip_session", sessionKey: "s-2026-10-22-1" },
      ],
      context(),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "overlapping_targets",
          operationIndex: 1,
          key: "s-2026-10-22-1",
        },
      ],
    });
  });

  it("applies independent operations together and never changes the input", () => {
    const state = planState();
    const snapshot = JSON.stringify(state);
    const result = applyOperations(
      state,
      [
        {
          op: "move_session",
          sessionKey: "s-2026-10-22-1",
          toDate: "2026-10-23",
        },
        { op: "skip_session", sessionKey: "s-2026-10-25-1" },
      ],
      context(),
    );
    expect(result.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("reports every failing operation", () => {
    expect(
      errorCodes(
        applyOperations(
          planState(),
          [
            { op: "skip_session", sessionKey: "s-2026-10-13-1" },
            {
              op: "move_session",
              sessionKey: "s-2026-10-20-1",
              toDate: "2026-12-01",
            },
          ],
          context(),
        ),
      ),
    ).toEqual(["frozen_session", "outside_plan"]);
  });
});

describe("planOperationSchema", () => {
  it("parses known operations and rejects unknown ones", () => {
    expect(
      planOperationSchema.safeParse({
        op: "move_session",
        sessionKey: "s-2026-10-22-1",
        toDate: "2026-10-23",
      }).success,
    ).toBe(true);
    expect(planOperationSchema.safeParse({ op: "delete_plan" }).success).toBe(
      false,
    );
    expect(
      planOperationSchema.safeParse({
        op: "replace_range",
        from: "2026-10-25",
        to: "2026-10-19",
        sessions: [],
      }).success,
    ).toBe(false);
  });
});

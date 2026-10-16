import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { StoredPlan } from "../../src/server/plans/stored";
import type { OnboardingContext } from "../../src/server/onboarding/context";
import {
  checkinFixture,
  fixtureToday,
  planningInputFixture,
  predictionFixture,
  profileFixture,
} from "./coaching-tools-fixture";
import { planState } from "./plan-fixture";

vi.mock("server-only", () => ({}));

const sources = vi.hoisted(() => ({
  readActivePlan: vi.fn(),
  loadPlanningInput: vi.fn(),
  readProfile: vi.fn(),
  readPlanningConstraints: vi.fn(),
  readSessionMatches: vi.fn(),
}));

vi.mock("../../src/server/plans/stored", () => ({
  readActivePlan: sources.readActivePlan,
}));
vi.mock("../../src/server/plans/draft", () => ({
  loadPlanningInput: sources.loadPlanningInput,
}));
vi.mock("../../src/server/onboarding/profile", () => ({
  readProfile: sources.readProfile,
}));
vi.mock("../../src/server/plans/constraints", () => ({
  readPlanningConstraints: sources.readPlanningConstraints,
}));
vi.mock("../../src/server/plans/matches", () => ({
  readSessionMatches: sources.readSessionMatches,
}));

import {
  athleteContextSchema,
  buildAthleteContext,
  contextPacketBudgetBytes,
} from "../../src/server/coaching/tools/athlete-context";
import {
  toolErrorCodes,
  toolErrorMessages,
} from "../../src/server/coaching/tools/errors";
import { progressStatus } from "../../src/server/coaching/tools/plan-progress";
import {
  agentTools,
  coachingTools,
  parseToolInput,
  runCustomTool,
} from "../../src/server/coaching/tools/registry";
import { askAthleteTool } from "../../src/server/coaching/tools/ask-athlete";

const athlete = "a0000000-0000-4000-8000-00000000000a";
const proposalId = "c0000000-0000-4000-8000-00000000000c";
const activityId = "d0000000-0000-4000-8000-00000000000d";

type Result = { data: unknown; error: unknown };
type Call = { table: string; steps: [string, ...unknown[]][] };

function fakeClient(
  tables: Record<string, Result>,
  rpc: Result = { data: null, error: null },
) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, steps: [] };
      calls.push(call);
      const result = tables[table] ?? { data: [], error: null };
      const builder: object = new Proxy(
        {},
        {
          get(_target, property: string) {
            if (property === "then")
              return (resolve: (value: Result) => void) => resolve(result);
            return (...args: unknown[]) => {
              call.steps.push([property, ...args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
    rpc: vi.fn(async () => rpc),
  };
  return { calls, client };
}

function contextWith(client: unknown) {
  return { userId: athlete, client } as unknown as OnboardingContext;
}

function storedPlan(overrides: Partial<StoredPlan> = {}): StoredPlan {
  return {
    planId: "e0000000-0000-4000-8000-00000000000e",
    status: "active",
    activeVersion: 3,
    version: 3,
    versionSummary: null,
    state: planState(),
    ...overrides,
  };
}

function scopedToAthlete(call: Call) {
  return call.steps.some(
    ([method, column, value]) =>
      method === "eq" && column === "user_id" && value === athlete,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T08:00:00Z"));
  sources.readActivePlan.mockResolvedValue(storedPlan());
  sources.readPlanningConstraints.mockResolvedValue({
    timeZone: "Europe/Paris",
    maxWeeklyMinutes: null,
    unavailablePeriods: [],
  });
  sources.readSessionMatches.mockResolvedValue([]);
  sources.loadPlanningInput.mockResolvedValue({
    today: fixtureToday,
    input: planningInputFixture(),
  });
  sources.readProfile.mockResolvedValue({
    values: profileFixture(),
    revision: 1,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("tool registry", () => {
  it("declares each tool once with strict inputs and no athlete identifiers", () => {
    const names = coachingTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of coachingTools) {
      const schema = z.toJSONSchema(tool.input, { io: "input" });
      expect(schema.additionalProperties, tool.name).toBe(false);
      expect(
        Object.keys(schema.properties ?? {}).filter((key) =>
          /user|athlete/i.test(key),
        ),
        tool.name,
      ).toEqual([]);
      expect(tool.input.safeParse({ user_id: athlete }).success).toBe(false);
    }
  });

  it("exposes only registered tools to each agent, health tools included for both", () => {
    for (const names of Object.values(agentTools))
      for (const name of names) expect(names).toContain(name);
    expect(agentTools.coach).toEqual(
      expect.arrayContaining([
        "read_plan_progress",
        "read_plan_history",
        "read_health_reports",
      ]),
    );
    expect(agentTools.medical).toEqual([
      "read_athlete_context",
      "read_health_reports",
      "ask_athlete",
    ]);
  });

  it("has a French message for every error code", () => {
    for (const code of toolErrorCodes)
      expect(toolErrorMessages[code]).toMatch(/[a-zé]/);
  });

  it("answers unknown_tool for a name outside the registry", async () => {
    const outcome = await runCustomTool(contextWith({}), "run_sql", {});
    expect(outcome).toEqual({
      ok: false,
      content: { code: "unknown_tool", message: "Outil inconnu." },
    });
  });

  it("rejects invalid input with invalid_input before touching data", async () => {
    const outcome = await runCustomTool(
      contextWith({}),
      "read_health_reports",
      {
        days: 90,
      },
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.content).toMatchObject({
      code: "invalid_input",
      message: toolErrorMessages.invalid_input,
    });
    expect(sources.readPlanningConstraints).not.toHaveBeenCalled();
  });

  it("validates ask_athlete input while the session keeps answering it", async () => {
    expect(() =>
      parseToolInput(askAthleteTool, {
        question: "Douleur ?",
        asked_for: "medical",
      }),
    ).toThrow();
    expect(() =>
      parseToolInput(askAthleteTool, {
        question: "Douleur ?",
        options: ["Oui"],
      }),
    ).toThrow();
    expect(
      parseToolInput(askAthleteTool, { question: " As-tu mal au genou ? " }),
    ).toEqual({ question: "As-tu mal au genou ?" });
    expect(
      parseToolInput(askAthleteTool, {
        question: "Où as-tu mal ?",
        options: ["Sur l’os", "Le long du tibia"],
      }),
    ).toEqual({
      question: "Où as-tu mal ?",
      options: ["Sur l’os", "Le long du tibia"],
    });
    const outcome = await runCustomTool(contextWith({}), "ask_athlete", {
      question: "As-tu mal au genou ?",
    });
    expect(outcome.content).toMatchObject({ code: "tool_unavailable" });
  });

  it("hides handler output that fails its schema behind tool_unavailable", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sources.readActivePlan.mockResolvedValue(storedPlan({ activeVersion: 0 }));
    const outcome = await runCustomTool(contextWith({}), "read_active_plan", {
      from: "2026-10-12",
      to: "2026-10-18",
    });
    expect(outcome).toEqual({
      ok: false,
      content: {
        code: "tool_unavailable",
        message: toolErrorMessages.tool_unavailable,
      },
    });
    expect(logged).toHaveBeenCalledWith(
      "Coaching tool output failed its schema",
      expect.objectContaining({ tool: "read_active_plan" }),
    );
  });
});

describe("read_active_plan", () => {
  it("returns the weeks and sessions of the range", async () => {
    const outcome = await runCustomTool(contextWith({}), "read_active_plan", {
      from: "2026-10-12",
      to: "2026-10-18",
    });
    expect(outcome.ok).toBe(true);
    const content = outcome.content as {
      today: string;
      plan: { version: number };
      weeks: unknown[];
      sessions: { sessionKey: string }[];
    };
    expect(content.today).toBe("2026-10-16");
    expect(content.plan.version).toBe(3);
    expect(content.weeks).toHaveLength(1);
    expect(content.sessions.map((session) => session.sessionKey)).toEqual([
      "s-2026-10-13-1",
      "s-2026-10-15-1",
    ]);
  });

  it.each([
    [{ from: "2026-10-12", to: "2026-12-12" }],
    [{ from: "2026-10-18", to: "2026-10-12" }],
  ])("rejects a range over 42 days or reversed: %o", async (input) => {
    const outcome = await runCustomTool(
      contextWith({}),
      "read_active_plan",
      input,
    );
    expect(outcome.content).toMatchObject({ code: "invalid_input" });
  });

  it.each(["read_active_plan", "read_plan_progress"])(
    "%s answers no_active_plan without a plan",
    async (name) => {
      sources.readActivePlan.mockResolvedValue(null);
      const outcome = await runCustomTool(contextWith({}), name, {
        from: "2026-10-12",
        to: "2026-10-18",
      });
      expect(outcome).toEqual({
        ok: false,
        content: { code: "no_active_plan", message: "Aucun plan actif." },
      });
    },
  );
});

describe("read_plan_progress", () => {
  it("reports each session's status and the matched activity, omitting absent values", async () => {
    sources.readSessionMatches.mockResolvedValue([
      {
        sessionKey: "s-2026-10-13-1",
        activityId,
        method: "auto",
        status: "completed",
        confidence: 0.9,
        compliance: { duration: 1, distance: null, intensity: null },
        algorithmVersion: "match-v1",
      },
      {
        sessionKey: "s-2026-10-25-1",
        activityId: null,
        method: "athlete",
        status: "dismissed",
        confidence: 1,
        compliance: { duration: null, distance: null, intensity: null },
        algorithmVersion: null,
      },
    ]);
    const { calls, client } = fakeClient({
      provider_activities: {
        data: [
          {
            id: activityId,
            provider: "garmin",
            activity_type: "running",
            started_at: "2026-10-13T16:00:00Z",
            local_started_at: "2026-10-13T18:00:00",
            duration_seconds: 2_712.4,
            distance_meters: 9_050,
            elevation_gain_meters: null,
          },
        ],
        error: null,
      },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_plan_progress",
      {
        from: "2026-10-12",
        to: "2026-10-25",
      },
    );
    expect(outcome.ok).toBe(true);
    const { sessions } = outcome.content as {
      sessions: { key: string; status: string; activities?: unknown[] }[];
    };
    expect(sessions.map((session) => [session.key, session.status])).toEqual([
      ["s-2026-10-13-1", "completed"],
      ["s-2026-10-15-1", "missed"],
      ["s-2026-10-20-1", "upcoming"],
      ["s-2026-10-22-1", "upcoming"],
      ["s-2026-10-25-1", "dismissed"],
    ]);
    expect(sessions[0]).toEqual({
      key: "s-2026-10-13-1",
      date: "2026-10-13",
      title: "Footing",
      kind: "easy",
      family: "run",
      isKey: false,
      status: "completed",
      planned: { durationSeconds: 2_700 },
      activities: [
        {
          type: "running",
          durationSeconds: 2_712,
          distanceMeters: 9_050,
          source: "garmin",
          asOf: "2026-10-13",
        },
      ],
    });
    expect(sessions[4].activities).toBeUndefined();
    expect(JSON.stringify(outcome.content)).not.toContain("null");
    expect(calls.every(scopedToAthlete)).toBe(true);
  });

  it("marks rest days and keeps today's unmatched session upcoming", () => {
    const [easy] = planState().sessions;
    expect(
      progressStatus(
        { ...easy, sport: "rest", kind: "rest" },
        undefined,
        "2026-10-20",
      ),
    ).toBe("rest");
    expect(progressStatus(easy, undefined, easy.scheduledOn)).toBe("upcoming");
    expect(progressStatus(easy, undefined, "2026-10-14")).toBe("missed");
    expect(progressStatus(easy, "partial", "2026-10-14")).toBe("partial");
  });
});

describe("read_plan_history", () => {
  const proposal = {
    id: proposalId,
    title: "Séance allégée",
    summary: "Footing raccourci",
    rationale: null,
    scope: "session",
    origin: "recovery",
    status: "applied",
    operations: [{ op: "skip_session", sessionKey: "s-2026-10-15-1" }],
    base_version: 2,
    applied_version: 3,
    created_at: "2026-10-14T08:00:00Z",
    updated_at: "2026-10-14T09:00:00Z",
    validation: null,
    specialist_opinions: [
      { specialist: "medical", verdict: "compatible", summary: "ok" },
    ],
  };

  it("returns proposals with their decisions, newest first, without nulls", async () => {
    const { calls, client } = fakeClient({
      plan_proposals: { data: [proposal], error: null },
      plan_decisions: {
        data: [
          {
            proposal_id: proposalId,
            decision: "applied",
            actor: "system",
            note: null,
            resulting_version: 3,
            created_at: "2026-10-14T09:00:00Z",
          },
          {
            proposal_id: proposalId,
            decision: "accepted",
            actor: "athlete",
            note: null,
            resulting_version: null,
            created_at: "2026-10-14T08:30:00Z",
          },
        ],
        error: null,
      },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_plan_history",
      {
        status: "applied",
      },
    );
    expect(outcome).toEqual({
      ok: true,
      content: {
        proposals: [
          {
            id: proposalId,
            title: "Séance allégée",
            summary: "Footing raccourci",
            scope: "session",
            origin: "recovery",
            status: "applied",
            operations: proposal.operations,
            baseVersion: 2,
            appliedVersion: 3,
            createdAt: proposal.created_at,
            updatedAt: proposal.updated_at,
            specialistOpinions: proposal.specialist_opinions,
            decisions: [
              {
                decision: "accepted",
                actor: "athlete",
                at: "2026-10-14T08:30:00Z",
              },
              {
                decision: "applied",
                actor: "system",
                at: "2026-10-14T09:00:00Z",
                resultingVersion: 3,
              },
            ],
          },
        ],
      },
    });
    expect(calls.every(scopedToAthlete)).toBe(true);
    expect(calls[0].steps).toContainEqual(["eq", "status", "applied"]);
    expect(calls[0].steps).toContainEqual([
      "order",
      "created_at",
      { ascending: false },
    ]);
    expect(calls[0].steps).toContainEqual(["limit", 5]);
  });

  it("answers without an active plan and summarizes new-plan operations", async () => {
    sources.readActivePlan.mockResolvedValue(null);
    const { client } = fakeClient({
      plan_proposals: {
        data: [
          {
            ...proposal,
            scope: "new_plan",
            status: "ready",
            base_version: null,
            applied_version: null,
            operations: [{ op: "create_plan", state: planState() }],
            specialist_opinions: [],
          },
        ],
        error: null,
      },
      plan_decisions: { data: [], error: null },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_plan_history",
      {},
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.content).toMatchObject({
      proposals: [
        {
          scope: "new_plan",
          operations: [
            {
              op: "create_plan",
              title: "Marathon de Paris",
              startsOn: "2026-10-12",
              endsOn: "2026-11-08",
              weeks: 4,
              sessions: 5,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(outcome.content)).not.toContain("structure");
    expect(sources.readActivePlan).not.toHaveBeenCalled();
  });

  it("answers not_found for a proposal id the athlete does not own", async () => {
    const { client } = fakeClient({
      plan_proposals: { data: [], error: null },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_plan_history",
      {
        proposalId,
      },
    );
    expect(outcome.content).toEqual({
      code: "not_found",
      message: toolErrorMessages.not_found,
    });
  });

  it("never leaks a database message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      plan_proposals: {
        data: null,
        error: { message: 'relation "plan_proposals" permission denied' },
      },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_plan_history",
      {},
    );
    expect(outcome.content).toEqual({
      code: "tool_unavailable",
      message: toolErrorMessages.tool_unavailable,
    });
  });
});

describe("create_plan_proposal", () => {
  const proposal = {
    title: "Footing décalé",
    summary: "Le footing passe à jeudi.",
    rationale: "Jambes lourdes au check-in.",
    origin: "recovery",
    specialist_opinions: [],
  };

  it("answers not_found for a session key outside the athlete's plan", async () => {
    const outcome = await runCustomTool(
      contextWith(fakeClient({}).client),
      "create_plan_proposal",
      {
        ...proposal,
        operations: [{ op: "skip_session", sessionKey: "s-other" }],
      },
    );
    expect(outcome.content).toMatchObject({
      code: "not_found",
      details: { keys: ["s-other"] },
    });
  });

  it("stores a valid proposal and returns its id", async () => {
    const { client } = fakeClient(
      {},
      { data: { id: proposalId, status: "ready" }, error: null },
    );
    const outcome = await runCustomTool(
      contextWith(client),
      "create_plan_proposal",
      {
        ...proposal,
        operations: [
          {
            op: "move_session",
            sessionKey: "s-2026-10-20-1",
            toDate: "2026-10-21",
          },
        ],
      },
    );
    expect(outcome).toEqual({
      ok: true,
      content: {
        proposalId,
        status: "ready",
        note: "The athlete must approve this proposal in the app.",
      },
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "submit_plan_proposal",
      expect.objectContaining({
        p_scope: "session",
        p_target_keys: ["s-2026-10-20-1"],
      }),
    );
  });

  it("links the proposal to the coach session that submitted it", async () => {
    const { client } = fakeClient(
      {},
      { data: { id: proposalId, status: "ready" }, error: null },
    );
    const coachSessionId = "c0000000-0000-4000-8000-00000000000c";
    await runCustomTool(
      { ...contextWith(client), coachSessionId },
      "create_plan_proposal",
      {
        ...proposal,
        operations: [{ op: "skip_session", sessionKey: "s-2026-10-20-1" }],
      },
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "submit_plan_proposal",
      expect.objectContaining({ p_coach_session_id: coachSessionId }),
    );
  });

  it("checks replaced session content strictly", async () => {
    const outcome = await runCustomTool(
      contextWith(fakeClient({}).client),
      "create_plan_proposal",
      {
        ...proposal,
        operations: [
          {
            op: "replace_session",
            sessionKey: "s-2026-10-20-1",
            content: { title: "x" },
          },
        ],
      },
    );
    expect(outcome.content).toMatchObject({ code: "invalid_input" });
  });

  it("hides the raw message of a failed submission", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(
      {},
      {
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      },
    );
    const outcome = await runCustomTool(
      contextWith(client),
      "create_plan_proposal",
      {
        ...proposal,
        operations: [{ op: "skip_session", sessionKey: "s-2026-10-20-1" }],
      },
    );
    expect(outcome.content).toEqual({
      code: "tool_unavailable",
      message: toolErrorMessages.tool_unavailable,
    });
  });
});

describe("submit_plan", () => {
  it("returns invalid_plan with the format issues", async () => {
    const outcome = await runCustomTool(contextWith({}), "submit_plan", {
      plan: { title: "Plan" },
    });
    expect(outcome.content).toMatchObject({
      code: "invalid_plan",
      message: toolErrorMessages.invalid_plan,
      details: expect.arrayContaining([
        expect.objectContaining({ path: "summary" }),
      ]),
    });
  });
});

describe("read_health_reports", () => {
  it("returns the check-ins of the window without unreported values", async () => {
    const { calls, client } = fakeClient({
      athlete_wellness_checkins: {
        data: checkinFixture.slice(0, 3),
        error: null,
      },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_health_reports",
      {
        days: 3,
      },
    );
    expect(outcome.ok).toBe(true);
    expect((outcome.content as { checkins: unknown[] }).checkins[2]).toEqual({
      date: "2026-10-12",
      legs: "fresh",
      stress: "low",
    });
    expect(calls[0].steps).toContainEqual([
      "gte",
      "checkin_date",
      "2026-10-13",
    ]);
    expect(calls.every(scopedToAthlete)).toBe(true);
  });
});

describe("read_athlete_context", () => {
  const packetBeforeBytes = 7_212;

  function packet() {
    return buildAthleteContext({
      today: fixtureToday,
      planning: planningInputFixture(),
      profile: profileFixture(),
      stored: storedPlan(),
      checkins: checkinFixture.map((row) => ({
        date: row.checkin_date,
        legs: row.legs,
        ...(row.soreness ? { soreness: row.soreness } : {}),
        stress: row.stress,
      })),
      predictionRows: predictionFixture,
    });
  }

  it("stays under the packet budget recorded against the previous packet", () => {
    const bytes = Buffer.byteLength(JSON.stringify(packet()));
    expect(bytes).toBeLessThan(contextPacketBudgetBytes);
    expect(bytes).toBeLessThan(packetBeforeBytes / 2);
  });

  it("omits absent and past values and tags Garmin values with source and date", () => {
    const context = packet();
    expect(JSON.stringify(context)).not.toContain("null");
    expect(context.races?.map((race) => race.name)).toEqual([
      "Marathon de Lyon",
      "Semi de Paris",
    ]);
    expect(context.races?.[1]).not.toHaveProperty("targetSeconds");
    expect(context.availability.unavailable).toEqual([
      {
        from: "2026-12-20",
        to: "2026-12-27",
        kind: "travel",
        reason: "Vacances",
      },
    ]);
    expect(context.garmin).toEqual({
      vo2Max: { value: 56, source: "garmin", asOf: "2026-10-12" },
      lactateThreshold: {
        speedMps: 3.8,
        heartRateBpm: 171,
        source: "garmin",
        asOf: "2026-10-01",
      },
      racePredictions: {
        "10k": { seconds: 2_610, source: "garmin", asOf: "2026-10-12" },
        half_marathon: { seconds: 5_790, source: "garmin", asOf: "2026-10-12" },
        marathon: { seconds: 12_300, source: "garmin", asOf: "2026-10-12" },
      },
    });
    expect(context.checkins).toHaveLength(7);
    expect(context.history.weeks).toHaveLength(8);
  });

  it("omits Garmin, races and the plan header when there are none", () => {
    const planning = planningInputFixture();
    const context = buildAthleteContext({
      today: fixtureToday,
      planning: {
        ...planning,
        races: [],
        targets: {
          ...planning.targets,
          vo2Max: null,
          garminLactateThreshold: null,
        },
      },
      profile: { ...profileFixture(), weight_kg: null, sex: null },
      stored: null,
      checkins: [],
      predictionRows: [],
    });
    expect(context).not.toHaveProperty("garmin");
    expect(context).not.toHaveProperty("races");
    expect(context).not.toHaveProperty("activePlan");
    expect(context).not.toHaveProperty("checkins");
    expect(context.athlete).not.toHaveProperty("weightKg");
    expect(context.athlete).not.toHaveProperty("sex");
  });

  it("omits a non-positive age or race distance instead of failing", () => {
    const planning = planningInputFixture();
    const context = buildAthleteContext({
      today: fixtureToday,
      planning: {
        ...planning,
        races: [{ ...planning.races[0], distanceKm: 0 }],
      },
      profile: { ...profileFixture(), birth_date: fixtureToday },
      stored: null,
      checkins: [],
      predictionRows: [],
    });
    expect(context.athlete).not.toHaveProperty("age");
    expect(context.races?.[0]).not.toHaveProperty("distanceKm");
    expect(athleteContextSchema.safeParse(context).success).toBe(true);
  });

  it("passes its output schema through the registry", async () => {
    const { calls, client } = fakeClient({
      athlete_wellness_checkins: {
        data: checkinFixture.slice(0, 7),
        error: null,
      },
      provider_observations: { data: predictionFixture, error: null },
    });
    const outcome = await runCustomTool(
      contextWith(client),
      "read_athlete_context",
      {},
    );
    expect(outcome.ok).toBe(true);
    expect(calls.every(scopedToAthlete)).toBe(true);
  });
});

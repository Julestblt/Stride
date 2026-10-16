import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const store = vi.hoisted(() => ({
  findOwnSession: vi.fn(),
  recordSession: vi.fn(),
  updateSession: vi.fn(),
}));
const managed = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  stream: vi.fn(),
  send: vi.fn(),
}));
const runCustomTool = vi.hoisted(() => vi.fn());
const syncAthleteVault = vi.hoisted(() => vi.fn());

vi.mock("../../src/server/coaching/managed/store", async (original) => ({
  ...(await original<object>()),
  ...store,
}));
vi.mock("../../src/server/coaching/managed/resources", () => ({
  managedResources: {
    workspaceId: "wrkspc_test",
    coachAgentId: "agent_test",
    environmentId: "env_test",
    garminMcpUrl: "https://garmin.test/mcp",
  },
  consoleSessionUrl: (id: string) => `https://console.test/${id}`,
  managedClient: () => ({
    beta: {
      sessions: {
        retrieve: managed.retrieve,
        create: managed.create,
        events: { stream: managed.stream, send: managed.send },
      },
    },
  }),
}));
vi.mock("../../src/server/coaching/tools/registry", async (original) => ({
  ...(await original<object>()),
  runCustomTool,
}));
vi.mock("../../src/server/coaching/managed/vault", () => ({
  syncAthleteVault,
}));

import {
  assertTurnAllowed,
  SessionAccessError,
  SessionStateError,
  streamCoachTurn,
  turnMessages,
  type TurnEvent,
} from "../../src/server/coaching/managed/session";
import type { CoachSessionRecord } from "../../src/server/coaching/managed/store";
import {
  accessTokenExpiry,
  tokenNeedsRefresh,
  turnAccessToken,
  turnTimeoutMs,
} from "../../src/server/coaching/managed/token";
import type { OnboardingContext } from "../../src/server/onboarding/context";

const athleteA = "a0000000-0000-4000-8000-00000000000a";
const athleteB = "b0000000-0000-4000-8000-00000000000b";
const now = Date.parse("2026-10-16T10:00:00Z");

function jwt(expiresAtMs: number) {
  const payload = Buffer.from(
    JSON.stringify({ sub: athleteA, exp: Math.floor(expiresAtMs / 1000) }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

function contextFor(
  userId: string,
  accessToken = jwt(Date.now() + 3_600_000),
  refreshSession = vi.fn(),
) {
  return {
    userId,
    email: null,
    accessToken,
    client: { auth: { refreshSession } },
  } as unknown as OnboardingContext;
}

function record(overrides: Partial<CoachSessionRecord> = {}) {
  return {
    managedSessionId: "sesn_01A",
    mode: "conversation",
    status: "idle",
    pendingToolUseId: null,
    budgetCents: 100,
    listCostCents: 0,
    lastTurnAt: null,
    ...overrides,
  } satisfies CoachSessionRecord;
}

function streamOf(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

async function collect(generator: AsyncGenerator<TurnEvent>) {
  const events: TurnEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe("turn access token", () => {
  it("reads the expiry from the access token", () => {
    expect(accessTokenExpiry(jwt(now))).toBe(Math.floor(now / 1000) * 1000);
    expect(accessTokenExpiry("not-a-token")).toBeNull();
  });

  it("refreshes only when the token expires within the turn timeout", () => {
    expect(tokenNeedsRefresh(now + turnTimeoutMs + 1000, now)).toBe(false);
    expect(tokenNeedsRefresh(now + turnTimeoutMs, now)).toBe(true);
    expect(tokenNeedsRefresh(now - 1000, now)).toBe(true);
    expect(tokenNeedsRefresh(null, now)).toBe(true);
  });

  it("keeps a token that outlives the turn", async () => {
    const refresh = vi.fn();
    const context = contextFor(athleteA, jwt(now + 3_600_000), refresh);
    expect(await turnAccessToken(context, now)).toBe(context.accessToken);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a token that would expire mid-turn", async () => {
    const fresh = jwt(now + 3_600_000);
    const refresh = vi.fn().mockResolvedValue({
      data: { session: { access_token: fresh, user: { id: athleteA } } },
      error: null,
    });
    const context = contextFor(athleteA, jwt(now + 60_000), refresh);
    expect(await turnAccessToken(context, now)).toBe(fresh);
  });

  it("reports the token as unavailable when the refresh fails", async () => {
    const failed = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("refresh_token_already_used"),
    });
    expect(
      await turnAccessToken(contextFor(athleteA, jwt(now), failed), now),
    ).toBeNull();
    const foreign = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: jwt(now + 3_600_000),
          user: { id: athleteB },
        },
      },
      error: null,
    });
    expect(
      await turnAccessToken(contextFor(athleteA, jwt(now), foreign), now),
    ).toBeNull();
  });
});

describe("turn preconditions", () => {
  const message = { kind: "message", text: "Salut" } as const;
  const answer = { kind: "answer", toolUseId: "sevt_1", text: "Oui" } as const;

  it("rejects closed sessions", () => {
    for (const status of ["budget_reached", "failed", "terminated"] as const)
      expect(() => assertTurnAllowed(record({ status }), message, now)).toThrow(
        SessionStateError,
      );
  });

  it("rejects a second turn while one is running, unless it is stale", () => {
    const recent = new Date(now - 60_000).toISOString();
    const stale = new Date(now - turnTimeoutMs - 1).toISOString();
    expect(() =>
      assertTurnAllowed(
        record({ status: "running", lastTurnAt: recent }),
        message,
        now,
      ),
    ).toThrow("turn_in_progress");
    expect(() =>
      assertTurnAllowed(
        record({ status: "running", lastTurnAt: stale }),
        message,
        now,
      ),
    ).not.toThrow();
  });

  it("requires the answer to the pending question", () => {
    const waiting = record({
      status: "awaiting_athlete",
      pendingToolUseId: "sevt_1",
    });
    expect(() => assertTurnAllowed(waiting, message, now)).toThrow(
      "answer_required",
    );
    expect(() => assertTurnAllowed(waiting, answer, now)).not.toThrow();
    expect(() =>
      assertTurnAllowed(waiting, { ...answer, toolUseId: "sevt_2" }, now),
    ).toThrow("no_pending_question");
    expect(() => assertTurnAllowed(record(), answer, now)).toThrow(
      "no_pending_question",
    );
  });
});

describe("coach turn stream", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    syncAthleteVault.mockResolvedValue("vlt_test");
    store.updateSession.mockResolvedValue(undefined);
    managed.send.mockResolvedValue({});
    managed.retrieve.mockResolvedValue({
      id: "sesn_01A",
      metadata: { stride_user_id: athleteA },
      usage: { list_cost: { amount: "37", currency: "USD" } },
    });
  });

  afterEach(() => vi.useRealTimers());

  const request = {
    sessionId: "sesn_01A",
    mode: "conversation",
    input: { kind: "message", text: "Comment se passe ma semaine ?" },
  } as const;

  it("does not let a second athlete resume or read another session", async () => {
    store.findOwnSession.mockResolvedValue(null);
    await expect(
      collect(streamCoachTurn(contextFor(athleteB), request)),
    ).rejects.toBeInstanceOf(SessionAccessError);
    expect(managed.stream).not.toHaveBeenCalled();
    expect(managed.send).not.toHaveBeenCalled();
  });

  it("rejects a recorded session whose Managed Agents owner differs", async () => {
    store.findOwnSession.mockResolvedValue(record());
    await expect(
      collect(streamCoachTurn(contextFor(athleteB), request)),
    ).rejects.toBeInstanceOf(SessionAccessError);
    expect(managed.stream).not.toHaveBeenCalled();
  });

  it("creates a budgeted session owned by the athlete", async () => {
    store.recordSession.mockResolvedValue(record({ status: "running" }));
    managed.create.mockResolvedValue({ id: "sesn_01A" });
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    await collect(
      streamCoachTurn(contextFor(athleteA), {
        ...request,
        sessionId: undefined,
      }),
    );
    expect(managed.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vault_ids: ["vlt_test"],
        metadata: { stride_user_id: athleteA, mode: "conversation" },
        budget: {
          type: "limit",
          max_list_cost: { amount: "100", currency: "USD" },
        },
      }),
    );
    expect(store.recordSession).toHaveBeenCalledWith(expect.anything(), {
      managedSessionId: "sesn_01A",
      mode: "conversation",
      budgetCents: 100,
    });
  });

  it("answers an invalid ask_athlete call with an error instead of pausing", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_ask",
          name: "ask_athlete",
          input: { question: "Depuis quand ?" },
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );

    expect(runCustomTool).not.toHaveBeenCalled();
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [
        expect.objectContaining({
          type: "user.custom_tool_result",
          custom_tool_use_id: "sevt_ask",
          is_error: true,
          content: [
            {
              type: "text",
              text: expect.stringContaining('"code":"invalid_input"'),
            },
          ],
        }),
      ],
    });
    expect(events.map((event) => event.type)).not.toContain("question");
    expect(events.at(-1)).toMatchObject({ status: "idle" });
  });

  it("streams a turn, answers custom tools and pauses on ask_athlete", async () => {
    store.findOwnSession.mockResolvedValue(record());
    runCustomTool.mockResolvedValue({ ok: true, content: { today: "x" } });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_tool",
          name: "read_athlete_context",
          input: {},
        },
        {
          type: "agent.thread_message_sent",
          to_agent_name: "Stride Medical",
          content: [{ type: "text", text: "Douleur au genou ?" }],
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_ask",
          name: "ask_athlete",
          input: { question: "Depuis quand ?", asked_for: "medical" },
        },
        {
          type: "session.status_idle",
          stop_reason: { type: "requires_action" },
        },
        {
          type: "agent.message",
          content: [{ type: "text", text: "never reached" }],
        },
      ]),
    );

    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );

    expect(syncAthleteVault).toHaveBeenCalledWith(athleteA, expect.any(String));
    expect(runCustomTool).toHaveBeenCalledWith(
      expect.anything(),
      "read_athlete_context",
      {},
    );
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [
        expect.objectContaining({
          type: "user.custom_tool_result",
          custom_tool_use_id: "sevt_tool",
          is_error: false,
        }),
      ],
    });
    expect(events.map((event) => event.type)).toEqual([
      "session",
      "tool",
      "delegation",
      "question",
      "done",
    ]);
    expect(events.at(-1)).toMatchObject({
      status: "awaiting_athlete",
      listCostCents: 37,
    });
    expect(store.updateSession).toHaveBeenLastCalledWith(
      expect.anything(),
      "sesn_01A",
      {
        status: "awaiting_athlete",
        pendingToolUseId: "sevt_ask",
        listCostCents: 37,
      },
    );
  });

  it("resumes with the athlete's answer to the pending question", async () => {
    store.findOwnSession.mockResolvedValue(
      record({ status: "awaiting_athlete", pendingToolUseId: "sevt_ask" }),
    );
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.message",
          content: [{ type: "text", text: "Merci, je réduis la séance." }],
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), {
        ...request,
        input: { kind: "answer", toolUseId: "sevt_ask", text: "Deux jours" },
      }),
    );
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [
        {
          type: "user.custom_tool_result",
          custom_tool_use_id: "sevt_ask",
          content: [{ type: "text", text: "Deux jours" }],
        },
      ],
    });
    expect(events).toContainEqual({
      type: "coach",
      text: "Merci, je réduis la séance.",
    });
    expect(events.at(-1)).toMatchObject({ status: "idle" });
  });

  it("closes the session when its budget is reached", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.status_idle",
          stop_reason: { type: "budget_reached" },
        },
      ]),
    );
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );
    expect(events).toContainEqual({
      type: "error",
      code: "budget_reached",
      text: turnMessages.budget,
    });
    expect(events.at(-1)).toMatchObject({ status: "budget_reached" });
  });

  it("interrupts a turn that exceeds the timeout with a French message", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockImplementation(
      async (
        _id: string,
        _params: unknown,
        options: { signal: AbortSignal },
      ) => ({
        async *[Symbol.asyncIterator]() {
          await new Promise((_, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          );
        },
      }),
    );
    const pending = collect(streamCoachTurn(contextFor(athleteA), request));
    await vi.advanceTimersByTimeAsync(turnTimeoutMs);
    const events = await pending;
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [{ type: "user.interrupt" }],
    });
    expect(events).toContainEqual({
      type: "error",
      code: "timeout",
      text: turnMessages.timeout,
    });
    expect(events.at(-1)).toMatchObject({ status: "timed_out" });
  });

  it("archives Garmin access when the token cannot be refreshed", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    const refresh = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("refresh failed"),
    });
    const events = await collect(
      streamCoachTurn(
        contextFor(athleteA, jwt(Date.now() + 60_000), refresh),
        request,
      ),
    );
    expect(syncAthleteVault).toHaveBeenCalledWith(athleteA, null);
    expect(events.at(-1)).toMatchObject({ garmin: "unavailable" });
  });
});

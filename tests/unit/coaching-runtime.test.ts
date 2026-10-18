import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const store = vi.hoisted(() => ({
  findOwnSession: vi.fn(),
  recordSession: vi.fn(),
  updateSession: vi.fn(),
  appendThreadItem: vi.fn(),
  recordComposing: vi.fn(),
}));
const managed = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  stream: vi.fn(),
  send: vi.fn(),
}));
const runCustomTool = vi.hoisted(() => vi.fn());
const syncAthleteVault = vi.hoisted(() => vi.fn());
const resolveAttachments = vi.hoisted(() => vi.fn());

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
vi.mock("../../src/server/coaching/attachments", async (original) => ({
  ...(await original<object>()),
  resolveAttachments,
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
  AttachmentAccessError,
  attachmentContextSchema,
} from "../../src/server/coaching/attachments";
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
    id: "c0000000-0000-4000-8000-00000000000c",
    managedSessionId: "sesn_01A",
    mode: "conversation",
    status: "idle",
    pendingToolUseId: null,
    budgetCents: 100,
    listCostCents: 0,
    lastTurnAt: null,
    title: "Ma semaine",
    lastActivityAt: "2026-10-16T09:00:00Z",
    readAt: null,
    composingSince: null,
    createdAt: "2026-10-16T09:00:00Z",
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
    store.appendThreadItem.mockResolvedValue(undefined);
    store.recordComposing.mockResolvedValue(undefined);
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
      title: "Comment se passe ma semaine",
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
          input: { question: "Depuis quand ?", options: ["Hier"] },
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

  it("refuses tools outside the calling agent's allowlist without running them", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_unknown",
          name: "read_file_placeholder",
          input: {},
        },
        {
          type: "session.thread_created",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_proposal",
          name: "create_plan_proposal",
          input: {},
          session_thread_id: "sthr_medical",
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );

    expect(runCustomTool).not.toHaveBeenCalled();
    for (const id of ["sevt_unknown", "sevt_proposal"])
      expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
        events: [
          expect.objectContaining({
            custom_tool_use_id: id,
            is_error: true,
            content: [
              {
                type: "text",
                text: expect.stringContaining('"code":"unknown_tool"'),
              },
            ],
          }),
        ],
      });
    expect(
      events.flatMap((event) =>
        event.type === "tool" ? [[event.name, event.ok]] : [],
      ),
    ).toEqual([
      ["read_file_placeholder", false],
      ["create_plan_proposal", false],
    ]);
    expect(events.map((event) => event.type)).not.toContain("question");
    expect(events.at(-1)).toMatchObject({ status: "idle" });
  });

  it("runs a tool the calling specialist is allowed to use", async () => {
    store.findOwnSession.mockResolvedValue(record());
    runCustomTool.mockResolvedValue({ ok: true, content: { days: [] } });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.thread_status_running",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_reports",
          name: "read_health_reports",
          input: { days: 7 },
          session_thread_id: "sthr_medical",
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(streamCoachTurn(contextFor(athleteA), request));

    expect(runCustomTool).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: athleteA,
        coachSessionId: "c0000000-0000-4000-8000-00000000000c",
      }),
      "read_health_reports",
      { days: 7 },
    );
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
          input: { question: "Depuis quand ?" },
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
    expect(
      events.flatMap((event) => (event.type === "item" ? [] : [event.type])),
    ).toEqual(["session", "tool", "delegation", "question", "done"]);
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

  it("records while the Coach composes and clears it when the request ends", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "span.model_request_start", id: "span_1" },
        { type: "span.model_request_end", id: "span_2" },
        { type: "span.model_request_start", id: "span_3" },
        {
          type: "session.status_idle",
          stop_reason: { type: "end_turn" },
        },
      ]),
    );
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );
    const composing = events.filter((event) => event.type === "composing");
    expect(composing).toEqual([
      { type: "composing", since: expect.any(String) },
      { type: "composing", since: null },
      { type: "composing", since: expect.any(String) },
    ]);
    expect(store.recordComposing.mock.calls.map((call) => call[2])).toEqual([
      expect.any(String),
      null,
      expect.any(String),
    ]);
    expect(store.updateSession).toHaveBeenLastCalledWith(
      expect.anything(),
      "sesn_01A",
      expect.objectContaining({ status: "idle" }),
    );
    expect(store.updateSession.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      store.recordComposing.mock.invocationCallOrder.at(-1)!,
    );
  });

  it("does not show a specialist's model request as the Coach composing", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.thread_created",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "span.model_request_start",
          id: "span_1",
          session_thread_id: "sthr_medical",
        },
        {
          type: "session.status_idle",
          stop_reason: { type: "end_turn" },
        },
      ]),
    );
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );
    expect(events.some((event) => event.type === "composing")).toBe(false);
    expect(store.recordComposing).not.toHaveBeenCalled();
  });

  it("never interrupts a turn that ends on its own", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "agent.message", content: [{ type: "text", text: "Voilà." }] },
        {
          type: "session.status_idle",
          stop_reason: { type: "end_turn" },
        },
      ]),
    );
    await collect(streamCoachTurn(contextFor(athleteA), request));
    expect(managed.send).not.toHaveBeenCalledWith("sesn_01A", {
      events: [{ type: "user.interrupt" }],
    });
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

  function persistedKinds() {
    return store.appendThreadItem.mock.calls.map((call) => call[2].kind);
  }

  it("persists the athlete-visible items of a medical consult under the thread", async () => {
    store.findOwnSession.mockResolvedValue(record());
    runCustomTool.mockResolvedValue({ ok: true, content: { checkins: [] } });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.thread_message_sent",
          to_agent_name: "Stride Medical",
          to_session_thread_id: "sthr_medical",
          content: [{ type: "text", text: "Knee pain, can he run?" }],
        },
        {
          type: "session.thread_created",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_reports",
          name: "read_health_reports",
          input: { days: 14 },
          session_thread_id: "sthr_medical",
        },
        {
          type: "agent.mcp_tool_use",
          name: "get_hrv_data",
          input: {},
          session_thread_id: "sthr_medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_ask",
          name: "ask_athlete",
          input: {
            question: "Comment réagit ton genou en descente ?",
            options: ["Aucune gêne", "Gêne légère"],
          },
          session_thread_id: "sthr_medical",
        },
        {
          type: "session.thread_status_idle",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
          stop_reason: { type: "requires_action" },
        },
        {
          type: "session.status_idle",
          stop_reason: { type: "requires_action" },
        },
      ]),
    );

    const events = await collect(
      streamCoachTurn(contextFor(athleteA), {
        ...request,
        input: {
          kind: "message",
          text: "J'ai mal au genou",
          consult: "medical",
        },
      }),
    );

    expect(events[0]).toMatchObject({
      type: "session",
      threadId: "c0000000-0000-4000-8000-00000000000c",
    });
    expect(managed.send.mock.calls[0][1].events[0].content).toEqual([
      { type: "text", text: "J'ai mal au genou" },
      {
        type: "text",
        text: "Noms dans ce groupe : coach Claire, médecin Inès.",
      },
      { type: "text", text: expect.stringContaining("Stride Medical") },
    ]);
    expect(persistedKinds()).toEqual([
      "athlete",
      "consult_request",
      "read",
      "read",
      "question",
    ]);
    for (const [, threadId] of store.appendThreadItem.mock.calls)
      expect(threadId).toBe("c0000000-0000-4000-8000-00000000000c");
    const items = store.appendThreadItem.mock.calls.map(([, , item]) => item);
    expect(items[0]).toMatchObject({
      text: "J'ai mal au genou",
      consult: "medical",
    });
    expect(items[2]).toMatchObject({
      agent: "medical",
      label: "Signalements · 14 jours",
    });
    expect(items[3]).toMatchObject({ agent: "medical", label: "Garmin · VFC" });
    expect(items[4]).toMatchObject({
      toolUseId: "sevt_ask",
      askedFor: "medical",
      options: ["Aucune gêne", "Gêne légère"],
    });
    expect(events).toContainEqual({
      type: "question",
      question: {
        toolUseId: "sevt_ask",
        question: "Comment réagit ton genou en descente ?",
        options: ["Aucune gêne", "Gêne légère"],
        askedFor: "medical",
      },
    });
    expect(
      events
        .filter((event) => event.type === "item")
        .map((event) => event.item),
    ).toEqual(items);
  });

  it("sends the answer to the asking specialist and records its reply under its name", async () => {
    store.findOwnSession.mockResolvedValue(
      record({ status: "awaiting_athlete", pendingToolUseId: "sevt_ask" }),
    );
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.thread_status_running",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.thread_message_received",
          from_agent_name: "Stride Medical",
          from_session_thread_id: "sthr_medical",
          content: [{ type: "text", text: "@Jules Alors c’est compatible." }],
        },
        {
          type: "session.thread_status_idle",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
          stop_reason: { type: "end_turn" },
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(
      streamCoachTurn(contextFor(athleteA), {
        ...request,
        input: { kind: "answer", toolUseId: "sevt_ask", text: "Aucune gêne" },
      }),
    );

    expect(managed.send.mock.calls[0][1].events[0]).toEqual({
      type: "user.custom_tool_result",
      custom_tool_use_id: "sevt_ask",
      content: [{ type: "text", text: "Aucune gêne" }],
    });
    const items = store.appendThreadItem.mock.calls.map(([, , item]) => item);
    expect(items.map((item) => item.kind)).toEqual([
      "answer",
      "consult_reply",
      "consult_end",
    ]);
    expect(items[1]).toMatchObject({
      agent: "medical",
      text: "@Jules Alors c’est compatible.",
    });
  });

  it("posts a specialist's message to the athlete under its name", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.thread_created",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_msg",
          name: "message_athlete",
          input: { text: "@Jules Pas de course demain." },
          session_thread_id: "sthr_medical",
        },
        {
          type: "agent.custom_tool_use",
          id: "sevt_bad",
          name: "message_athlete",
          input: { text: "" },
          session_thread_id: "sthr_medical",
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(streamCoachTurn(contextFor(athleteA), request));

    expect(runCustomTool).not.toHaveBeenCalled();
    const items = store.appendThreadItem.mock.calls.map(([, , item]) => item);
    expect(items.filter((item) => item.kind === "staff_message")).toEqual([
      expect.objectContaining({
        thread: "sthr_medical",
        agent: "medical",
        text: "@Jules Pas de course demain.",
      }),
    ]);
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [
        expect.objectContaining({
          custom_tool_use_id: "sevt_msg",
          is_error: false,
          content: [{ type: "text", text: '{"shown":true}' }],
        }),
      ],
    });
    expect(managed.send).toHaveBeenCalledWith("sesn_01A", {
      events: [
        expect.objectContaining({
          custom_tool_use_id: "sevt_bad",
          is_error: true,
        }),
      ],
    });
  });

  it("records a proposal card with its attributed reasons", async () => {
    store.findOwnSession.mockResolvedValue(record());
    const proposalId = "d0000000-0000-4000-8000-00000000000d";
    runCustomTool.mockResolvedValue({
      ok: true,
      content: { proposalId, status: "ready", note: "x" },
    });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_proposal",
          name: "create_plan_proposal",
          input: {
            title: "Seuil décalé",
            summary: "Le seuil passe à jeudi.",
            specialist_opinions: [
              { specialist: "medical", verdict: "ok", summary: "Genou calme." },
            ],
          },
        },
        {
          type: "agent.message",
          content: [{ type: "text", text: "Voici ma proposition." }],
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(streamCoachTurn(contextFor(athleteA), request));

    const items = store.appendThreadItem.mock.calls.map(([, , item]) => item);
    expect(items.map((item) => item.kind)).toEqual([
      "athlete",
      "proposal",
      "coach",
    ]);
    expect(items[1]).toMatchObject({
      proposalId,
      scope: "session",
      title: "Seuil décalé",
      opinions: [{ agent: "medical", verdict: "ok", summary: "Genou calme." }],
    });
  });

  it("records a proposal card for a plan extension", async () => {
    store.findOwnSession.mockResolvedValue(record());
    const proposalId = "f0000000-0000-4000-8000-00000000000f";
    runCustomTool.mockResolvedValue({
      ok: true,
      content: {
        proposalId,
        addedWeeks: 20,
        addedSessions: 90,
        warnings: [],
        note: "x",
      },
    });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_extend",
          name: "extend_plan",
          input: {
            title: "Cap sur l’Ecotrail 120 km",
            summary: "Le plan continue jusqu’au 20/03/2027.",
            specialist_opinions: [],
          },
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(streamCoachTurn(contextFor(athleteA), request));

    expect(store.appendThreadItem.mock.calls[1][2]).toMatchObject({
      kind: "proposal",
      proposalId,
      scope: "session",
      title: "Cap sur l’Ecotrail 120 km",
      summary: "Le plan continue jusqu’au 20/03/2027.",
    });
  });

  it("records a new-plan proposal from submit_plan", async () => {
    store.findOwnSession.mockResolvedValue(record({ mode: "plan" }));
    const proposalId = "e0000000-0000-4000-8000-00000000000e";
    runCustomTool.mockResolvedValue({
      ok: true,
      content: { proposalId, weeks: 12, sessions: 40, warnings: [], note: "x" },
    });
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.custom_tool_use",
          id: "sevt_submit",
          name: "submit_plan",
          input: { plan: { title: "Marathon 2027", summary: "12 semaines" } },
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );

    await collect(
      streamCoachTurn(contextFor(athleteA), { ...request, mode: "plan" }),
    );

    expect(store.appendThreadItem.mock.calls[1][2]).toMatchObject({
      kind: "proposal",
      proposalId,
      scope: "new_plan",
      title: "Marathon 2027",
    });
  });

  it("records the answer and a closing error in the thread", async () => {
    store.findOwnSession.mockResolvedValue(
      record({ status: "awaiting_athlete", pendingToolUseId: "sevt_ask" }),
    );
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.status_idle",
          stop_reason: { type: "budget_reached" },
        },
      ]),
    );
    await collect(
      streamCoachTurn(contextFor(athleteA), {
        ...request,
        input: { kind: "answer", toolUseId: "sevt_ask", text: "Non" },
      }),
    );
    const items = store.appendThreadItem.mock.calls.map(([, , item]) => item);
    expect(items).toMatchObject([
      { kind: "answer", toolUseId: "sevt_ask", text: "Non" },
      { kind: "error", code: "budget_reached", text: turnMessages.budget },
    ]);
  });

  it("keeps streaming when an item cannot be recorded", async () => {
    store.findOwnSession.mockResolvedValue(record());
    store.appendThreadItem.mockRejectedValue(new Error("rls"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.message",
          content: [{ type: "text", text: "Salut" }],
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );
    expect(events.at(-1)).toMatchObject({ type: "done", status: "idle" });
  });

  it("attributes messages to the Coach unless they come from a known specialist thread", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "session.thread_created",
          session_thread_id: "sthr_medical",
          agent_name: "Stride Medical",
        },
        {
          type: "agent.message",
          session_thread_id: "sthr_medical",
          content: [{ type: "text", text: "Reading the check-ins." }],
        },
        {
          type: "agent.message",
          session_thread_id: "sthr_primary",
          content: [{ type: "text", text: "Voici mon avis." }],
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    await collect(streamCoachTurn(contextFor(athleteA), request));
    const items = store.appendThreadItem.mock.calls.map((call) => call[2]);
    expect(items.slice(1)).toMatchObject([
      { kind: "consult_note", agent: "medical", thread: "sthr_medical" },
      { kind: "coach", text: "Voici mon avis." },
    ]);
  });

  it("records a failed turn when the stream throws mid-turn", async () => {
    store.findOwnSession.mockResolvedValue(record());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    managed.stream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          type: "agent.message",
          content: [{ type: "text", text: "Je regarde." }],
        };
        throw new Error("socket closed");
      },
    });
    const events = await collect(
      streamCoachTurn(contextFor(athleteA), request),
    );
    expect(events).toContainEqual({
      type: "error",
      code: "failed",
      text: turnMessages.failed,
    });
    expect(store.appendThreadItem.mock.calls.at(-1)?.[2]).toMatchObject({
      kind: "error",
      code: "failed",
    });
    expect(store.updateSession).toHaveBeenLastCalledWith(
      expect.anything(),
      "sesn_01A",
      expect.objectContaining({ status: "failed" }),
    );
    expect(events.at(-1)).toMatchObject({ type: "done", status: "failed" });
  });

  it("clamps long texts instead of dropping the item", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        {
          type: "agent.message",
          content: [{ type: "text", text: "a".repeat(30_000) }],
        },
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    await collect(streamCoachTurn(contextFor(athleteA), request));
    expect(store.appendThreadItem.mock.calls[1][2].text).toHaveLength(7000);
  });

  it("hands the staff a typed context block and records the attached items", async () => {
    store.findOwnSession.mockResolvedValue(record());
    resolveAttachments.mockResolvedValue([
      {
        kind: "activity",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        title: "Sortie longue vallonnée",
        date: "2026-10-04",
        distanceKm: 24.6,
      },
      {
        kind: "race",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "Trail des Lacs",
        date: "2027-06-27",
        raceKind: "trail",
        priority: "B",
      },
    ]);
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    const refs = [
      { kind: "activity", id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001" },
      { kind: "race", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    ] as const;
    const context = contextFor(athleteA);
    await collect(
      streamCoachTurn(context, {
        ...request,
        input: { kind: "message", text: "Analyse ça", attachments: [...refs] },
      }),
    );
    expect(resolveAttachments).toHaveBeenCalledWith(context, refs);
    const content = managed.send.mock.calls[0][1].events[0].content as {
      text: string;
    }[];
    expect(content[0].text).toBe("Analyse ça");
    const block = attachmentContextSchema.parse(JSON.parse(content[1].text));
    expect(
      block.attachments.map(({ kind, id, title, date }) => ({
        kind,
        id,
        title,
        date,
      })),
    ).toEqual([
      {
        kind: "activity",
        id: refs[0].id,
        title: "Sortie longue vallonnée",
        date: "2026-10-04",
      },
      {
        kind: "race",
        id: refs[1].id,
        title: "Trail des Lacs",
        date: "2027-06-27",
      },
    ]);
    expect(store.appendThreadItem.mock.calls[0][2]).toMatchObject({
      kind: "athlete",
      text: "Analyse ça",
      attachments: [
        { kind: "activity", title: "Sortie longue vallonnée" },
        { kind: "race", title: "Trail des Lacs", date: "2027-06-27" },
      ],
    });
  });

  it("refuses the turn before anything is recorded when an item is not the athlete's", async () => {
    resolveAttachments.mockRejectedValue(new AttachmentAccessError());
    await expect(
      collect(
        streamCoachTurn(contextFor(athleteA), {
          ...request,
          input: {
            kind: "message",
            text: "Analyse ça",
            attachments: [{ kind: "race", id: "foreign" }],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(AttachmentAccessError);
    expect(store.findOwnSession).not.toHaveBeenCalled();
    expect(store.recordSession).not.toHaveBeenCalled();
    expect(store.appendThreadItem).not.toHaveBeenCalled();
    expect(managed.send).not.toHaveBeenCalled();
  });

  it("does not read attachments for a plain message", async () => {
    store.findOwnSession.mockResolvedValue(record());
    managed.stream.mockResolvedValue(
      streamOf([
        { type: "session.status_idle", stop_reason: { type: "end_turn" } },
      ]),
    );
    await collect(streamCoachTurn(contextFor(athleteA), request));
    expect(resolveAttachments).not.toHaveBeenCalled();
    expect(store.appendThreadItem.mock.calls[0][2]).toMatchObject({
      attachments: [],
    });
  });
});

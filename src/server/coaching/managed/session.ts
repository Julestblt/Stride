import "server-only";
import { askAthleteTool } from "@/server/coaching/tools/ask-athlete";
import { ToolError, toolError } from "@/server/coaching/tools/errors";
import {
  parseToolInput,
  runCustomTool,
  toolAllowed,
  type AgentName,
  type ToolOutcome,
} from "@/server/coaching/tools/registry";
import type { OnboardingContext } from "@/server/onboarding/context";
import {
  consoleSessionUrl,
  managedClient,
  managedResources,
} from "./resources";
import {
  findOwnSession,
  recordSession,
  updateSession,
  type CoachSessionRecord,
  type SessionMode,
  type SessionStatus,
} from "./store";
import { turnAccessToken, turnTimeoutMs } from "./token";
import { syncAthleteVault } from "./vault";

export type { SessionMode } from "./store";

const userKey = "stride_user_id";
export const sessionBudgetCents: Record<SessionMode, number> = {
  conversation: 100,
  plan: 200,
};

export const turnMessages = {
  timeout:
    "Le coach n’a pas répondu à temps. Sa réponse a été interrompue, tu peux renvoyer ta demande.",
  budget:
    "Cette conversation a atteint sa limite de coût. Démarre une nouvelle conversation pour continuer.",
  failed: "Le coach a rencontré un problème. Réessaie dans quelques instants.",
} as const;

export type TurnInput =
  | { kind: "message"; text: string }
  | { kind: "answer"; toolUseId: string; text: string };

export type TurnRequest = {
  sessionId?: string;
  mode: SessionMode;
  input: TurnInput;
};

export type PendingQuestion = {
  toolUseId: string;
  question: string;
  askedFor: string;
};

export type TurnEvent =
  | { type: "session"; sessionId: string; consoleUrl: string }
  | { type: "coach"; text: string }
  | { type: "delegation"; from: string; to: string; text: string }
  | { type: "tool"; thread: string; name: string; ok: boolean; ms: number }
  | { type: "mcp"; thread: string; name: string }
  | { type: "question"; question: PendingQuestion }
  | {
      type: "error";
      code: "timeout" | "budget_reached" | "failed";
      text: string;
    }
  | {
      type: "done";
      status: SessionStatus;
      stopReason: string;
      garmin: "available" | "unavailable";
      listCostCents: number | null;
      timings: {
        sessionMs: number;
        firstEventMs: number | null;
        turnMs: number;
      };
    };

export class SessionAccessError extends Error {}

export class SessionStateError extends Error {
  constructor(
    readonly code:
      | "session_closed"
      | "turn_in_progress"
      | "answer_required"
      | "no_pending_question",
  ) {
    super(code);
  }
}

const agentNames: Record<string, AgentName> = {
  "Stride Coach": "coach",
  "Stride Medical": "medical",
};

function callingAgent(
  threadAgents: ReadonlyMap<string, string>,
  threadId: string | null | undefined,
): AgentName {
  if (!threadId) return "coach";
  return agentNames[threadAgents.get(threadId) ?? ""] ?? "medical";
}

const closedStatuses: SessionStatus[] = [
  "budget_reached",
  "failed",
  "terminated",
];

export function assertTurnAllowed(
  record: CoachSessionRecord,
  input: TurnInput,
  nowMs: number,
) {
  if (closedStatuses.includes(record.status))
    throw new SessionStateError("session_closed");
  if (
    record.status === "running" &&
    record.lastTurnAt !== null &&
    nowMs - Date.parse(record.lastTurnAt) < turnTimeoutMs
  )
    throw new SessionStateError("turn_in_progress");
  if (input.kind === "message" && record.status === "awaiting_athlete")
    throw new SessionStateError("answer_required");
  if (
    input.kind === "answer" &&
    (record.status !== "awaiting_athlete" ||
      record.pendingToolUseId !== input.toolUseId)
  )
    throw new SessionStateError("no_pending_question");
}

function textOf(content: readonly { type: string; text?: string }[]) {
  return content
    .flatMap((block) =>
      block.type === "text" && block.text ? [block.text] : [],
    )
    .join("\n");
}

function questionOf(
  input: unknown,
):
  | { ok: true; question: Omit<PendingQuestion, "toolUseId"> }
  | { ok: false; outcome: ToolOutcome } {
  try {
    const value = parseToolInput(askAthleteTool, input);
    return {
      ok: true,
      question: { question: value.question, askedFor: value.asked_for },
    };
  } catch (error) {
    const failure =
      error instanceof ToolError ? error : toolError("invalid_input");
    return { ok: false, outcome: { ok: false, content: failure.toBody() } };
  }
}

function costCents(amount: string | undefined) {
  if (amount === undefined) return null;
  const cents = Number(amount);
  return Number.isFinite(cents) ? Math.round(cents) : null;
}

async function openSession(
  context: OnboardingContext,
  request: TurnRequest,
  vaultId: string,
  nowMs: number,
) {
  const client = managedClient();
  if (request.sessionId) {
    const record = await findOwnSession(context, request.sessionId);
    if (!record) throw new SessionAccessError();
    const session = await client.beta.sessions.retrieve(request.sessionId);
    if (session.metadata?.[userKey] !== context.userId)
      throw new SessionAccessError();
    assertTurnAllowed(record, request.input, nowMs);
    return record;
  }
  if (request.input.kind !== "message")
    throw new SessionStateError("no_pending_question");
  const budgetCents = sessionBudgetCents[request.mode];
  const session = await client.beta.sessions.create({
    agent: managedResources.coachAgentId,
    environment_id: managedResources.environmentId,
    title: `Stride ${request.mode}`,
    vault_ids: [vaultId],
    metadata: { [userKey]: context.userId, mode: request.mode },
    budget: {
      type: "limit",
      max_list_cost: { amount: String(budgetCents), currency: "USD" },
    },
  });
  return recordSession(context, {
    managedSessionId: session.id,
    mode: request.mode,
    budgetCents,
  });
}

export async function* streamCoachTurn(
  context: OnboardingContext,
  request: TurnRequest,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent> {
  const client = managedClient();
  const started = Date.now();
  const accessToken = await turnAccessToken(context, started);
  const vaultId = await syncAthleteVault(context.userId, accessToken);
  const record = await openSession(context, request, vaultId, started);
  const id = record.managedSessionId;
  const sessionMs = Date.now() - started;
  await updateSession(context, id, {
    status: "running",
    lastTurnAt: new Date().toISOString(),
  });
  yield { type: "session", sessionId: id, consoleUrl: consoleSessionUrl(id) };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, turnTimeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let pendingQuestion: PendingQuestion | null = null;
  const threadAgents = new Map<string, string>();
  let stopReason = "interrupted";
  let firstEventMs: number | null = null;
  const turnStarted = Date.now();

  try {
    const stream = await client.beta.sessions.events.stream(
      id,
      {},
      { signal: controller.signal },
    );
    await client.beta.sessions.events.send(id, {
      events: [
        request.input.kind === "message"
          ? {
              type: "user.message",
              content: [{ type: "text", text: request.input.text }],
            }
          : {
              type: "user.custom_tool_result",
              custom_tool_use_id: request.input.toolUseId,
              content: [{ type: "text", text: request.input.text }],
            },
      ],
    });

    loop: for await (const event of stream) {
      firstEventMs ??= Date.now() - turnStarted;
      switch (event.type) {
        case "agent.message":
          yield { type: "coach", text: textOf(event.content) };
          break;
        case "agent.thread_message_sent":
          yield {
            type: "delegation",
            from: "Stride Coach",
            to: event.to_agent_name ?? "agent",
            text: textOf(event.content),
          };
          break;
        case "agent.thread_message_received":
          yield {
            type: "delegation",
            from: event.from_agent_name ?? "agent",
            to: "Stride Coach",
            text: textOf(event.content),
          };
          break;
        case "agent.mcp_tool_use":
          yield {
            type: "mcp",
            thread: event.session_thread_id ?? "primary",
            name: event.name,
          };
          break;
        case "agent.custom_tool_use": {
          const toolStarted = Date.now();
          let outcome: ToolOutcome;
          if (
            !toolAllowed(
              callingAgent(threadAgents, event.session_thread_id),
              event.name,
            )
          ) {
            outcome = {
              ok: false,
              content: toolError("unknown_tool").toBody(),
            };
          } else if (event.name === askAthleteTool.name) {
            const asked = questionOf(event.input);
            if (asked.ok) {
              pendingQuestion = { toolUseId: event.id, ...asked.question };
              break;
            }
            outcome = asked.outcome;
          } else {
            outcome = await runCustomTool(
              { ...context, coachSessionId: record.id },
              event.name,
              event.input,
            );
          }
          yield {
            type: "tool",
            thread: event.session_thread_id ?? "primary",
            name: event.name,
            ok: outcome.ok,
            ms: Date.now() - toolStarted,
          };
          await client.beta.sessions.events.send(id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                is_error: !outcome.ok,
                content: [
                  { type: "text", text: JSON.stringify(outcome.content) },
                ],
              },
            ],
          });
          break;
        }
        case "session.thread_created":
        case "session.thread_status_running":
          threadAgents.set(event.session_thread_id, event.agent_name);
          break;
        case "session.status_idle":
          stopReason = event.stop_reason.type;
          if (event.stop_reason.type !== "requires_action" || pendingQuestion)
            break loop;
          break;
        case "session.status_terminated":
          stopReason = "terminated";
          break loop;
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }

  if (controller.signal.aborted && !pendingQuestion)
    await client.beta.sessions.events
      .send(id, { events: [{ type: "user.interrupt" }] })
      .catch(() => undefined);

  let status: SessionStatus;
  if (pendingQuestion) {
    status = "awaiting_athlete";
    yield { type: "question", question: pendingQuestion };
  } else if (timedOut) {
    status = "timed_out";
    stopReason = "timeout";
    yield { type: "error", code: "timeout", text: turnMessages.timeout };
  } else if (controller.signal.aborted) {
    status = "idle";
  } else if (stopReason === "budget_reached") {
    status = "budget_reached";
    yield { type: "error", code: "budget_reached", text: turnMessages.budget };
  } else if (stopReason === "terminated") {
    status = "terminated";
    yield { type: "error", code: "failed", text: turnMessages.failed };
  } else if (stopReason === "retries_exhausted") {
    status = "failed";
    yield { type: "error", code: "failed", text: turnMessages.failed };
  } else {
    status = "idle";
  }

  const session = await client.beta.sessions.retrieve(id).catch(() => null);
  const listCostCents = costCents(session?.usage?.list_cost?.amount);
  await updateSession(context, id, {
    status,
    pendingToolUseId: pendingQuestion?.toolUseId ?? null,
    ...(listCostCents === null ? {} : { listCostCents }),
  });
  yield {
    type: "done",
    status,
    stopReason,
    garmin: accessToken ? "available" : "unavailable",
    listCostCents,
    timings: { sessionMs, firstEventMs, turnMs: Date.now() - turnStarted },
  };
}

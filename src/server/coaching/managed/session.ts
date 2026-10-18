import "server-only";
import { z } from "zod";
import { threadTitle } from "@/features/coach/conversations";
import type { AttachmentRef } from "@/features/coach/attachments";
import { clampItem, type ThreadItem } from "@/features/coach/items";
import { readLabel } from "@/features/coach/reads";
import { agentOfManagedName, type StaffAgent } from "@/features/coach/staff";
import {
  attachmentContextText,
  resolveAttachments,
  sentAttachments,
} from "@/server/coaching/attachments";
import { askAthleteTool } from "@/server/coaching/tools/ask-athlete";
import { messageAthleteTool } from "@/server/coaching/tools/message-athlete";
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
  appendThreadItem,
  findOwnSession,
  recordComposing,
  recordSession,
  updateSession,
  type CoachSessionRecord,
  type SessionMode,
  type SessionStatus,
} from "./store";
import { turnAccessToken, turnTimeoutMs } from "./token";
import { syncAthleteVault } from "./vault";
import { readGroupLine } from "../staff";

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
  | {
      kind: "message";
      text: string;
      consult?: "medical";
      attachments?: AttachmentRef[];
    }
  | { kind: "answer"; toolUseId: string; text: string };

export type TurnRequest = {
  sessionId?: string;
  mode: SessionMode;
  input: TurnInput;
};

export type PendingQuestion = {
  toolUseId: string;
  question: string;
  options: string[];
  askedFor: AgentName;
};

export type TurnEvent =
  | {
      type: "session";
      sessionId: string;
      threadId: string;
      consoleUrl: string;
    }
  | { type: "item"; item: ThreadItem }
  | { type: "coach"; text: string }
  | { type: "delegation"; from: string; to: string; text: string }
  | { type: "tool"; thread: string; name: string; ok: boolean; ms: number }
  | { type: "mcp"; thread: string; name: string }
  | { type: "composing"; since: string | null }
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
  askedFor: AgentName,
):
  | { ok: true; question: Omit<PendingQuestion, "toolUseId"> }
  | { ok: false; outcome: ToolOutcome } {
  try {
    const value = parseToolInput(askAthleteTool, input);
    return {
      ok: true,
      question: {
        question: value.question,
        options: value.options ?? [],
        askedFor,
      },
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
    title: threadTitle(request.input.text),
  });
}

function messageOf(input: unknown): {
  text: string | null;
  outcome: ToolOutcome;
} {
  try {
    const value = parseToolInput(messageAthleteTool, input);
    return {
      text: value.text,
      outcome: { ok: true, content: { shown: true } },
    };
  } catch (error) {
    const failure =
      error instanceof ToolError ? error : toolError("invalid_input");
    return { text: null, outcome: { ok: false, content: failure.toBody() } };
  }
}

const consultInstruction: Record<"medical", string> = {
  medical:
    "L’athlète a mentionné Stride Medical : passe-lui la main sur cette demande. Tu restes responsable de la décision.",
};

const proposalTools = new Set(["submit_plan", "create_plan_proposal"]);

const proposalInputSchema = z.object({
  title: z.string().catch(""),
  summary: z.string().nullable().catch(null),
  specialist_opinions: z
    .array(
      z.object({
        specialist: z.literal("medical"),
        verdict: z.string(),
        summary: z.string(),
      }),
    )
    .catch([]),
});

const submitPlanInputSchema = z.object({
  plan: z
    .object({
      title: z.string().catch(""),
      summary: z.string().nullable().catch(null),
    })
    .catch({ title: "", summary: null }),
});

const proposalIdSchema = z.object({ proposalId: z.uuid() });

function proposalItem(
  name: string,
  input: unknown,
  outcome: ToolOutcome,
): ThreadItem | null {
  if (!outcome.ok || !proposalTools.has(name)) return null;
  const id = proposalIdSchema.safeParse(outcome.content);
  if (!id.success) return null;
  const at = new Date().toISOString();
  if (name === "submit_plan") {
    const { plan } = submitPlanInputSchema.parse(input ?? {});
    return {
      kind: "proposal",
      at,
      proposalId: id.data.proposalId,
      scope: "new_plan",
      title: plan.title || "Nouveau plan",
      summary: plan.summary,
      opinions: [],
    };
  }
  const proposal = proposalInputSchema.safeParse(input ?? {});
  const value = proposal.success
    ? proposal.data
    : { title: "", summary: null, specialist_opinions: [] };
  return {
    kind: "proposal",
    at,
    proposalId: id.data.proposalId,
    scope: "session",
    title: value.title || "Changement du plan",
    summary: value.summary,
    opinions: value.specialist_opinions.map((opinion) => ({
      agent: opinion.specialist,
      verdict: opinion.verdict,
      summary: opinion.summary,
    })),
  };
}

function threadOf(event: object) {
  const thread = (event as { session_thread_id?: unknown }).session_thread_id;
  return typeof thread === "string" ? thread : null;
}

export async function* streamCoachTurn(
  context: OnboardingContext,
  request: TurnRequest,
): AsyncGenerator<TurnEvent> {
  const client = managedClient();
  const attachments =
    request.input.kind === "message" && request.input.attachments?.length
      ? await resolveAttachments(context, request.input.attachments)
      : [];
  const attachmentContext = attachments.length
    ? attachmentContextText(attachments)
    : null;
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
  yield {
    type: "session",
    sessionId: id,
    threadId: record.id,
    consoleUrl: consoleSessionUrl(id),
  };

  let persisted = Promise.resolve();
  const persist = (raw: ThreadItem) => {
    const item = clampItem(raw);
    persisted = persisted
      .then(() => appendThreadItem(context, record.id, item))
      .catch((error: unknown) => {
        console.error("Coach thread item was not recorded", {
          kind: item.kind,
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    return { type: "item", item } as const;
  };
  let recorded = Promise.resolve();
  const composing = (since: string | null) => {
    recorded = recorded
      .then(() => recordComposing(context, id, since))
      .catch((error: unknown) => {
        console.error("Coach activity was not recorded", {
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    return { type: "composing", since } as const;
  };
  const now = () => new Date().toISOString();
  yield persist(
    request.input.kind === "message"
      ? {
          kind: "athlete",
          at: now(),
          text: request.input.text,
          consult: request.input.consult ?? null,
          attachments: sentAttachments(attachments),
        }
      : {
          kind: "answer",
          at: now(),
          toolUseId: request.input.toolUseId,
          text: request.input.text,
        },
  );

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, turnTimeoutMs);

  let pendingQuestion: PendingQuestion | null = null;
  const threadAgents = new Map<string, string>();
  const endedThreads = new Set<string>();
  const speakerOf = (thread: string | null | undefined): StaffAgent =>
    (thread ? agentOfManagedName(threadAgents.get(thread)) : null) ?? "coach";
  let composingSince: string | null = null;
  let stopReason = "interrupted";
  let crashed = false;
  let firstEventMs: number | null = null;
  const turnStarted = Date.now();
  const group =
    request.input.kind === "message" ? await readGroupLine(context) : null;

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
              content: [
                { type: "text", text: request.input.text },
                ...(attachmentContext
                  ? [{ type: "text" as const, text: attachmentContext }]
                  : []),
                ...(group ? [{ type: "text" as const, text: group }] : []),
                ...(request.input.consult
                  ? [
                      {
                        type: "text" as const,
                        text: consultInstruction[request.input.consult],
                      },
                    ]
                  : []),
              ],
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
        case "agent.message": {
          const text = textOf(event.content);
          const thread = threadOf(event);
          const speaker = speakerOf(thread);
          if (speaker === "coach") {
            yield { type: "coach", text };
            if (text.trim()) yield persist({ kind: "coach", at: now(), text });
          } else if (thread && text.trim())
            yield persist({
              kind: "consult_note",
              at: now(),
              thread,
              agent: speaker,
              text,
            });
          break;
        }
        case "agent.thread_message_sent": {
          const text = textOf(event.content);
          yield {
            type: "delegation",
            from: "Stride Coach",
            to: event.to_agent_name ?? "agent",
            text,
          };
          const agent = agentOfManagedName(event.to_agent_name);
          if (agent && agent !== "coach") {
            threadAgents.set(event.to_session_thread_id, event.to_agent_name!);
            endedThreads.delete(event.to_session_thread_id);
            yield persist({
              kind: "consult_request",
              at: now(),
              thread: event.to_session_thread_id,
              agent,
              text,
            });
          }
          break;
        }
        case "agent.thread_message_received": {
          const text = textOf(event.content);
          yield {
            type: "delegation",
            from: event.from_agent_name ?? "agent",
            to: "Stride Coach",
            text,
          };
          const agent = agentOfManagedName(event.from_agent_name);
          if (agent && agent !== "coach")
            yield persist({
              kind: "consult_reply",
              at: now(),
              thread: event.from_session_thread_id,
              agent,
              text,
            });
          break;
        }
        case "agent.mcp_tool_use": {
          const thread = event.session_thread_id ?? "primary";
          yield { type: "mcp", thread, name: event.name };
          const label = readLabel("garmin", event.name, event.input);
          if (label)
            yield persist({
              kind: "read",
              at: now(),
              thread,
              agent: speakerOf(event.session_thread_id),
              tool: event.name,
              label,
            });
          break;
        }
        case "agent.custom_tool_use": {
          const toolStarted = Date.now();
          let outcome: ToolOutcome;
          const caller = callingAgent(threadAgents, event.session_thread_id);
          if (!toolAllowed(caller, event.name)) {
            outcome = {
              ok: false,
              content: toolError("unknown_tool").toBody(),
            };
          } else if (event.name === askAthleteTool.name) {
            const asked = questionOf(event.input, caller);
            if (asked.ok) {
              pendingQuestion = { toolUseId: event.id, ...asked.question };
              break;
            }
            outcome = asked.outcome;
          } else if (event.name === messageAthleteTool.name) {
            const message = messageOf(event.input);
            outcome = message.outcome;
            if (message.text)
              yield persist({
                kind: "staff_message",
                at: now(),
                thread: event.session_thread_id ?? "primary",
                agent: caller,
                text: message.text,
              });
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
          const label = outcome.ok
            ? readLabel("custom", event.name, event.input)
            : null;
          if (label)
            yield persist({
              kind: "read",
              at: now(),
              thread: event.session_thread_id ?? "primary",
              agent: speakerOf(event.session_thread_id),
              tool: event.name,
              label,
            });
          const proposal = proposalItem(event.name, event.input, outcome);
          if (proposal) yield persist(proposal);
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
        case "span.model_request_start":
          if (speakerOf(threadOf(event)) === "coach") {
            composingSince = now();
            yield composing(composingSince);
          }
          break;
        case "span.model_request_end":
          if (
            composingSince !== null &&
            speakerOf(threadOf(event)) === "coach"
          ) {
            composingSince = null;
            yield composing(null);
          }
          break;
        case "session.thread_created":
        case "session.thread_status_running":
          threadAgents.set(event.session_thread_id, event.agent_name);
          break;
        case "session.thread_status_idle":
        case "session.thread_status_terminated": {
          const agent = agentOfManagedName(event.agent_name);
          const finished =
            event.type === "session.thread_status_terminated" ||
            event.stop_reason.type !== "requires_action";
          if (
            agent &&
            agent !== "coach" &&
            finished &&
            !endedThreads.has(event.session_thread_id)
          ) {
            endedThreads.add(event.session_thread_id);
            yield persist({
              kind: "consult_end",
              at: now(),
              thread: event.session_thread_id,
              agent,
            });
          }
          break;
        }
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
    if (!controller.signal.aborted) {
      crashed = true;
      console.error("Coach turn failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  } finally {
    clearTimeout(timeout);
  }

  if (timedOut && !pendingQuestion)
    await client.beta.sessions.events
      .send(id, { events: [{ type: "user.interrupt" }] })
      .catch(() => undefined);

  let status: SessionStatus;
  let failure: Extract<TurnEvent, { type: "error" }> | null = null;
  if (pendingQuestion) {
    status = "awaiting_athlete";
    yield { type: "question", question: pendingQuestion };
    yield persist({
      kind: "question",
      at: now(),
      toolUseId: pendingQuestion.toolUseId,
      question: pendingQuestion.question,
      options: pendingQuestion.options,
      askedFor: pendingQuestion.askedFor,
    });
  } else if (crashed) {
    status = "failed";
    stopReason = "failed";
    failure = { type: "error", code: "failed", text: turnMessages.failed };
  } else if (timedOut) {
    status = "timed_out";
    stopReason = "timeout";
    failure = { type: "error", code: "timeout", text: turnMessages.timeout };
  } else if (stopReason === "budget_reached") {
    status = "budget_reached";
    failure = {
      type: "error",
      code: "budget_reached",
      text: turnMessages.budget,
    };
  } else if (stopReason === "terminated") {
    status = "terminated";
    failure = { type: "error", code: "failed", text: turnMessages.failed };
  } else if (stopReason === "retries_exhausted") {
    status = "failed";
    failure = { type: "error", code: "failed", text: turnMessages.failed };
  } else {
    status = "idle";
  }
  if (failure) {
    yield failure;
    yield persist({
      kind: "error",
      at: now(),
      code: failure.code,
      text: failure.text,
    });
  }
  await persisted;
  await recorded;

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

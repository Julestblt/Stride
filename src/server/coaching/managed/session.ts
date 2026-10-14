import "server-only";
import type { OnboardingContext } from "@/server/onboarding/context";
import {
  consoleSessionUrl,
  managedClient,
  managedResources,
} from "./resources";
import { runCustomTool } from "./tools";
import { syncAthleteVault } from "./vault";

const userKey = "stride_user_id";
const sessionBudgetCents = { conversation: "100", plan: "200" } as const;

export type SessionMode = keyof typeof sessionBudgetCents;
const turnTimeoutMs = 900_000;

export type TurnInput =
  | { kind: "message"; text: string }
  | { kind: "answer"; toolUseId: string; text: string };

export type TranscriptItem =
  | { type: "coach"; text: string }
  | { type: "delegation"; from: string; to: string; text: string }
  | { type: "tool"; thread: string; name: string; ok: boolean; ms: number }
  | { type: "mcp"; thread: string; name: string }
  | { type: "error"; text: string };

export type PendingQuestion = {
  toolUseId: string;
  question: string;
  askedFor: string;
};

export type TurnResult = {
  sessionId: string;
  consoleUrl: string;
  transcript: TranscriptItem[];
  pendingQuestion: PendingQuestion | null;
  stopReason: string;
  listCostCents: number | null;
  timings: { sessionMs: number; firstEventMs: number | null; turnMs: number };
};

export class SessionAccessError extends Error {}

function textOf(content: readonly { type: string; text?: string }[]) {
  return content
    .flatMap((block) =>
      block.type === "text" && block.text ? [block.text] : [],
    )
    .join("\n");
}

function questionOf(input: unknown): Omit<PendingQuestion, "toolUseId"> {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    question: typeof value.question === "string" ? value.question : "",
    askedFor: typeof value.asked_for === "string" ? value.asked_for : "coach",
  };
}

async function openSession(
  context: OnboardingContext,
  sessionId: string | undefined,
  mode: SessionMode,
) {
  const client = managedClient();
  const vaultId = await syncAthleteVault(context.userId, context.accessToken);
  if (sessionId) {
    const session = await client.beta.sessions.retrieve(sessionId);
    if (session.metadata?.[userKey] !== context.userId)
      throw new SessionAccessError();
    return session.id;
  }
  const session = await client.beta.sessions.create({
    agent: managedResources.coachAgentId,
    environment_id: managedResources.environmentId,
    title: "Stride coach spike",
    vault_ids: [vaultId],
    metadata: { [userKey]: context.userId, mode },
    budget: {
      type: "limit",
      max_list_cost: { amount: sessionBudgetCents[mode], currency: "USD" },
    },
  });
  return session.id;
}

export async function runCoachTurn(
  context: OnboardingContext,
  sessionId: string | undefined,
  input: TurnInput,
  mode: SessionMode,
): Promise<TurnResult> {
  const client = managedClient();
  const started = Date.now();
  const id = await openSession(context, sessionId, mode);
  const sessionMs = Date.now() - started;

  const transcript: TranscriptItem[] = [];
  let pendingQuestion: PendingQuestion | null = null;
  let stopReason = "timeout";
  let firstEventMs: number | null = null;

  const stream = await client.beta.sessions.events.stream(id);
  const turnStarted = Date.now();
  await client.beta.sessions.events.send(id, {
    events: [
      input.kind === "message"
        ? {
            type: "user.message",
            content: [{ type: "text", text: input.text }],
          }
        : {
            type: "user.custom_tool_result",
            custom_tool_use_id: input.toolUseId,
            content: [{ type: "text", text: input.text }],
          },
    ],
  });

  const timeout = setTimeout(() => stream.controller.abort(), turnTimeoutMs);
  try {
    loop: for await (const event of stream) {
      firstEventMs ??= Date.now() - turnStarted;
      switch (event.type) {
        case "agent.message":
          transcript.push({ type: "coach", text: textOf(event.content) });
          break;
        case "agent.thread_message_sent":
          transcript.push({
            type: "delegation",
            from: "Stride Coach",
            to: event.to_agent_name ?? "agent",
            text: textOf(event.content),
          });
          break;
        case "agent.thread_message_received":
          transcript.push({
            type: "delegation",
            from: event.from_agent_name ?? "agent",
            to: "Stride Coach",
            text: textOf(event.content),
          });
          break;
        case "agent.mcp_tool_use":
          transcript.push({
            type: "mcp",
            thread: event.session_thread_id ?? "primary",
            name: event.name,
          });
          break;
        case "agent.custom_tool_use": {
          if (event.name === "ask_athlete") {
            pendingQuestion = {
              toolUseId: event.id,
              ...questionOf(event.input),
            };
            break;
          }
          const toolStarted = Date.now();
          const outcome = await runCustomTool(context, event.name, event.input);
          transcript.push({
            type: "tool",
            thread: event.session_thread_id ?? "primary",
            name: event.name,
            ok: outcome.ok,
            ms: Date.now() - toolStarted,
          });
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
        case "session.error":
          transcript.push({ type: "error", text: JSON.stringify(event.error) });
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
  } finally {
    clearTimeout(timeout);
  }

  const session = await client.beta.sessions.retrieve(id);
  const cost = session.usage?.list_cost?.amount;
  return {
    sessionId: id,
    consoleUrl: consoleSessionUrl(id),
    transcript,
    pendingQuestion,
    stopReason,
    listCostCents: cost === undefined ? null : Number(cost),
    timings: { sessionMs, firstEventMs, turnMs: Date.now() - turnStarted },
  };
}

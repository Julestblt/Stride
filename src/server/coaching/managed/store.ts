import "server-only";
import { z } from "zod";
import {
  itemBody,
  parseThreadItem,
  type ThreadItem,
} from "@/features/coach/items";
import type { OnboardingContext } from "@/server/onboarding/context";

export const sessionModes = ["conversation", "plan"] as const;
export const sessionStatuses = [
  "running",
  "idle",
  "awaiting_athlete",
  "budget_reached",
  "timed_out",
  "failed",
  "terminated",
] as const;

export type SessionMode = (typeof sessionModes)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

const rowSchema = z
  .object({
    id: z.uuid(),
    managed_session_id: z.string(),
    mode: z.enum(sessionModes),
    status: z.enum(sessionStatuses),
    pending_tool_use_id: z.string().nullable(),
    budget_cents: z.number().int(),
    list_cost_cents: z.number().int(),
    last_turn_at: z.string().nullable(),
    title: z.string().nullable(),
    last_activity_at: z.string(),
    read_at: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    managedSessionId: row.managed_session_id,
    mode: row.mode,
    status: row.status,
    pendingToolUseId: row.pending_tool_use_id,
    budgetCents: row.budget_cents,
    listCostCents: row.list_cost_cents,
    lastTurnAt: row.last_turn_at,
    title: row.title,
    lastActivityAt: row.last_activity_at,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));

export type CoachSessionRecord = z.output<typeof rowSchema>;

const columns =
  "id, managed_session_id, mode, status, pending_tool_use_id, budget_cents, list_cost_cents, last_turn_at, title, last_activity_at, read_at, created_at";

export async function findOwnSession(
  context: OnboardingContext,
  managedSessionId: string,
): Promise<CoachSessionRecord | null> {
  const { data, error } = await context.client
    .from("coach_sessions")
    .select(columns)
    .eq("user_id", context.userId)
    .eq("managed_session_id", managedSessionId)
    .maybeSingle();
  if (error) throw new Error("Unable to read the coach session");
  return data ? rowSchema.parse(data) : null;
}

export async function recordSession(
  context: OnboardingContext,
  session: {
    managedSessionId: string;
    mode: SessionMode;
    budgetCents: number;
    title: string;
  },
): Promise<CoachSessionRecord> {
  const { data, error } = await context.client
    .from("coach_sessions")
    .insert({
      user_id: context.userId,
      managed_session_id: session.managedSessionId,
      mode: session.mode,
      status: "running",
      budget_cents: session.budgetCents,
      title: session.title,
    })
    .select(columns)
    .single();
  if (error) throw new Error("Unable to record the coach session");
  return rowSchema.parse(data);
}

export async function updateSession(
  context: OnboardingContext,
  managedSessionId: string,
  patch: {
    status: SessionStatus;
    pendingToolUseId?: string | null;
    listCostCents?: number;
    lastTurnAt?: string;
    readAt?: string;
  },
) {
  const { error } = await context.client
    .from("coach_sessions")
    .update({
      status: patch.status,
      pending_tool_use_id: patch.pendingToolUseId ?? null,
      last_activity_at: new Date().toISOString(),
      ...(patch.listCostCents === undefined
        ? {}
        : { list_cost_cents: patch.listCostCents }),
      ...(patch.lastTurnAt === undefined
        ? {}
        : { last_turn_at: patch.lastTurnAt }),
      ...(patch.readAt === undefined ? {} : { read_at: patch.readAt }),
    })
    .eq("user_id", context.userId)
    .eq("managed_session_id", managedSessionId);
  if (error) throw new Error("Unable to update the coach session");
}

export async function findOwnThread(
  context: OnboardingContext,
  threadId: string,
): Promise<CoachSessionRecord | null> {
  if (!z.uuid().safeParse(threadId).success) return null;
  const { data, error } = await context.client
    .from("coach_sessions")
    .select(columns)
    .eq("user_id", context.userId)
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw new Error("Unable to read the coach thread");
  return data ? rowSchema.parse(data) : null;
}

export async function listOwnThreads(
  context: OnboardingContext,
  limit = 40,
): Promise<CoachSessionRecord[]> {
  const { data, error } = await context.client
    .from("coach_sessions")
    .select(columns)
    .eq("user_id", context.userId)
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to list the coach threads");
  return z.array(rowSchema).parse(data ?? []);
}

export async function appendThreadItem(
  context: OnboardingContext,
  coachSessionId: string,
  item: ThreadItem,
) {
  const { error } = await context.client.from("coach_thread_items").insert({
    user_id: context.userId,
    coach_session_id: coachSessionId,
    kind: item.kind,
    body: itemBody(item) as never,
  });
  if (error) throw new Error("Unable to record the coach thread item");
}

const itemRowSchema = z.object({
  coach_session_id: z.uuid(),
  kind: z.string(),
  body: z.unknown(),
  created_at: z.string(),
});

function parseItemRows(data: unknown) {
  return z
    .array(itemRowSchema)
    .parse(data ?? [])
    .flatMap((row) => {
      const item = parseThreadItem(row);
      return item ? [{ threadId: row.coach_session_id, item }] : [];
    });
}

export async function readThreadItems(
  context: OnboardingContext,
  coachSessionId: string,
  limit = 500,
): Promise<ThreadItem[]> {
  const { data, error } = await context.client
    .from("coach_thread_items")
    .select("coach_session_id, kind, body, created_at")
    .eq("user_id", context.userId)
    .eq("coach_session_id", coachSessionId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to read the coach thread items");
  return parseItemRows(data)
    .map((row) => row.item)
    .reverse();
}

export async function readConsultRequests(
  context: OnboardingContext,
  coachSessionIds: readonly string[],
): Promise<Map<string, ThreadItem[]>> {
  const items = new Map<string, ThreadItem[]>(
    coachSessionIds.map((id) => [id, []]),
  );
  if (!coachSessionIds.length) return items;
  const { data, error } = await context.client
    .from("coach_thread_items")
    .select("coach_session_id, kind, body, created_at")
    .eq("user_id", context.userId)
    .eq("kind", "consult_request")
    .in("coach_session_id", [...coachSessionIds])
    .order("id", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Unable to read the coach consults");
  for (const row of parseItemRows(data))
    items.get(row.threadId)?.push(row.item);
  return items;
}

export async function markThreadRead(
  context: OnboardingContext,
  threadId: string,
) {
  if (!z.uuid().safeParse(threadId).success) return;
  const { error } = await context.client
    .from("coach_sessions")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", context.userId)
    .eq("id", threadId);
  if (error) throw new Error("Unable to mark the coach thread as read");
}

const proposalStatusSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  coach_session_id: z.uuid(),
});

export async function readThreadProposalStatuses(
  context: OnboardingContext,
  coachSessionIds: readonly string[],
) {
  const statuses = new Map<string, Record<string, string>>(
    coachSessionIds.map((id) => [id, {}]),
  );
  if (!coachSessionIds.length) return statuses;
  const { data, error } = await context.client
    .from("plan_proposals")
    .select("id, status, coach_session_id")
    .eq("user_id", context.userId)
    .in("coach_session_id", [...coachSessionIds]);
  if (error) throw new Error("Unable to read the thread proposals");
  for (const row of z.array(proposalStatusSchema).parse(data ?? [])) {
    const record = statuses.get(row.coach_session_id);
    if (record) record[row.id] = row.status;
  }
  return statuses;
}

export async function countCoachAttention(context: OnboardingContext) {
  const sessions = await context.client
    .from("coach_sessions")
    .select("id, status")
    .eq("user_id", context.userId)
    .not("title", "is", null);
  if (sessions.error) return null;
  const rows = z
    .array(z.object({ id: z.uuid(), status: z.string() }))
    .parse(sessions.data ?? []);
  if (!rows.length) return { questions: 0, proposals: 0 };
  const proposals = await context.client
    .from("plan_proposals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .eq("status", "ready")
    .in(
      "coach_session_id",
      rows.map((row) => row.id),
    );
  if (proposals.error) return null;
  return {
    questions: rows.filter((row) => row.status === "awaiting_athlete").length,
    proposals: proposals.count ?? 0,
  };
}

export async function deleteOwnThread(
  context: OnboardingContext,
  threadId: string,
) {
  const { data, error } = await context.client
    .from("coach_sessions")
    .delete()
    .eq("user_id", context.userId)
    .eq("id", threadId)
    .select("id");
  if (error) throw new Error("Unable to delete the coach thread");
  return (data ?? []).length > 0;
}

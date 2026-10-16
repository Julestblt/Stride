import "server-only";
import { z } from "zod";
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
  }));

export type CoachSessionRecord = z.output<typeof rowSchema>;

const columns =
  "id, managed_session_id, mode, status, pending_tool_use_id, budget_cents, list_cost_cents, last_turn_at";

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
  session: { managedSessionId: string; mode: SessionMode; budgetCents: number },
): Promise<CoachSessionRecord> {
  const { data, error } = await context.client
    .from("coach_sessions")
    .insert({
      user_id: context.userId,
      managed_session_id: session.managedSessionId,
      mode: session.mode,
      status: "running",
      budget_cents: session.budgetCents,
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
  },
) {
  const { error } = await context.client
    .from("coach_sessions")
    .update({
      status: patch.status,
      pending_tool_use_id: patch.pendingToolUseId ?? null,
      ...(patch.listCostCents === undefined
        ? {}
        : { list_cost_cents: patch.listCostCents }),
      ...(patch.lastTurnAt === undefined
        ? {}
        : { last_turn_at: patch.lastTurnAt }),
    })
    .eq("user_id", context.userId)
    .eq("managed_session_id", managedSessionId);
  if (error) throw new Error("Unable to update the coach session");
}

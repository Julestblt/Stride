import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { addDays } from "@/features/plans/model/dates";
import { applyOperations } from "@/features/plans/operations/apply";
import { planOperationSchema } from "@/features/plans/operations/operations";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readPlanningConstraints } from "@/server/plans/constraints";
import { readSessionMatches } from "@/server/plans/matches";
import { readActivePlan } from "@/server/plans/stored";

export type ToolOutcome = { ok: boolean; content: unknown };

const isoDate = z.iso.date();

const readPlanInput = z.strictObject({ from: isoDate, to: isoDate });
const healthInput = z.strictObject({ days: z.number().int().min(1).max(42) });

const coachOperationSchema = planOperationSchema.refine((operation) =>
  ["skip_session", "move_session", "swap_sessions", "replace_session"].includes(
    operation.op,
  ),
);

const proposalInput = z.strictObject({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(2000),
  origin: z.enum(["training", "recovery", "performance", "schedule", "race"]),
  operations: z.array(coachOperationSchema).min(1).max(20),
  specialist_opinions: z
    .array(
      z.strictObject({
        specialist: z.literal("medical"),
        verdict: z.string().min(1).max(64),
        summary: z.string().min(1).max(1000),
      }),
    )
    .max(4),
});

function invalid(error: z.ZodError): ToolOutcome {
  return {
    ok: false,
    content: { error: "invalid_input", issues: z.flattenError(error) },
  };
}

async function readPlanRange(context: OnboardingContext, input: unknown) {
  const parsed = readPlanInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { from, to } = parsed.data;
  if (from > to || addDays(from, 42) < to)
    return { ok: false, content: { error: "range_too_large" } };
  const stored = await readActivePlan(context);
  if (!stored) return { ok: true, content: { plan: null } };
  const { plan, weeks, sessions } = stored.state;
  return {
    ok: true,
    content: {
      today: localToday(plan.timeZone),
      plan: {
        title: plan.title,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        timeZone: plan.timeZone,
        version: stored.activeVersion,
      },
      weeks: weeks.filter(
        (week) => week.weekStart <= to && addDays(week.weekStart, 6) >= from,
      ),
      sessions: sessions.filter(
        (session) => session.scheduledOn >= from && session.scheduledOn <= to,
      ),
    },
  };
}

async function readHealthReports(context: OnboardingContext, input: unknown) {
  const parsed = healthInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { timeZone } = await readPlanningConstraints(context);
  const today = localToday(timeZone);
  const { data, error } = await context.client
    .from("athlete_wellness_checkins")
    .select("checkin_date, legs, soreness, stress")
    .eq("user_id", context.userId)
    .gte("checkin_date", addDays(today, -parsed.data.days))
    .order("checkin_date", { ascending: false });
  if (error) throw new Error("Unable to read the wellness check-ins");
  return { ok: true, content: { today, checkins: data } };
}

function targetKeys(operations: z.infer<typeof proposalInput>["operations"]) {
  return operations.flatMap((operation) => {
    if (operation.op === "swap_sessions")
      return [operation.firstKey, operation.secondKey];
    if ("sessionKey" in operation) return [operation.sessionKey];
    return [];
  });
}

async function createPlanProposal(context: OnboardingContext, input: unknown) {
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const proposal = parsed.data;
  const stored = await readActivePlan(context);
  if (!stored) return { ok: false, content: { error: "no_active_plan" } };
  const matches = await readSessionMatches(context, stored.planId);
  const result = applyOperations(stored.state, proposal.operations, {
    today: localToday(stored.state.plan.timeZone),
    matchedSessionKeys: new Set(
      matches
        .filter((match) => match.status !== "dismissed")
        .map((match) => match.sessionKey),
    ),
  });
  if (!result.ok)
    return {
      ok: false,
      content: { error: "validation_failed", errors: result.errors },
    };
  const { data, error } = await context.client.rpc("submit_plan_proposal", {
    p_scope: "session",
    p_origin: proposal.origin,
    p_title: proposal.title,
    p_summary: proposal.summary,
    p_rationale: proposal.rationale,
    p_operations: proposal.operations,
    p_preview: result.changeset,
    p_plan_id: stored.planId,
    p_base_version: stored.activeVersion,
    p_specialist_opinions: proposal.specialist_opinions,
    p_target_keys: targetKeys(proposal.operations),
  });
  if (error) return { ok: false, content: { error: error.message } };
  return {
    ok: true,
    content: {
      proposalId: data.id,
      status: data.status,
      note: "The athlete must approve this proposal in the app.",
    },
  };
}

const handlers: Record<
  string,
  (context: OnboardingContext, input: unknown) => Promise<ToolOutcome>
> = {
  read_active_plan: readPlanRange,
  read_health_reports: readHealthReports,
  create_plan_proposal: createPlanProposal,
};

export async function runCustomTool(
  context: OnboardingContext,
  name: string,
  input: unknown,
): Promise<ToolOutcome> {
  const handler = handlers[name];
  if (!handler) return { ok: false, content: { error: "unknown_tool", name } };
  try {
    return await handler(context, input);
  } catch {
    return { ok: false, content: { error: "tool_unavailable" } };
  }
}

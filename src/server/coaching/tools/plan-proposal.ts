import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { applyOperations } from "@/features/plans/operations/apply";
import {
  planOperationSchema,
  type PlanOperation,
} from "@/features/plans/operations/operations";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readSessionMatches } from "@/server/plans/matches";
import type { Database } from "@/server/supabase/database.types";
import { requireActivePlan } from "./active-plan";
import { defineTool } from "./define";
import { toolError } from "./errors";

type SubmitArgs =
  Database["public"]["Functions"]["submit_plan_proposal"]["Args"];

export async function submitProposal(
  context: OnboardingContext,
  args: SubmitArgs,
) {
  const { data, error } = await context.client.rpc(
    "submit_plan_proposal",
    args,
  );
  if (error?.message === "not_found") throw toolError("not_found");
  if (error?.message === "stale_version")
    throw toolError("validation_failed", { reason: "stale_version" });
  if (error || !data) throw new Error("Unable to submit the plan proposal");
  return data;
}

const sessionKey = z.string().min(1).max(64);

const coachOperationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("skip_session"), sessionKey }),
  z.strictObject({
    op: z.literal("move_session"),
    sessionKey,
    toDate: z.iso.date(),
  }),
  z.strictObject({
    op: z.literal("swap_sessions"),
    firstKey: sessionKey,
    secondKey: sessionKey,
  }),
  z.strictObject({
    op: z.literal("replace_session"),
    sessionKey,
    content: z
      .looseObject({})
      .describe(
        "The new session content, in the same shape as a session's content returned by read_active_plan (without sessionKey and scheduledOn).",
      ),
  }),
]);

const opinionSchema = z.strictObject({
  specialist: z.literal("medical"),
  verdict: z.string().min(1).max(64),
  summary: z.string().min(1).max(1000),
});

function targetKeys(operations: PlanOperation[]) {
  return operations.flatMap((operation) => {
    if (operation.op === "swap_sessions")
      return [operation.firstKey, operation.secondKey];
    if ("sessionKey" in operation) return [operation.sessionKey];
    return [];
  });
}

export const createPlanProposalTool = defineTool({
  name: "create_plan_proposal",
  description:
    "Submit a change to the active plan as a proposal. Nothing changes until the athlete approves it in the app. The server validates the operations against the plan and returns the proposal id or the validation errors.",
  class: "propose",
  dataClasses: ["plan"],
  input: z.strictObject({
    title: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe("Short French title shown to the athlete."),
    summary: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("French summary of the change."),
    rationale: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe(
        "French explanation of why, citing the data and specialist opinions.",
      ),
    origin: z.enum(["training", "recovery", "performance", "schedule", "race"]),
    operations: z
      .array(coachOperationSchema)
      .min(1)
      .max(20)
      .describe(
        "Plan operations on session keys returned by read_active_plan: skip, move, swap or replace one session.",
      ),
    specialist_opinions: z
      .array(opinionSchema)
      .max(4)
      .describe("Specialist opinions this proposal relies on."),
  }),
  output: z.strictObject({
    proposalId: z.uuid(),
    status: z.string(),
    note: z.string(),
  }),
  run: async (context, proposal) => {
    const operations = z
      .array(planOperationSchema)
      .safeParse(proposal.operations);
    if (!operations.success)
      throw toolError(
        "invalid_input",
        operations.error.issues.slice(0, 20).map((issue) => ({
          path: ["operations", ...issue.path].join("."),
          message: issue.message,
        })),
      );
    const stored = await requireActivePlan(context);
    const matches = await readSessionMatches(context, stored.planId);
    const result = applyOperations(stored.state, operations.data, {
      today: localToday(stored.state.plan.timeZone),
      matchedSessionKeys: new Set(
        matches
          .filter((match) => match.status !== "dismissed")
          .map((match) => match.sessionKey),
      ),
    });
    if (!result.ok) {
      const unknown = result.errors.filter(
        (error) => error.code === "unknown_key",
      );
      if (unknown.length)
        throw toolError("not_found", {
          keys: unknown.flatMap((error) => (error.key ? [error.key] : [])),
        });
      throw toolError("validation_failed", { errors: result.errors });
    }
    const data = await submitProposal(context, {
      p_scope: "session",
      p_origin: proposal.origin,
      p_title: proposal.title,
      p_summary: proposal.summary,
      p_rationale: proposal.rationale,
      p_operations: operations.data,
      p_preview: result.changeset,
      p_plan_id: stored.planId,
      p_base_version: stored.activeVersion,
      p_specialist_opinions: proposal.specialist_opinions,
      p_target_keys: targetKeys(operations.data),
    });
    return {
      proposalId: data.id,
      status: data.status,
      note: "The athlete must approve this proposal in the app.",
    };
  },
});

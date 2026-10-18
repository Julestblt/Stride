import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { raceRoles } from "@/features/plans/model/plan";
import { applyOperations } from "@/features/plans/operations/apply";
import {
  planOperationSchema,
  type PlanOperation,
} from "@/features/plans/operations/operations";
import { loadPlanningInput } from "@/server/plans/draft";
import { readSessionMatches } from "@/server/plans/matches";
import type { Database } from "@/server/supabase/database.types";
import { requireActivePlan } from "./active-plan";
import { defineTool, type ToolContext } from "./define";
import { toolError } from "./errors";

type SubmitArgs =
  Database["public"]["Functions"]["submit_plan_proposal"]["Args"];

export async function submitProposal(
  context: ToolContext,
  args: Omit<SubmitArgs, "p_coach_session_id">,
) {
  const { data, error } = await context.client.rpc("submit_plan_proposal", {
    ...args,
    ...(context.coachSessionId
      ? { p_coach_session_id: context.coachSessionId }
      : {}),
  });
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
  z.strictObject({
    op: z.literal("set_race_role"),
    raceId: z
      .string()
      .min(1)
      .max(64)
      .describe("Id of a race inside the plan's dates."),
    role: z
      .enum(raceRoles)
      .nullable()
      .describe("Role of the race in the plan, or null to remove it."),
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
    if (operation.op === "set_race_role") return [`race:${operation.raceId}`];
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
        "Plan operations: skip, move, swap or replace one session by a key returned by read_active_plan, or set the role of a race inside the plan's dates.",
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
    const roles = operations.data.filter(
      (operation) => operation.op === "set_race_role",
    );
    if (roles.length) {
      const { input: planning } = await loadPlanningInput(context);
      const { startsOn, endsOn } = stored.state.plan;
      const outside = roles.filter(({ raceId }) => {
        const race = planning.races.find((item) => item.id === raceId);
        return !race || race.date < startsOn || race.date > endsOn;
      });
      if (outside.length)
        throw toolError("validation_failed", {
          reason: "race_outside_plan",
          raceIds: outside.map((operation) => operation.raceId),
        });
    }
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

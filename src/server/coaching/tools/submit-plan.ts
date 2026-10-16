import "server-only";
import { z } from "zod";
import {
  compactPlanSchema,
  compactToPlanState,
} from "@/features/plans/compact/compact";
import { validateNewPlan } from "@/features/plans/detailing/build";
import { planStateSchema } from "@/features/plans/model/plan";
import { applyOperations } from "@/features/plans/operations/apply";
import type { RuleResult } from "@/features/plans/validation/report";
import { loadPlanningInput } from "@/server/plans/draft";
import { defineTool } from "./define";
import { toolError } from "./errors";
import { submitProposal } from "./plan-proposal";

function issuesOf(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function describeRule(result: RuleResult) {
  return {
    rule: result.ruleId,
    strong: result.strong,
    issues: result.issues,
    keys: result.keys.slice(0, 8),
    ...(result.observed === null ? {} : { observed: result.observed }),
    ...(result.threshold === null ? {} : { threshold: result.threshold }),
  };
}

const ruleSchema = z.strictObject({
  rule: z.string(),
  strong: z.boolean(),
  issues: z.array(z.string()),
  keys: z.array(z.string()),
  observed: z.number().optional(),
  threshold: z.number().optional(),
});

export const submitPlanTool = defineTool({
  name: "submit_plan",
  description:
    "Submit a complete new training plan, written in the plan-format skill's JSON format. Stride converts it, runs its validator, and stores it as a proposal that replaces the active plan only after the athlete approves it. Returns the proposal id, or the format and validation errors to fix.",
  class: "propose",
  dataClasses: ["plan"],
  input: z.strictObject({
    plan: z
      .looseObject({})
      .describe("The complete plan in the plan-format skill's format."),
  }),
  output: z.strictObject({
    proposalId: z.uuid(),
    weeks: z.int().nonnegative(),
    sessions: z.int().nonnegative(),
    warnings: z.array(ruleSchema),
    note: z.string(),
  }),
  run: async (context, input) => {
    const parsed = compactPlanSchema.safeParse(input.plan);
    if (!parsed.success)
      throw toolError("invalid_plan", issuesOf(parsed.error));
    const compact = parsed.data;
    const { today, input: planning } = await loadPlanningInput(context);
    const shape = planStateSchema.safeParse(
      compactToPlanState(compact, planning.constraints.timeZone),
    );
    if (!shape.success) throw toolError("invalid_plan", issuesOf(shape.error));
    const report = validateNewPlan(planning, shape.data);
    const failed = report.results.filter((result) => result.outcome === "fail");
    const warnings = failed
      .filter((result) => result.severity === "warn")
      .map(describeRule);
    const blocking = failed.filter((result) => result.severity === "block");
    if (blocking.length)
      throw toolError("validation_failed", {
        blocking: blocking.map(describeRule),
        warnings,
      });
    const operations = [{ op: "create_plan" as const, state: shape.data }];
    const result = applyOperations(null, operations, {
      today,
      matchedSessionKeys: new Set(),
    });
    if (!result.ok)
      throw toolError("validation_failed", { errors: result.errors });
    const data = await submitProposal(context, {
      p_scope: "new_plan",
      p_origin: "training",
      p_title: compact.title,
      p_summary: compact.summary.slice(0, 500),
      p_rationale: compact.summary,
      p_operations: operations,
      p_preview: result.changeset,
      p_target_keys: ["plan"],
    });
    return {
      proposalId: data.id,
      weeks: shape.data.weeks.length,
      sessions: shape.data.sessions.length,
      warnings,
      note: "The athlete must approve this plan in the app before it is saved.",
    };
  },
});

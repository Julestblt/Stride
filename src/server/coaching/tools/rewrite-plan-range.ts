import "server-only";
import { z } from "zod";
import {
  compactWeeksSchema,
  compactWeeksToRows,
} from "@/features/plans/compact/compact";
import { planOperationSchema } from "@/features/plans/operations/operations";
import { loadPlanningInput } from "@/server/plans/draft";
import { requireActivePlan } from "./active-plan";
import { defineTool } from "./define";
import { toolError } from "./errors";
import { checkPlanOperation, opinionSchema } from "./extend-plan";
import { submitProposal } from "./plan-proposal";
import { issuesOf, ruleSchema } from "./submit-plan";

export const rewritePlanRangeTool = defineTool({
  name: "rewrite_plan_range",
  description:
    "Propose rewriting a whole date range of the active plan, for example every week between a preparation race and the main race, while the weeks before and after stay exactly as they are. Give the first Monday to rewrite (not in the past), the last day (a Sunday or the plan's end), and every week of the range written in the plan-format skill's week format, one per Monday. The phases, week totals and sessions of the range are replaced together. Stride runs its validator and stores a proposal that the athlete approves in the app. Returns the proposal id, or the format and validation errors to fix.",
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
      .describe("French summary of the rewrite."),
    rationale: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe("French explanation of why, citing the data."),
    origin: z.enum(["training", "recovery", "performance", "schedule", "race"]),
    from: z.iso
      .date()
      .describe(
        "First day to rewrite (YYYY-MM-DD): a Monday that is not in the past, after any session already done.",
      ),
    to: z.iso
      .date()
      .describe(
        "Last day to rewrite (YYYY-MM-DD): a Sunday, or the plan's last day.",
      ),
    raceId: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .describe(
        "Id of the race the rewritten weeks lead to, from read_athlete_context, or null.",
      ),
    weeks: z
      .array(z.looseObject({}))
      .min(1)
      .max(40)
      .describe(
        "Every week of the range in the plan-format skill's week format, one per Monday from `from` to `to`.",
      ),
    specialist_opinions: z
      .array(opinionSchema)
      .max(4)
      .describe("Specialist opinions this proposal relies on."),
  }),
  output: z.strictObject({
    proposalId: z.uuid(),
    rewrittenWeeks: z.int().nonnegative(),
    replacedSessions: z.int().nonnegative(),
    newSessions: z.int().nonnegative(),
    warnings: z.array(ruleSchema),
    note: z.string(),
  }),
  run: async (context, input) => {
    const weeks = compactWeeksSchema.safeParse(input.weeks);
    if (!weeks.success) throw toolError("invalid_plan", issuesOf(weeks.error));
    const stored = await requireActivePlan(context);
    const { input: planning } = await loadPlanningInput(context);
    const inRange = (date: string) => date >= input.from && date <= input.to;
    if (input.raceId !== null) {
      const race = planning.races.find((item) => item.id === input.raceId);
      if (!race) throw toolError("not_found", { keys: [input.raceId] });
      if (!inRange(race.date))
        throw toolError("validation_failed", {
          reason: "race_outside_range",
          raceDate: race.date,
        });
    }
    const rows = compactWeeksToRows(weeks.data, {
      startsOn: input.from,
      endsOn: input.to,
      existing: stored.state,
    });
    const operation = planOperationSchema.safeParse({
      op: "rewrite_range",
      from: input.from,
      to: input.to,
      blocks: rows.blocks.map((block) => ({ ...block, raceId: input.raceId })),
      weeks: rows.weeks,
      sessions: rows.sessions,
    });
    if (!operation.success)
      throw toolError("invalid_plan", issuesOf(operation.error));
    const { changeset, warnings } = await checkPlanOperation(
      context,
      stored,
      planning,
      operation.data,
    );
    const data = await submitProposal(context, {
      p_scope: "plan",
      p_origin: input.origin,
      p_title: input.title,
      p_summary: input.summary,
      p_rationale: input.rationale,
      p_operations: [operation.data],
      p_preview: changeset,
      p_plan_id: stored.planId,
      p_base_version: stored.activeVersion,
      p_specialist_opinions: input.specialist_opinions,
      p_target_keys: stored.state.weeks
        .filter((week) => inRange(week.weekStart))
        .map((week) => `week:${week.weekKey}`),
    });
    return {
      proposalId: data.id,
      rewrittenWeeks: rows.weeks.length,
      replacedSessions: stored.state.sessions.filter((session) =>
        inRange(session.scheduledOn),
      ).length,
      newSessions: rows.sessions.length,
      warnings,
      note: "The athlete must approve this rewrite in the app.",
    };
  },
});

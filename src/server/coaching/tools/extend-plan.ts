import "server-only";
import { z } from "zod";
import {
  compactWeeksSchema,
  compactWeeksToRows,
} from "@/features/plans/compact/compact";
import { validatePlanChange } from "@/features/plans/detailing/build";
import { addDays } from "@/features/plans/model/dates";
import { raceRoles } from "@/features/plans/model/plan";
import { applyOperations } from "@/features/plans/operations/apply";
import { planOperationSchema } from "@/features/plans/operations/operations";
import { introducedRules } from "@/features/plans/review/review";
import { loadPlanningInput } from "@/server/plans/draft";
import { readSessionMatches } from "@/server/plans/matches";
import { requireActivePlan } from "./active-plan";
import { defineTool } from "./define";
import { toolError } from "./errors";
import { submitProposal } from "./plan-proposal";
import { describeRule, issuesOf, ruleSchema } from "./submit-plan";

const opinionSchema = z.strictObject({
  specialist: z.literal("medical"),
  verdict: z.string().min(1).max(64),
  summary: z.string().min(1).max(1000),
});

export const extendPlanTool = defineTool({
  name: "extend_plan",
  description:
    "Propose extending the active plan to a race the athlete added after the plan's end. Give the new end date, the race and its role, and only the added weeks, written in the plan-format skill's week format, starting the Monday after the current end. Weeks already in the plan are kept as they are. Stride runs its validator and stores a proposal that the athlete approves in the app. Returns the proposal id, or the format and validation errors to fix.",
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
      .describe("French summary of the extension."),
    rationale: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe("French explanation of why, citing the data."),
    raceId: z
      .string()
      .min(1)
      .max(64)
      .describe("Id of the added race, from read_athlete_context."),
    role: z
      .enum(raceRoles)
      .describe(
        "Role of the added race in the plan. primary makes it the plan's main objective and turns the previous one into a preparation race.",
      ),
    endsOn: z.iso
      .date()
      .describe(
        "New last day of the plan (YYYY-MM-DD), on or after the race date.",
      ),
    weeks: z
      .array(z.looseObject({}))
      .min(1)
      .max(40)
      .describe(
        "The added weeks only, in the plan-format skill's week format, one per Monday after the current end.",
      ),
    specialist_opinions: z
      .array(opinionSchema)
      .max(4)
      .describe("Specialist opinions this proposal relies on."),
  }),
  output: z.strictObject({
    proposalId: z.uuid(),
    addedWeeks: z.int().nonnegative(),
    addedSessions: z.int().nonnegative(),
    warnings: z.array(ruleSchema),
    note: z.string(),
  }),
  run: async (context, input) => {
    const weeks = compactWeeksSchema.safeParse(input.weeks);
    if (!weeks.success) throw toolError("invalid_plan", issuesOf(weeks.error));
    const stored = await requireActivePlan(context);
    const { input: planning } = await loadPlanningInput(context);
    const race = planning.races.find((item) => item.id === input.raceId);
    if (!race) throw toolError("not_found", { keys: [input.raceId] });
    if (race.date <= stored.state.plan.endsOn || race.date > input.endsOn)
      throw toolError("validation_failed", {
        reason: "race_outside_extension",
        raceDate: race.date,
        planEndsOn: stored.state.plan.endsOn,
      });
    const rows = compactWeeksToRows(weeks.data, {
      startsOn: addDays(stored.state.plan.endsOn, 1),
      endsOn: input.endsOn,
      existing: stored.state,
    });
    const operation = planOperationSchema.safeParse({
      op: "extend_plan",
      previousEndsOn: stored.state.plan.endsOn,
      endsOn: input.endsOn,
      raceId: input.raceId,
      role: input.role,
      blocks: rows.blocks.map((block) => ({ ...block, raceId: race.id })),
      weeks: rows.weeks,
      sessions: rows.sessions,
    });
    if (!operation.success)
      throw toolError("invalid_plan", issuesOf(operation.error));
    const matches = await readSessionMatches(context, stored.planId);
    const matchedSessionKeys = new Set(
      matches
        .filter((match) => match.status !== "dismissed")
        .map((match) => match.sessionKey),
    );
    const result = applyOperations(stored.state, [operation.data], {
      today: planning.today,
      matchedSessionKeys,
    });
    if (!result.ok)
      throw toolError("validation_failed", { errors: result.errors });
    const versions = {
      expected: stored.activeVersion,
      current: stored.activeVersion,
    };
    const before = validatePlanChange(planning, stored.state, stored.state, {
      versions,
      matchedSessionKeys,
    });
    const after = validatePlanChange(planning, stored.state, result.state, {
      versions,
      matchedSessionKeys,
    });
    const rulesOf = (ids: string[]) =>
      after.results
        .filter((rule) => rule.outcome === "fail" && ids.includes(rule.ruleId))
        .map(describeRule);
    const warnings = rulesOf(introducedRules(after, before, "warn"));
    const blocking = rulesOf(introducedRules(after, before, "block"));
    if (blocking.length)
      throw toolError("validation_failed", { blocking, warnings });
    const data = await submitProposal(context, {
      p_scope: "plan",
      p_origin: "race",
      p_title: input.title,
      p_summary: input.summary,
      p_rationale: input.rationale,
      p_operations: [operation.data],
      p_preview: result.changeset,
      p_plan_id: stored.planId,
      p_base_version: stored.activeVersion,
      p_specialist_opinions: input.specialist_opinions,
      p_target_keys: ["plan:end"],
    });
    return {
      proposalId: data.id,
      addedWeeks: rows.weeks.length,
      addedSessions: rows.sessions.length,
      warnings,
      note: "The athlete must approve this extension in the app.",
    };
  },
});

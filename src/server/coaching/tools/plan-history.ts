import "server-only";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";
import { defineTool } from "./define";
import { toolError } from "./errors";

export const proposalStatuses = [
  "draft",
  "ready",
  "accepted",
  "applied",
  "rejected",
  "expired",
  "superseded",
  "stale",
  "invalid",
  "reverted",
] as const;

const opinionSchema = z.strictObject({
  specialist: z.string(),
  verdict: z.string(),
  summary: z.string(),
});

const decisionSchema = z.strictObject({
  decision: z.string(),
  actor: z.string(),
  at: z.string(),
  note: z.string().optional(),
  resultingVersion: z.int().positive().optional(),
});

const historyEntrySchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  summary: z.string().optional(),
  rationale: z.string().optional(),
  scope: z.string(),
  origin: z.string(),
  status: z.enum(proposalStatuses),
  operations: z.array(z.unknown()),
  baseVersion: z.int().positive().optional(),
  appliedVersion: z.int().positive().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  validation: z.unknown().optional(),
  specialistOpinions: z.array(opinionSchema).optional(),
  decisions: z.array(decisionSchema).optional(),
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

const proposalColumns =
  "id, title, summary, rationale, scope, origin, status, operations, base_version, applied_version, created_at, updated_at, validation, specialist_opinions";

const proposalRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  rationale: z.string().nullable(),
  scope: z.string(),
  origin: z.string(),
  status: z.enum(proposalStatuses),
  operations: z.array(z.unknown()).catch([]),
  base_version: z.int().nullable(),
  applied_version: z.int().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  validation: z.unknown().nullable(),
  specialist_opinions: z.array(opinionSchema).catch([]),
});

const decisionRowSchema = z.object({
  proposal_id: z.uuid(),
  decision: z.string(),
  actor: z.string(),
  note: z.string().nullable(),
  resulting_version: z.int().nullable(),
  created_at: z.string(),
});

type ProposalRow = z.infer<typeof proposalRowSchema>;

const createPlanSchema = z.object({
  op: z.literal("create_plan"),
  state: z.object({
    plan: z.object({
      title: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
    }),
    weeks: z.array(z.unknown()),
    sessions: z.array(z.unknown()),
  }),
});

export function summarizeOperation(operation: unknown) {
  const created = createPlanSchema.safeParse(operation);
  if (!created.success) return operation;
  const { plan, weeks, sessions } = created.data.state;
  return {
    op: "create_plan",
    title: plan.title,
    startsOn: plan.startsOn,
    endsOn: plan.endsOn,
    weeks: weeks.length,
    sessions: sessions.length,
  };
}
type DecisionRow = z.infer<typeof decisionRowSchema>;

export function toHistoryEntry(
  row: ProposalRow,
  decisions: DecisionRow[],
): HistoryEntry {
  const own = decisions
    .filter((decision) => decision.proposal_id === row.id)
    .sort((first, second) => first.created_at.localeCompare(second.created_at))
    .map((decision) => ({
      decision: decision.decision,
      actor: decision.actor,
      at: decision.created_at,
      ...(decision.note ? { note: decision.note } : {}),
      ...(decision.resulting_version
        ? { resultingVersion: decision.resulting_version }
        : {}),
    }));
  return {
    id: row.id,
    title: row.title,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.rationale ? { rationale: row.rationale } : {}),
    scope: row.scope,
    origin: row.origin,
    status: row.status,
    operations: row.operations.map(summarizeOperation),
    ...(row.base_version ? { baseVersion: row.base_version } : {}),
    ...(row.applied_version ? { appliedVersion: row.applied_version } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.validation === null || row.validation === undefined
      ? {}
      : { validation: row.validation }),
    ...(row.specialist_opinions.length
      ? { specialistOpinions: row.specialist_opinions }
      : {}),
    ...(own.length ? { decisions: own } : {}),
  };
}

async function readDecisions(context: OnboardingContext, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await context.client
    .from("plan_decisions")
    .select("proposal_id, decision, actor, note, resulting_version, created_at")
    .eq("user_id", context.userId)
    .in("proposal_id", ids);
  if (error) throw new Error("Unable to read the plan decisions");
  return z.array(decisionRowSchema).parse(data ?? []);
}

export const readPlanHistoryTool = defineTool({
  name: "read_plan_history",
  description:
    "Read the athlete's recorded plan proposals, newest first: title, summary, rationale, operations, origin, scope, status, creation and update dates, validation result when recorded, specialist opinions and the decisions taken on each (accepted, rejected, applied, reverted…). New-plan operations are summarized (title, dates, week and session counts). Pass proposalId to read one proposal. Returns JSON.",
  class: "read",
  dataClasses: ["plan"],
  input: z.strictObject({
    limit: z
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Number of proposals to return, 5 by default."),
    status: z
      .enum(proposalStatuses)
      .optional()
      .describe("Only proposals with this status."),
    proposalId: z.uuid().optional().describe("Read only this proposal."),
  }),
  output: z.strictObject({
    proposals: z.array(historyEntrySchema),
  }),
  run: async (context, { limit = 5, status, proposalId }) => {
    let query = context.client
      .from("plan_proposals")
      .select(proposalColumns)
      .eq("user_id", context.userId);
    if (status) query = query.eq("status", status);
    if (proposalId) query = query.eq("id", proposalId);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("Unable to read the plan proposals");
    const rows = z.array(proposalRowSchema).parse(data ?? []);
    if (proposalId && !rows.length) throw toolError("not_found");
    const decisions = await readDecisions(
      context,
      rows.map((row) => row.id),
    );
    return { proposals: rows.map((row) => toHistoryEntry(row, decisions)) };
  },
});

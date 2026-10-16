import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import {
  buildPlanHistory,
  type HistoryFilter,
  type PlanHistory,
} from "@/features/plans/review/history";
import type { ProposalRecord } from "@/features/plans/review/proposal";
import {
  buildProposalReview,
  type ProposalReview,
} from "@/features/plans/review/review";
import {
  proposalColumns,
  proposalRowSchema,
  readDecisions,
} from "@/server/coaching/tools/plan-history";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanningInput } from "./draft";
import { readSessionMatches } from "./matches";
import { readPlanRaces } from "./overview";
import { readActivePlan, readPlanVersion, type StoredPlan } from "./stored";

type PlanContext = Pick<OnboardingContext, "client" | "userId">;

const readyProposalSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    summary: z.string().nullable().catch(null),
    created_at: z.string(),
    target_keys: z.array(z.string()).catch([]),
  })
  .transform((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    createdAt: row.created_at,
    targetKeys: row.target_keys,
  }));

export type ReadyProposal = z.infer<typeof readyProposalSchema>;

export async function readReadyProposals(
  context: PlanContext,
  planId: string,
): Promise<ReadyProposal[]> {
  if (!z.uuid().safeParse(planId).success) return [];
  const { data, error } = await context.client
    .from("plan_proposals")
    .select("id, title, summary, created_at, target_keys")
    .eq("user_id", context.userId)
    .eq("plan_id", planId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to read the plan proposals");
  return z.array(readyProposalSchema).parse(data);
}

const recordRowSchema = proposalRowSchema.extend({
  plan_id: z.uuid().nullable().catch(null),
  coach_session_id: z.uuid().nullable().catch(null),
});

async function readProposalRecords(
  context: PlanContext,
  proposalId?: string,
): Promise<{ record: ProposalRecord; planId: string | null }[]> {
  let query = context.client
    .from("plan_proposals")
    .select(`${proposalColumns}, plan_id, coach_session_id`)
    .eq("user_id", context.userId);
  if (proposalId) query = query.eq("id", proposalId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Unable to read the plan proposals");
  const rows = z.array(recordRowSchema).parse(data ?? []);
  const decisions = await readDecisions(
    context,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    planId: row.plan_id,
    record: {
      id: row.id,
      title: row.title,
      summary: row.summary,
      rationale: row.rationale,
      scope: row.scope,
      origin: row.origin,
      status: row.status,
      operations: row.operations,
      baseVersion: row.base_version,
      appliedVersion: row.applied_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      specialistOpinions: row.specialist_opinions,
      coachSessionId: row.coach_session_id,
      decisions: decisions
        .filter((decision) => decision.proposal_id === row.id)
        .sort((first, second) =>
          first.created_at.localeCompare(second.created_at),
        )
        .map((decision) => ({
          decision: decision.decision,
          actor: decision.actor,
          note: decision.note,
          resultingVersion: decision.resulting_version,
          createdAt: decision.created_at,
        })),
    },
  }));
}

async function reviewPlan(
  context: OnboardingContext,
  record: ProposalRecord,
  planId: string | null,
  active: StoredPlan | null,
) {
  const pending = record.status === "ready" || record.status === "accepted";
  if (record.scope === "new_plan" || pending || !active)
    return active
      ? {
          state: active.state,
          version: active.version,
          activeVersion: active.activeVersion,
        }
      : null;
  if (!planId || !record.baseVersion) return null;
  const base = await readPlanVersion(context, planId, record.baseVersion);
  return base
    ? {
        state: base.state,
        version: base.version,
        activeVersion: base.activeVersion,
      }
    : null;
}

export async function loadProposalReview(
  context: OnboardingContext,
  proposalId: string,
): Promise<ProposalReview | null> {
  if (!z.uuid().safeParse(proposalId).success) return null;
  const [found] = await readProposalRecords(context, proposalId);
  if (!found) return null;
  const { record, planId } = found;
  const pending = record.status === "ready" || record.status === "accepted";
  const [active, races, planning] = await Promise.all([
    readActivePlan(context),
    readPlanRaces(context),
    pending
      ? loadPlanningInput(context).catch(() => null)
      : Promise.resolve(null),
  ]);
  const matches =
    active && pending ? await readSessionMatches(context, active.planId) : [];
  const timeZone =
    active?.state.plan.timeZone ??
    planning?.input.constraints.timeZone ??
    "Europe/Paris";
  return buildProposalReview({
    proposal: record,
    plan: await reviewPlan(context, record, planId, active),
    today: planning?.today ?? localToday(timeZone),
    timeZone,
    matchedSessionKeys: new Set(
      matches
        .filter((match) => match.status !== "dismissed")
        .map((match) => match.sessionKey),
    ),
    planning: planning?.input ?? null,
    races,
    planReplaced:
      pending &&
      record.scope !== "new_plan" &&
      active !== null &&
      planId !== active.planId,
  });
}

export async function readPlanHistory(
  context: OnboardingContext,
  filter: HistoryFilter,
): Promise<PlanHistory> {
  const [records, active] = await Promise.all([
    readProposalRecords(context),
    readActivePlan(context),
  ]);
  const since = active
    ? await context.client
        .from("plan_versions")
        .select("created_at")
        .eq("plan_id", active.planId)
        .eq("version", active.activeVersion)
        .maybeSingle()
    : null;
  return buildPlanHistory({
    proposals: records.map((item) => item.record),
    plan: active
      ? {
          title: active.state.plan.title,
          activeVersion: active.activeVersion,
          since:
            typeof since?.data?.created_at === "string"
              ? since.data.created_at
              : null,
        }
      : null,
    timeZone: active?.state.plan.timeZone ?? "Europe/Paris",
    filter,
  });
}

export async function countPlanProposals(context: PlanContext) {
  const { count, error } = await context.client
    .from("plan_proposals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId);
  return error ? null : count;
}

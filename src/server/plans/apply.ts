import "server-only";
import { localToday } from "@/features/plans/constraints";
import {
  validateNewPlan,
  validatePlanChange,
} from "@/features/plans/detailing/build";
import {
  applyOperations,
  type OperationError,
  type PlanChangeset,
} from "@/features/plans/operations/apply";
import { planOperationsSchema } from "@/features/plans/operations/operations";
import { outcomeOf } from "@/features/plans/review/proposal";
import { introducedRules } from "@/features/plans/review/review";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanningInput } from "@/server/plans/draft";
import { readSessionMatches } from "@/server/plans/matches";
import { readActivePlan } from "@/server/plans/stored";

export type ApplyResult =
  { ok: true; version: number } | { ok: false; reason: string };

function failureReason(errors: OperationError[]) {
  if (
    errors.some(
      (error) => error.code === "frozen_session" || error.code === "past_date",
    )
  )
    return "frozen_session";
  if (errors.some((error) => error.code === "unknown_key"))
    return "unknown_key";
  return "validation_failed";
}

async function changesetFor(
  context: OnboardingContext,
  proposal: {
    scope: string;
    operations: unknown;
    plan_id: string | null;
    base_version: number | null;
  },
): Promise<PlanChangeset | string> {
  const operations = planOperationsSchema.safeParse(proposal.operations);
  if (!operations.success) return "invalid_operations";
  if (proposal.scope === "new_plan") {
    const [creation] = operations.data;
    if (operations.data.length !== 1 || creation.op !== "create_plan")
      return "invalid_operations";
    const { today, input } = await loadPlanningInput(context);
    const report = validateNewPlan(input, creation.state);
    if (introducedRules(report, null, "block").length > 0)
      return "validation_failed";
    const result = applyOperations(null, operations.data, {
      today,
      matchedSessionKeys: new Set(),
    });
    return result.ok ? result.changeset : failureReason(result.errors);
  }
  const stored = await readActivePlan(context);
  if (!stored) return "no_active_plan";
  if (
    proposal.plan_id !== stored.planId ||
    proposal.base_version !== stored.activeVersion
  )
    return "stale_version";
  const matches = await readSessionMatches(context, stored.planId);
  const matchedSessionKeys = new Set(
    matches
      .filter((match) => match.status !== "dismissed")
      .map((match) => match.sessionKey),
  );
  const result = applyOperations(stored.state, operations.data, {
    today: localToday(stored.state.plan.timeZone),
    matchedSessionKeys,
  });
  if (!result.ok) return failureReason(result.errors);
  const { input } = await loadPlanningInput(context);
  const versions = {
    expected: stored.activeVersion,
    current: stored.activeVersion,
  };
  const before = validatePlanChange(input, stored.state, stored.state, {
    versions,
    matchedSessionKeys,
  });
  const after = validatePlanChange(input, stored.state, result.state, {
    versions,
    matchedSessionKeys,
  });
  return introducedRules(after, before, "block").length > 0
    ? "validation_failed"
    : result.changeset;
}

async function recordOutcome(
  context: OnboardingContext,
  proposalId: string,
  reason: string,
) {
  const outcome = outcomeOf(reason);
  if (!outcome) return;
  const { error } = await context.client.rpc("record_plan_proposal_outcome", {
    p_proposal_id: proposalId,
    p_outcome: outcome,
    p_note: reason,
  });
  if (error)
    console.error("Unable to record the proposal outcome", {
      proposalId,
      reason,
      error: error.message,
    });
}

export async function applyAcceptedProposal(
  context: OnboardingContext,
  proposalId: string,
): Promise<ApplyResult> {
  const { data: proposal, error } = await context.client
    .from("plan_proposals")
    .select("id, status, scope, operations, plan_id, base_version")
    .eq("id", proposalId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read the proposal");
  if (!proposal) return { ok: false, reason: "not_found" };
  if (proposal.status !== "accepted")
    return { ok: false, reason: "not_accepted" };
  const changeset = await changesetFor(context, proposal);
  if (typeof changeset === "string") {
    await recordOutcome(context, proposal.id, changeset);
    return { ok: false, reason: changeset };
  }
  const { data: version, error: applyError } = await context.client.rpc(
    "apply_accepted_plan_proposal",
    {
      p_proposal_id: proposal.id,
      p_changeset: JSON.parse(JSON.stringify(changeset)),
    },
  );
  if (applyError) {
    await recordOutcome(context, proposal.id, applyError.message);
    return { ok: false, reason: applyError.message };
  }
  return { ok: true, version };
}

export async function resetPlan(context: OnboardingContext) {
  const stored = await readActivePlan(context);
  const { error } = await context.client.rpc(
    "reset_own_plan",
    stored ? { p_plan_id: stored.planId } : {},
  );
  if (error) throw new Error("Unable to reset the plan");
}

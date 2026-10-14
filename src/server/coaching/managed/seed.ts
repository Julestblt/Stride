import "server-only";
import { applyOperations } from "@/features/plans/operations/apply";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanDraft } from "@/server/plans/draft";
import { readActivePlan } from "@/server/plans/stored";

export type SeedResult =
  | { ok: true; proposalId: string }
  | { ok: false; reason: "plan_exists" | "draft_unavailable" | "failed" };

export async function proposeDraftAsPlan(
  context: OnboardingContext,
): Promise<SeedResult> {
  if (await readActivePlan(context))
    return { ok: false, reason: "plan_exists" };
  const { today, plan } = await loadPlanDraft(context);
  if (plan.status !== "ready")
    return { ok: false, reason: "draft_unavailable" };
  const operations = [{ op: "create_plan" as const, state: plan.state }];
  const result = applyOperations(null, operations, {
    today,
    matchedSessionKeys: new Set(),
  });
  if (!result.ok) return { ok: false, reason: "draft_unavailable" };
  const { data, error } = await context.client.rpc("submit_plan_proposal", {
    p_scope: "new_plan",
    p_origin: "training",
    p_title: plan.state.plan.title,
    p_summary: "Plan initial issu du brouillon déterministe.",
    p_rationale: "Plan de départ pour tester le coach.",
    p_operations: operations,
    p_preview: result.changeset,
    p_target_keys: ["plan"],
  });
  if (error) return { ok: false, reason: "failed" };
  const accepted = await context.client.rpc("accept_plan_proposal", {
    p_proposal_id: data.id,
  });
  if (accepted.error) return { ok: false, reason: "failed" };
  return { ok: true, proposalId: data.id };
}

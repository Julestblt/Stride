import "server-only";
import postgres from "postgres";
import { localToday } from "@/features/plans/constraints";
import { validateNewPlan } from "@/features/plans/detailing/build";
import {
  applyOperations,
  type PlanChangeset,
} from "@/features/plans/operations/apply";
import { planOperationsSchema } from "@/features/plans/operations/operations";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanningInput } from "@/server/plans/draft";
import { readSessionMatches } from "@/server/plans/matches";
import { readActivePlan } from "@/server/plans/stored";

let sql: postgres.Sql | null = null;

function workerSql() {
  const url = process.env.COACH_WORKER_DATABASE_URL;
  if (!url) throw new Error("The coach worker database is not configured");
  sql ??= postgres(url, { prepare: false, max: 2 });
  return sql;
}

export type WorkerResult =
  { ok: true; version?: number } | { ok: false; reason: string };

async function changesetFor(
  context: OnboardingContext,
  proposal: { scope: string; operations: unknown },
): Promise<PlanChangeset | string> {
  const operations = planOperationsSchema.safeParse(proposal.operations);
  if (!operations.success) return "invalid_operations";
  if (proposal.scope === "new_plan") {
    const [creation] = operations.data;
    if (operations.data.length !== 1 || creation.op !== "create_plan")
      return "invalid_operations";
    const { today, input } = await loadPlanningInput(context);
    const report = validateNewPlan(input, creation.state);
    if (
      report.results.some(
        (result) => result.outcome === "fail" && result.severity === "block",
      )
    )
      return "validation_failed";
    const result = applyOperations(null, operations.data, {
      today,
      matchedSessionKeys: new Set(),
    });
    return result.ok ? result.changeset : "validation_failed";
  }
  const stored = await readActivePlan(context);
  if (!stored) return "no_active_plan";
  const matches = await readSessionMatches(context, stored.planId);
  const result = applyOperations(stored.state, operations.data, {
    today: localToday(stored.state.plan.timeZone),
    matchedSessionKeys: new Set(
      matches
        .filter((match) => match.status !== "dismissed")
        .map((match) => match.sessionKey),
    ),
  });
  return result.ok ? result.changeset : "validation_failed";
}

export async function applyAcceptedProposal(
  context: OnboardingContext,
  proposalId: string,
): Promise<WorkerResult> {
  const { data: proposal, error } = await context.client
    .from("plan_proposals")
    .select("id, status, scope, operations")
    .eq("id", proposalId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read the proposal");
  if (!proposal) return { ok: false, reason: "not_found" };
  if (proposal.status !== "accepted")
    return { ok: false, reason: "not_accepted" };
  const changeset = await changesetFor(context, proposal);
  if (typeof changeset === "string") return { ok: false, reason: changeset };
  try {
    const [row] = await workerSql()<{ version: number }[]>`
      select (private.apply_plan_proposal(
        ${proposal.id}::uuid,
        ${workerSql().json(JSON.parse(JSON.stringify(changeset)))}
      )).version as version`;
    return { ok: true, version: row.version };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "apply_failed";
    return { ok: false, reason: message };
  }
}

export async function deleteActivePlan(
  context: OnboardingContext,
): Promise<WorkerResult> {
  const stored = await readActivePlan(context);
  if (!stored) return { ok: false, reason: "no_active_plan" };
  await workerSql()`
    select private.delete_plan(${context.userId}::uuid, ${stored.planId}::uuid)`;
  return { ok: true };
}

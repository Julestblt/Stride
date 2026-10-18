"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { outcomeOf } from "@/features/plans/review/proposal";
import { requestProposalApply } from "@/server/coaching/worker-client";
import { syncWatchAfterResponse } from "@/server/garmin/watch";
import {
  getOnboardingContext,
  type OnboardingContext,
} from "@/server/onboarding/context";

export type ProposalActionResult =
  | { status: "applied"; version: number | null }
  | { status: "rejected" }
  | { status: "pending" }
  | { status: "stale" | "invalid"; reason: string }
  | { status: "invalid-request" | "session-expired" | "error" };

const inputSchema = z.strictObject({ proposalId: z.uuid() });

function refresh() {
  revalidatePath("/plan", "layout");
  revalidatePath("/today");
}

async function decide(
  input: unknown,
  run: (
    context: OnboardingContext,
    proposalId: string,
  ) => Promise<ProposalActionResult>,
): Promise<ProposalActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid-request" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const result = await run(context, parsed.data.proposalId);
  refresh();
  return result;
}

async function apply(
  context: OnboardingContext,
  proposalId: string,
): Promise<ProposalActionResult> {
  const result = await requestProposalApply(context, proposalId);
  if (result.ok) {
    await syncWatchAfterResponse(context);
    return { status: "applied", version: result.version ?? null };
  }
  if (["worker_unavailable", "worker_failed"].includes(result.reason))
    return { status: "pending" };
  const outcome = outcomeOf(result.reason);
  return outcome
    ? { status: outcome, reason: result.reason }
    : { status: "error" };
}

export async function acceptProposal(
  input: unknown,
): Promise<ProposalActionResult> {
  return decide(input, async (context, proposalId) => {
    const { error } = await context.client.rpc("accept_plan_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) return { status: "error" };
    return apply(context, proposalId);
  });
}

export async function retryProposal(
  input: unknown,
): Promise<ProposalActionResult> {
  return decide(input, apply);
}

export async function rejectProposal(
  input: unknown,
): Promise<ProposalActionResult> {
  return decide(input, async (context, proposalId) => {
    const { error } = await context.client.rpc("reject_plan_proposal", {
      p_proposal_id: proposalId,
    });
    return error ? { status: "error" } : { status: "rejected" };
  });
}

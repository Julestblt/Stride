import "server-only";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

const resultSchema = z.union([
  z.object({ ok: z.literal(true), version: z.number().int().optional() }),
  z.object({ ok: z.literal(false), reason: z.string().max(200) }),
]);

export type WorkerCallResult = z.infer<typeof resultSchema>;

async function callWorker(
  context: OnboardingContext,
  path: string,
): Promise<WorkerCallResult> {
  const origin = process.env.COACH_WORKER_URL;
  if (!origin) return { ok: false, reason: "worker_unavailable" };
  try {
    const response = await fetch(new URL(path, origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${context.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const parsed = resultSchema.safeParse(await response.json());
    return parsed.success
      ? parsed.data
      : { ok: false, reason: "worker_unavailable" };
  } catch {
    return { ok: false, reason: "worker_unavailable" };
  }
}

export function requestProposalApply(
  context: OnboardingContext,
  proposalId: string,
) {
  return callWorker(
    context,
    `/v1/proposals/${encodeURIComponent(proposalId)}/apply`,
  );
}

export function requestPlanReset(context: OnboardingContext) {
  return callWorker(context, "/v1/plan/reset");
}

import "server-only";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

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

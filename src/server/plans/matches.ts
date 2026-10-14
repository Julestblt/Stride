import "server-only";
import { z } from "zod";
import { matchStatuses } from "@/features/plans/matching/adherence";
import type { OnboardingContext } from "@/server/onboarding/context";

type PlanContext = Pick<OnboardingContext, "client" | "userId">;

const ratio = z.number().nullable().catch(null);

const sessionMatchSchema = z
  .object({
    session_key: z.string(),
    activity_id: z.uuid().nullable(),
    method: z.enum(["auto", "athlete"]),
    status: z.enum(matchStatuses),
    confidence: z.coerce.number().min(0).max(1),
    compliance: z
      .object({ duration: ratio, distance: ratio, intensity: ratio })
      .partial()
      .catch({}),
    algorithm_version: z.string().nullable(),
  })
  .transform((row) => ({
    sessionKey: row.session_key,
    activityId: row.activity_id,
    method: row.method,
    status: row.status,
    confidence: row.confidence,
    compliance: {
      duration: row.compliance.duration ?? null,
      distance: row.compliance.distance ?? null,
      intensity: row.compliance.intensity ?? null,
    },
    algorithmVersion: row.algorithm_version,
  }));

export type SessionMatch = z.infer<typeof sessionMatchSchema>;

export async function readSessionMatches(
  context: PlanContext,
  planId: string,
): Promise<SessionMatch[]> {
  if (!z.uuid().safeParse(planId).success) return [];
  const { data, error } = await context.client
    .from("session_activity_matches")
    .select(
      "session_key, activity_id, method, status, confidence, compliance, algorithm_version",
    )
    .eq("user_id", context.userId)
    .eq("plan_id", planId)
    .order("session_key", { ascending: true });
  if (error) throw new Error("Unable to read the session matches");
  return z.array(sessionMatchSchema).parse(data);
}

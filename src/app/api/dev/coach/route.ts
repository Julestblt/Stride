import { z } from "zod";
import { getOnboardingContext } from "@/server/onboarding/context";
import { applyAcceptedProposal, resetPlan } from "@/server/plans/apply";

const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("apply"), proposalId: z.uuid() }),
  z.strictObject({ action: z.literal("delete-plan") }),
  z.strictObject({
    action: z.literal("decide"),
    proposalId: z.uuid(),
    decision: z.enum(["accept", "reject"]),
  }),
]);

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (process.env.NODE_ENV === "production")
    return Response.json({ code: "not-found" }, { status: 404, headers });
  const context = await getOnboardingContext();
  if (!context)
    return Response.json({ code: "session-expired" }, { status: 401, headers });
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ code: "invalid-request" }, { status: 400, headers });
  const body = parsed.data;

  if (body.action === "apply")
    return Response.json(
      await applyAcceptedProposal(context, body.proposalId),
      { headers },
    );

  if (body.action === "delete-plan") {
    await resetPlan(context);
    return Response.json({ ok: true }, { headers });
  }

  const { error } = await context.client.rpc(
    body.decision === "accept"
      ? "accept_plan_proposal"
      : "reject_plan_proposal",
    { p_proposal_id: body.proposalId },
  );
  return Response.json({ ok: !error }, { status: error ? 409 : 200, headers });
}

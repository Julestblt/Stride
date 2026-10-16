import { z } from "zod";
import { proposeDraftAsPlan } from "@/server/coaching/managed/seed";
import {
  runCoachTurn,
  SessionAccessError,
} from "@/server/coaching/managed/session";
import {
  requestPlanReset,
  requestProposalApply,
} from "@/server/coaching/worker-client";
import { getOnboardingContext } from "@/server/onboarding/context";

export const maxDuration = 900;

const requestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("turn"),
    sessionId: z.string().startsWith("sesn_").optional(),
    mode: z.enum(["conversation", "plan"]),
    input: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("message"),
        text: z.string().trim().min(1).max(2000),
      }),
      z.strictObject({
        kind: z.literal("answer"),
        toolUseId: z.string().min(1).max(64),
        text: z.string().trim().min(1).max(2000),
      }),
    ]),
  }),
  z.strictObject({ action: z.literal("seed") }),
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

  if (body.action === "seed")
    return Response.json(await proposeDraftAsPlan(context), { headers });

  if (body.action === "apply")
    return Response.json(await requestProposalApply(context, body.proposalId), {
      headers,
    });

  if (body.action === "delete-plan")
    return Response.json(await requestPlanReset(context), { headers });

  if (body.action === "decide") {
    const { error } = await context.client.rpc(
      body.decision === "accept"
        ? "accept_plan_proposal"
        : "reject_plan_proposal",
      { p_proposal_id: body.proposalId },
    );
    return Response.json(
      { ok: !error },
      { status: error ? 409 : 200, headers },
    );
  }

  try {
    return Response.json(
      await runCoachTurn(context, body.sessionId, body.input, body.mode),
      { headers },
    );
  } catch (error) {
    if (error instanceof SessionAccessError)
      return Response.json({ code: "not-found" }, { status: 404, headers });
    throw error;
  }
}

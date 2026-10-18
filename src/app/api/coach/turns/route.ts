import { after } from "next/server";
import { z } from "zod";
import { coachAttachmentsSchema } from "@/features/coach/attachments";
import { specialistAgents } from "@/features/coach/staff";
import { AttachmentAccessError } from "@/server/coaching/attachments";
import {
  SessionAccessError,
  SessionStateError,
  streamCoachTurn,
  type TurnEvent,
  type TurnRequest,
} from "@/server/coaching/managed/session";
import { sessionModes } from "@/server/coaching/managed/store";
import { detachedTurnStream } from "@/server/coaching/managed/turn-stream";
import { getOnboardingContext } from "@/server/onboarding/context";

export const maxDuration = 960;

const requestSchema = z.strictObject({
  sessionId: z
    .string()
    .regex(/^sesn_[A-Za-z0-9]{1,64}$/)
    .optional(),
  mode: z.enum(sessionModes),
  input: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("message"),
      text: z.string().trim().min(1).max(2000),
      consult: z.enum(specialistAgents).optional(),
      attachments: coachAttachmentsSchema.optional(),
    }),
    z.strictObject({
      kind: z.literal("answer"),
      toolUseId: z.string().min(1).max(64),
      text: z.string().trim().min(1).max(2000),
    }),
  ]),
});

const jsonHeaders = { "Cache-Control": "private, no-store" };

function rejection(error: unknown) {
  if (error instanceof AttachmentAccessError)
    return Response.json(
      { code: "invalid-request" },
      { status: 400, headers: jsonHeaders },
    );
  if (error instanceof SessionAccessError)
    return Response.json(
      { code: "not-found" },
      { status: 404, headers: jsonHeaders },
    );
  if (error instanceof SessionStateError)
    return Response.json(
      { code: error.code },
      { status: 409, headers: jsonHeaders },
    );
  throw error;
}

export async function POST(request: Request) {
  const context = await getOnboardingContext({ writable: true });
  if (!context)
    return Response.json(
      { code: "session-expired" },
      { status: 401, headers: jsonHeaders },
    );
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { code: "invalid-request" },
      { status: 400, headers: jsonHeaders },
    );

  const turn = streamCoachTurn(context, parsed.data satisfies TurnRequest);
  let first: IteratorResult<TurnEvent>;
  try {
    first = await turn.next();
  } catch (error) {
    return rejection(error);
  }

  const { body, drained } = detachedTurnStream(first, turn);
  after(drained);

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

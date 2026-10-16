import { z } from "zod";
import { parseThreadItem, type ThreadItem } from "./items";

export type StreamEvent =
  | { type: "session"; sessionId: string; threadId: string }
  | { type: "item"; item: ThreadItem }
  | { type: "question"; toolUseId: string }
  | { type: "error"; text: string }
  | { type: "done"; status: string };

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session"),
    sessionId: z.string(),
    threadId: z.uuid(),
  }),
  z.object({
    type: z.literal("item"),
    item: z.looseObject({ kind: z.string(), at: z.string() }),
  }),
  z.object({
    type: z.literal("question"),
    question: z.object({ toolUseId: z.string() }),
  }),
  z.object({ type: z.literal("done"), status: z.string() }),
  z.object({ type: z.literal("error"), text: z.string() }),
]);

export function parseStreamEvent(raw: unknown): StreamEvent | null {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return null;
  const event = parsed.data;
  if (event.type === "item") {
    const { kind, at, ...body } = event.item;
    const item = parseThreadItem({ kind, body, created_at: at });
    return item ? { type: "item", item } : null;
  }
  if (event.type === "question")
    return { type: "question", toolUseId: event.question.toolUseId };
  if (event.type === "error") return { type: "error", text: event.text };
  return event;
}

export function splitFrames(buffer: string) {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  const events = frames.flatMap((frame) => {
    if (!frame.startsWith("data: ")) return [];
    try {
      const event = parseStreamEvent(JSON.parse(frame.slice(6)));
      return event ? [event] : [];
    } catch {
      return [];
    }
  });
  return { events, rest };
}

export const turnRefusals: Record<string, string> = {
  "not-found": "Cette conversation est introuvable.",
  "session-expired": "Ta session a expiré. Reconnecte-toi pour continuer.",
  "invalid-request": "Ton message n’a pas pu être envoyé.",
  session_closed:
    "Cette conversation est terminée. Démarre une nouvelle conversation pour continuer.",
  turn_in_progress: "Le staff travaille déjà sur ta demande.",
  answer_required: "Réponds d’abord à la question du staff.",
  no_pending_question: "Cette question n’attend plus de réponse.",
};

export const turnFailure =
  "Le message n’a pas pu être envoyé. Réessaie dans quelques instants.";

export function refusalText(code: unknown) {
  return typeof code === "string" && code in turnRefusals
    ? turnRefusals[code]
    : turnFailure;
}

import "server-only";
import { turnMessages, type TurnEvent } from "./session";

export function detachedTurnStream(
  first: IteratorResult<TurnEvent>,
  turn: AsyncIterable<TurnEvent>,
) {
  const encoder = new TextEncoder();
  let open = true;
  let sink!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      sink = controller;
    },
    cancel() {
      open = false;
    },
  });
  const send = (event: TurnEvent) => {
    if (!open) return;
    try {
      sink.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      open = false;
    }
  };
  const drained = (async () => {
    try {
      if (!first.done) send(first.value);
      for await (const event of turn) send(event);
    } catch (error) {
      console.error("Coach turn stopped", {
        error: error instanceof Error ? error.message : "unknown",
      });
      send({ type: "error", code: "failed", text: turnMessages.failed });
    } finally {
      if (open) sink.close();
      open = false;
    }
  })();
  return { body, drained };
}

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { TurnEvent } from "../../src/server/coaching/managed/session";
import { detachedTurnStream } from "../../src/server/coaching/managed/turn-stream";

const coach = (text: string): TurnEvent => ({ type: "coach", text });

function turnOf(events: TurnEvent[], gate: Promise<void>) {
  const pulled: TurnEvent[] = [];
  let finished = false;
  async function* turn() {
    try {
      await gate;
      for (const event of events) {
        pulled.push(event);
        yield event;
      }
    } finally {
      finished = true;
    }
  }
  return { turn: turn(), pulled, finished: () => finished };
}

async function readAll(body: ReadableStream<Uint8Array>) {
  return new Response(body).text();
}

describe("detached Coach turn stream", () => {
  it("streams every event while the athlete stays connected", async () => {
    const { turn } = turnOf(
      [coach("Bonjour"), coach("Voilà")],
      Promise.resolve(),
    );
    const { body, drained } = detachedTurnStream(
      { done: false, value: coach("Je regarde") },
      turn,
    );
    const text = await readAll(body);
    await drained;
    expect(text.split("\n\n").filter(Boolean)).toEqual([
      `data: ${JSON.stringify(coach("Je regarde"))}`,
      `data: ${JSON.stringify(coach("Bonjour"))}`,
      `data: ${JSON.stringify(coach("Voilà"))}`,
    ]);
  });

  it("keeps running the turn to its end after the athlete disconnects", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const events = [coach("Semaine 1"), coach("Semaine 2"), coach("Fin")];
    const { turn, pulled, finished } = turnOf(events, gate);
    const { body, drained } = detachedTurnStream(
      { done: false, value: coach("Je regarde") },
      turn,
    );
    const reader = body.getReader();
    await reader.read();
    await reader.cancel();
    release();
    await drained;
    expect(pulled).toEqual(events);
    expect(finished()).toBe(true);
  });

  it("closes the stream with a French error when the turn throws", async () => {
    async function* turn(): AsyncGenerator<TurnEvent> {
      yield coach("Je regarde");
      throw new Error("boom");
    }
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { body, drained } = detachedTurnStream(
      { done: true, value: undefined },
      turn(),
    );
    const text = await readAll(body);
    await drained;
    expect(text).toContain('"type":"error"');
    expect(text).toContain("Le coach a rencontré un problème.");
    error.mockRestore();
  });
});

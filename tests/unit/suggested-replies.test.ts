import { describe, expect, it } from "vitest";
import type { ThreadItem } from "../../src/features/coach/items";
import {
  suggestedReplies,
  suggestedReplyLength,
  suggestedReplyLimit,
  suggestedReplySets,
  type SuggestedReplyState,
} from "../../src/features/coach/suggested-replies";

const at = "2026-10-18T08:00:00.000Z";

const athlete: ThreadItem = {
  kind: "athlete",
  at,
  text: "Mon mollet est tendu",
  consult: null,
  attachments: [],
};

const coach: ThreadItem = { kind: "coach", at, text: "On reste en facile." };

const consultEnd: ThreadItem = {
  kind: "consult_end",
  at,
  thread: "sthr_calf",
  agent: "medical",
};

const staffReplied: SuggestedReplyState = {
  mode: "conversation",
  busy: false,
  closed: false,
  questionPending: false,
  status: null,
  items: [athlete, coach],
};

describe("suggestedReplies", () => {
  it("keeps every set short enough for the row", () => {
    for (const set of Object.values(suggestedReplySets)) {
      expect(set.length).toBeLessThanOrEqual(suggestedReplyLimit);
      for (const reply of set)
        expect(reply.length).toBeLessThanOrEqual(suggestedReplyLength);
    }
  });

  it("follows up after a staff reply", () => {
    expect(suggestedReplies(staffReplied)).toEqual(
      suggestedReplySets.afterReply,
    );
    expect(
      suggestedReplies({
        ...staffReplied,
        items: [athlete, coach, consultEnd],
      }),
    ).toEqual(suggestedReplySets.afterReply);
  });

  it("asks about a pending proposal without accepting it", () => {
    const replies = suggestedReplies({ ...staffReplied, status: "proposal" });
    expect(replies).toEqual(suggestedReplySets.proposal);
    expect(replies.join(" ")).not.toMatch(/accept|valide|activer/i);
  });

  it("follows up on a proposal that is no longer pending", () => {
    const proposal: ThreadItem = {
      kind: "proposal",
      at,
      proposalId: "eeeeeeee-0000-4000-8000-900000000001",
      scope: "new_plan",
      title: "Plan EcoTrail",
      summary: null,
      opinions: [],
    };
    expect(
      suggestedReplies({ ...staffReplied, items: [athlete, proposal] }),
    ).toEqual(suggestedReplySets.afterReply);
  });

  it("follows up on an applied plan", () => {
    expect(suggestedReplies({ ...staffReplied, status: "applied" })).toEqual(
      suggestedReplySets.applied,
    );
  });

  it("hides the row while the staff works", () => {
    expect(suggestedReplies({ ...staffReplied, busy: true })).toEqual([]);
    expect(suggestedReplies({ ...staffReplied, status: "working" })).toEqual(
      [],
    );
  });

  it("leaves a pending question to its options", () => {
    expect(
      suggestedReplies({
        ...staffReplied,
        questionPending: true,
        status: "question",
      }),
    ).toEqual([]);
  });

  it("hides the row in a closed thread", () => {
    expect(
      suggestedReplies({ ...staffReplied, closed: true, status: "closed" }),
    ).toEqual([]);
  });

  it("offers openers in a new conversation", () => {
    expect(suggestedReplies({ ...staffReplied, items: [] })).toEqual(
      suggestedReplySets.start,
    );
  });

  it("stays out of a plan request draft", () => {
    expect(
      suggestedReplies({ ...staffReplied, mode: "plan", items: [] }),
    ).toEqual([]);
  });

  it("waits for the staff after an athlete message", () => {
    expect(suggestedReplies({ ...staffReplied, items: [athlete] })).toEqual([]);
  });
});

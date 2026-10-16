import { describe, expect, it } from "vitest";
import {
  conversationSections,
  dayLabel,
  listDateLabel,
  participantsLine,
  staffReads,
  suiviParticipants,
  suiviTimeline,
  threadParticipants,
  threadPreview,
  threadStatus,
  threadTitle,
} from "../../src/features/coach/conversations";
import {
  itemBody,
  parseThreadItem,
  type ThreadItem,
} from "../../src/features/coach/items";
import { portraitCrop } from "../../src/features/coach/portrait-crop";
import { readLabel } from "../../src/features/coach/reads";
import { agentOfManagedName } from "../../src/features/coach/staff";
import {
  buildThread,
  questionAttribution,
} from "../../src/features/coach/thread";

const at = (minute: number) =>
  `2026-10-16T12:${String(minute).padStart(2, "0")}:00Z`;
const tz = "Europe/Paris";
const proposalId = "d0000000-0000-4000-8000-00000000000d";

const consultTurn: ThreadItem[] = [
  { kind: "athlete", at: at(0), text: "J’ai mal au genou", consult: "medical" },
  { kind: "coach", at: at(1), text: "Je demande à Inès." },
  {
    kind: "consult_request",
    at: at(1),
    thread: "sthr_m",
    agent: "medical",
    text: "Knee pain?",
  },
  {
    kind: "read",
    at: at(2),
    thread: "sthr_m",
    agent: "medical",
    tool: "read_health_reports",
    label: "Signalements · 14 jours",
  },
  {
    kind: "read",
    at: at(2),
    thread: "primary",
    agent: "coach",
    tool: "read_athlete_context",
    label: "Profil et contexte",
  },
];

const consultDone: ThreadItem[] = [
  ...consultTurn,
  {
    kind: "consult_reply",
    at: at(3),
    thread: "sthr_m",
    agent: "medical",
    text: "Ask about downhill.",
  },
  { kind: "consult_end", at: at(3), thread: "sthr_m", agent: "medical" },
  {
    kind: "question",
    at: at(4),
    toolUseId: "sevt_ask",
    question: "Ton genou te gêne-t-il en descente ?",
    askedFor: "medical",
  },
];

function coachEntry(
  items: ThreadItem[],
  live = false,
  pending = null as string | null,
) {
  const entries = buildThread({ items, live, pendingToolUseId: pending });
  const entry = entries.at(-1);
  if (entry?.type !== "coach") throw new Error("expected a coach entry");
  return entry;
}

describe("thread items", () => {
  it("round-trips a stored row and rejects unknown kinds", () => {
    const item = consultDone[2];
    expect(
      parseThreadItem({
        kind: item.kind,
        body: itemBody(item),
        created_at: item.at,
      }),
    ).toEqual(item);
    expect(
      parseThreadItem({ kind: "tool", body: {}, created_at: at(0) }),
    ).toBeNull();
    expect(
      parseThreadItem({ kind: "coach", body: { nope: 1 }, created_at: at(0) }),
    ).toBeNull();
  });
});

describe("thread view model", () => {
  it("shows a live Concertation while the specialist works", () => {
    const entry = coachEntry(consultTurn, true);
    expect(entry.blocks[0]).toEqual({
      type: "text",
      text: "Je demande à Inès.",
    });
    const consult = entry.blocks[1];
    expect(consult).toMatchObject({ type: "consult", live: true });
    if (consult.type !== "consult") throw new Error();
    expect(consult.consults).toEqual([
      expect.objectContaining({
        agent: "medical",
        state: "working",
        reads: ["Signalements · 14 jours"],
        summary: "Lit signalements · 14 jours…",
        steps: [{ from: "coach", to: "medical", text: "Knee pain?" }],
      }),
    ]);
  });

  it("folds the consult once the specialist is done and attributes the question", () => {
    const entry = coachEntry(consultDone, true, "sevt_ask");
    const [, consult, question] = entry.blocks;
    expect(consult).toMatchObject({ type: "consult", live: false });
    if (consult.type !== "consult") throw new Error();
    expect(consult.consults[0]).toMatchObject({
      state: "asked",
      summary: "Question pour toi",
      steps: [
        { from: "coach", to: "medical", text: "Knee pain?" },
        { from: "medical", to: "coach", text: "Ask about downhill." },
      ],
    });
    expect(question).toMatchObject({
      type: "question",
      askedFor: "medical",
      state: "pending",
    });
    expect(questionAttribution("medical")).toBe("Question d’Inès");
    expect(questionAttribution("coach")).toBe("Question de Claire");
  });

  it("links a question to its consult when the Coach wrote in between", () => {
    const [question] = consultDone.slice(-1);
    const entry = coachEntry(
      [
        ...consultDone.slice(0, -1),
        { kind: "coach", at: at(4), text: "Inès a une question pour toi." },
        question,
      ],
      true,
      "sevt_ask",
    );
    expect(entry.blocks.map((block) => block.type)).toEqual([
      "text",
      "consult",
      "text",
      "question",
    ]);
    expect(entry.blocks[1]).toMatchObject({
      live: false,
      consults: [{ state: "asked", summary: "Question pour toi" }],
    });
  });

  it("marks an answered question and starts a new athlete entry", () => {
    const entries = buildThread({
      items: [
        ...consultDone,
        { kind: "answer", at: at(5), toolUseId: "sevt_ask", text: "Non" },
        { kind: "coach", at: at(6), text: "Parfait." },
      ],
      live: false,
      pendingToolUseId: null,
    });
    expect(entries.map((entry) => entry.type)).toEqual([
      "athlete",
      "coach",
      "athlete",
      "coach",
    ]);
    expect(entries[0]).toMatchObject({ consult: "medical", answer: false });
    expect(entries[2]).toMatchObject({ answer: true, text: "Non" });
    const coach = entries[1];
    if (coach.type !== "coach") throw new Error();
    expect(coach.blocks.at(-1)).toMatchObject({
      state: "answered",
      answeredAt: at(5),
    });
  });

  it("closes an unanswered question that is no longer pending", () => {
    expect(coachEntry(consultDone).blocks.at(-1)).toMatchObject({
      state: "closed",
    });
  });

  it("folds a reloaded consult even without its end event", () => {
    const consult = coachEntry(consultTurn).blocks[1];
    expect(consult).toMatchObject({ type: "consult", live: false });
    if (consult.type !== "consult") throw new Error();
    expect(consult.consults[0].state).toBe("replied");
  });

  it("shows a proposal card with its stored status", () => {
    const items: ThreadItem[] = [
      { kind: "athlete", at: at(0), text: "Fais-moi un plan", consult: null },
      {
        kind: "proposal",
        at: at(9),
        proposalId,
        scope: "new_plan",
        title: "Marathon",
        summary: null,
        opinions: [],
      },
    ];
    const card = (status?: string) =>
      buildThread({
        items,
        live: false,
        pendingToolUseId: null,
        proposalStatuses: status ? { [proposalId]: status } : {},
      })[1];
    expect(card()).toMatchObject({ blocks: [{ status: "pending" }] });
    expect(card("applied")).toMatchObject({ blocks: [{ status: "applied" }] });
    expect(card("rejected")).toMatchObject({
      blocks: [{ status: "rejected" }],
    });
    expect(card("stale")).toMatchObject({ blocks: [{ status: "closed" }] });
  });

  it("shows a turn error inside the coach entry", () => {
    const entry = coachEntry([
      { kind: "athlete", at: at(0), text: "Salut", consult: null },
      { kind: "error", at: at(1), code: "timeout", text: "Trop long" },
    ]);
    expect(entry.blocks).toEqual([{ type: "error", text: "Trop long" }]);
  });
});

describe("conversations", () => {
  const now = new Date("2026-10-16T14:00:00Z");

  it("titles a thread from the first message", () => {
    expect(threadTitle("  Mon   genou  ")).toBe("Mon genou");
    expect(threadTitle("Peux-tu regarder ma semaine prochaine ? Merci")).toBe(
      "Peux-tu regarder ma semaine prochaine",
    );
    expect(
      threadTitle(
        "J’ai vu le Trail des Lacs, 50 km et 2 400 m D+ fin juin. Ça te paraît jouable ?",
      ),
    ).toBe("J’ai vu le Trail des Lacs, 50 km et 2 400 m D+ fin juin");
    expect(threadTitle("")).toBe("Nouvelle conversation");
  });

  it("derives the status shown in the list", () => {
    const base = { lastTurnAt: now.toISOString(), now, proposalStatuses: [] };
    expect(threadStatus({ ...base, state: "running" })).toBe("working");
    expect(
      threadStatus({
        ...base,
        state: "running",
        lastTurnAt: "2026-10-16T13:00:00Z",
      }),
    ).toBeNull();
    expect(threadStatus({ ...base, state: "awaiting_athlete" })).toBe(
      "question",
    );
    expect(
      threadStatus({ ...base, state: "idle", proposalStatuses: ["ready"] }),
    ).toBe("proposal");
    expect(
      threadStatus({ ...base, state: "idle", proposalStatuses: ["applied"] }),
    ).toBe("applied");
    expect(threadStatus({ ...base, state: "budget_reached" })).toBe("closed");
  });

  it("groups rows and keeps unread state", () => {
    const sections = conversationSections(
      [
        {
          id: "a",
          title: "Genou",
          lastActivityAt: "2026-10-16T12:09:00Z",
          readAt: null,
          state: "awaiting_athlete",
          lastTurnAt: null,
          preview: "Question",
          participants: ["coach", "medical"],
          proposalStatuses: [],
        },
        {
          id: "b",
          title: "Plan",
          lastActivityAt: "2026-10-15T08:00:00Z",
          readAt: "2026-10-15T09:00:00Z",
          state: "idle",
          lastTurnAt: null,
          preview: "",
          participants: ["coach"],
          proposalStatuses: ["applied"],
        },
        {
          id: "c",
          title: "Vieux",
          lastActivityAt: "2026-09-28T08:00:00Z",
          readAt: "2026-09-28T09:00:00Z",
          state: "idle",
          lastTurnAt: null,
          preview: "",
          participants: ["coach"],
          proposalStatuses: [],
        },
      ],
      now,
      tz,
    );
    expect(sections.map((section) => section.label)).toEqual([
      "En cours",
      "Cette semaine",
      "Plus ancien",
    ]);
    expect(sections[0].rows[0]).toMatchObject({
      date: "14:09",
      unread: true,
      status: "question",
    });
    expect(sections[1].rows[0]).toMatchObject({
      date: "Hier",
      unread: false,
      status: "applied",
    });
    expect(sections[2].rows[0].date).toBe("28/09/2026");
  });

  it("formats French dates", () => {
    expect(listDateLabel("2026-10-12T08:00:00Z", now, tz)).toBe("lun.");
    expect(dayLabel("2026-10-16T08:00:00Z", now, tz)).toBe(
      "Aujourd’hui · ven. 16 oct.",
    );
  });

  it("summarizes participants, reads, preview and timeline for Suivi", () => {
    expect(threadParticipants(consultDone)).toEqual(["coach", "medical"]);
    expect(participantsLine(["coach", "medical"])).toBe("Claire, avec Inès");
    expect(staffReads(consultDone)).toEqual([
      "Signalements · 14 jours",
      "Profil et contexte",
    ]);
    expect(threadPreview(consultDone)).toBe(
      "Ton genou te gêne-t-il en descente ?",
    );
    expect(suiviParticipants(consultDone)).toEqual([
      { agent: "coach", role: "Coach · mène", messages: 0 },
      { agent: "medical", role: "Médecin · consultée", messages: 1 },
    ]);
    const steps = suiviTimeline({
      items: consultDone,
      status: "question",
      pendingToolUseId: "sevt_ask",
      proposalStatuses: {},
      timeZone: tz,
    });
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Ta demande", "done"],
      ["Réponse de Claire", "done"],
      ["Claire consulte Inès", "done"],
      ["Question d’Inès", "pending"],
    ]);
  });
});

describe("staff and reads", () => {
  it("maps Managed Agents names to staff", () => {
    expect(agentOfManagedName("Stride Medical")).toBe("medical");
    expect(agentOfManagedName("Other")).toBeNull();
  });

  it("labels the data the staff read", () => {
    expect(readLabel("custom", "read_health_reports", { days: 7 })).toBe(
      "Signalements · 7 jours",
    );
    expect(readLabel("custom", "ask_athlete", {})).toBeNull();
    expect(readLabel("garmin", "get_sleep_data", {})).toBe("Garmin · Sommeil");
  });

  it("crops small portraits on the face", () => {
    expect(portraitCrop(36)).toEqual({ scale: 1.8, originY: "7.3%" });
    expect(portraitCrop(96)).toEqual({ scale: 1.3, originY: "0%" });
    expect(portraitCrop(168)).toBeNull();
  });
});

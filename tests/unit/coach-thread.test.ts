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
import {
  portraitCrop,
  portraitFrame,
  portraitSourceSize,
} from "../../src/features/coach/portrait-crop";
import { readLabel } from "../../src/features/coach/reads";
import {
  agentOfManagedName,
  defaultStaff,
  staffFaceChoiceSchema,
  staffFacesOf,
  staffOf,
} from "../../src/features/coach/staff";
import {
  buildThread,
  questionAttribution,
  replyToLabel,
  splitMentions,
  typingLabel,
} from "../../src/features/coach/thread";

const at = (minute: number) =>
  `2026-10-16T12:${String(minute).padStart(2, "0")}:00Z`;
const tz = "Europe/Paris";
const proposalId = "d0000000-0000-4000-8000-00000000000d";

const consultTurn: ThreadItem[] = [
  {
    kind: "athlete",
    at: at(0),
    text: "J’ai mal au genou",
    consult: "medical",
    attachments: [],
  },
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

const options = ["Aucune gêne", "Gêne légère", "Douleur qui m’arrête"];

const consultDone: ThreadItem[] = [
  ...consultTurn,
  {
    kind: "question",
    at: at(3),
    toolUseId: "sevt_ask",
    question: "Comment réagit ton genou en descente ?",
    options,
    askedFor: "medical",
  },
];

const answered: ThreadItem[] = [
  ...consultDone,
  { kind: "answer", at: at(5), toolUseId: "sevt_ask", text: "Aucune gêne" },
  {
    kind: "read",
    at: at(5),
    thread: "sthr_m",
    agent: "medical",
    tool: "read_athlete_context",
    label: "Profil et contexte",
  },
  {
    kind: "consult_reply",
    at: at(6),
    thread: "sthr_m",
    agent: "medical",
    text: "@Jules Alors c’est compatible.",
  },
  { kind: "consult_end", at: at(6), thread: "sthr_m", agent: "medical" },
  { kind: "coach", at: at(7), text: "On garde le plan." },
];

function view(
  items: ThreadItem[],
  live = false,
  pending: string | null = null,
) {
  return buildThread({ items, live, pendingToolUseId: pending });
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
  it("shows the Coach hand-off and the specialist typing while it works", () => {
    const entries = view(consultTurn, true);
    expect(entries.map((entry) => entry.type)).toEqual([
      "athlete",
      "staff",
      "typing",
    ]);
    expect(entries[1]).toMatchObject({
      agent: "coach",
      blocks: [{ type: "text", text: "Je demande à Inès." }],
    });
    expect(entries[2]).toMatchObject({
      agent: "medical",
      read: "Signalements · 14 jours",
    });
    expect(typingLabel(defaultStaff.medical, "Signalements · 14 jours")).toBe(
      "Inès lit signalements · 14 jours…",
    );
    expect(typingLabel(defaultStaff.medical, null)).toBe("Inès écrit…");
  });

  it("never shows the brief between agents or a typing entry once reloaded", () => {
    const entries = view(consultTurn);
    expect(entries.map((entry) => entry.type)).toEqual(["athlete", "staff"]);
    expect(JSON.stringify(entries)).not.toContain("Knee pain?");
  });

  it("shows a specialist question with its options under the specialist’s name", () => {
    const entries = view(consultDone, true, "sevt_ask");
    expect(entries.map((entry) => entry.type)).toEqual([
      "athlete",
      "staff",
      "staff",
    ]);
    expect(entries[2]).toMatchObject({
      agent: "medical",
      reads: ["Signalements · 14 jours"],
      blocks: [
        {
          type: "question",
          options,
          askedFor: "medical",
          state: "pending",
          answer: null,
        },
      ],
    });
    expect(questionAttribution(defaultStaff.medical)).toBe("Question d’Inès");
    expect(questionAttribution(defaultStaff.coach)).toBe("Question de Claire");
  });

  it("routes the answer to the specialist and shows its reply as its own message", () => {
    const entries = view(answered);
    expect(entries.map((entry) => entry.type)).toEqual([
      "athlete",
      "staff",
      "staff",
      "athlete",
      "staff",
      "staff",
    ]);
    expect(entries[0]).toMatchObject({ consult: "medical", replyTo: null });
    expect(entries[2]).toMatchObject({
      blocks: [{ state: "answered", answer: "Aucune gêne", answeredAt: at(5) }],
    });
    expect(entries[3]).toMatchObject({
      replyTo: "medical",
      text: "Aucune gêne",
    });
    expect(replyToLabel(defaultStaff.medical)).toBe("En réponse à Inès");
    expect(entries[4]).toMatchObject({
      agent: "medical",
      reads: ["Profil et contexte"],
      blocks: [{ type: "text", text: "@Jules Alors c’est compatible." }],
    });
    expect(entries[5]).toMatchObject({
      agent: "coach",
      blocks: [{ type: "text", text: "On garde le plan." }],
    });
  });

  it("shows a specialist's message to the athlete and hides its report to the coach", () => {
    const items: ThreadItem[] = [
      ...answered.slice(0, -3),
      {
        kind: "staff_message",
        at: at(6),
        thread: "sthr_m",
        agent: "medical",
        text: "@Jules Tu peux courir à plat.",
      },
      {
        kind: "consult_reply",
        at: at(6),
        thread: "sthr_m",
        agent: "medical",
        text: "Limites : pas de descente jusqu’au 31/10.",
      },
      { kind: "consult_end", at: at(6), thread: "sthr_m", agent: "medical" },
    ];
    const entries = view(items, true);
    expect(entries.at(-1)).toMatchObject({
      type: "staff",
      agent: "medical",
      blocks: [{ type: "text", text: "@Jules Tu peux courir à plat." }],
    });
    expect(JSON.stringify(entries)).not.toContain("Limites");
    expect(threadPreview(defaultStaff, items)).toBe(
      "Inès : @Jules Tu peux courir à plat.",
    );
    expect(suiviParticipants(defaultStaff, items)[1]).toMatchObject({
      messages: 2,
    });
    expect(
      suiviTimeline({
        staff: defaultStaff,
        items,
        status: null,
        pendingToolUseId: null,
        proposalStatuses: {},
        timeZone: tz,
      }).filter((step) => step.label === "Réponse d’Inès"),
    ).toHaveLength(1);
  });

  it("reads old athlete rows without attachments and keeps sent ones", () => {
    expect(
      parseThreadItem({
        kind: "athlete",
        body: { text: "Salut", consult: null },
        created_at: at(0),
      }),
    ).toMatchObject({ attachments: [] });
    const attachments = [
      {
        kind: "race" as const,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "Trail des Lacs",
        date: "2027-06-27",
      },
    ];
    const parsed = parseThreadItem({
      kind: "athlete",
      body: { text: "Analyse ça", consult: null, attachments },
      created_at: at(0),
    });
    expect(parsed).toMatchObject({ attachments });
    expect(view([parsed!])[0]).toMatchObject({
      type: "athlete",
      attachments,
    });
  });

  it("keeps old stored questions without options readable", () => {
    const parsed = parseThreadItem({
      kind: "question",
      body: {
        toolUseId: "sevt_old",
        question: "Tu as mal ?",
        askedFor: "coach",
      },
      created_at: at(0),
    });
    expect(parsed).toMatchObject({ options: [] });
  });

  it("does not answer for the Coach when the Coach asked", () => {
    const entries = view([
      {
        kind: "athlete",
        at: at(0),
        text: "Plan ?",
        consult: null,
        attachments: [],
      },
      {
        kind: "question",
        at: at(1),
        toolUseId: "sevt_c",
        question: "Combien de séances ?",
        options: [],
        askedFor: "coach",
      },
      { kind: "answer", at: at(2), toolUseId: "sevt_c", text: "Quatre" },
    ]);
    expect(entries[2]).toMatchObject({ type: "athlete", replyTo: null });
  });

  it("closes an unanswered question that is no longer pending", () => {
    expect(view(consultDone).at(-1)).toMatchObject({
      blocks: [{ state: "closed" }],
    });
  });

  it("splits mentions out of message text", () => {
    expect(splitMentions("@Inès, tu vois avec @Jules ?")).toEqual([
      "",
      "@Inès",
      ", tu vois avec ",
      "@Jules",
      " ?",
    ]);
  });

  it("shows a proposal card with its stored status", () => {
    const items: ThreadItem[] = [
      {
        kind: "athlete",
        at: at(0),
        text: "Fais-moi un plan",
        consult: null,
        attachments: [],
      },
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

  it("shows a turn error inside a Coach message", () => {
    const entries = view([
      {
        kind: "athlete",
        at: at(0),
        text: "Salut",
        consult: null,
        attachments: [],
      },
      { kind: "error", at: at(1), code: "timeout", text: "Trop long" },
    ]);
    expect(entries[1]).toMatchObject({
      agent: "coach",
      blocks: [{ type: "error", text: "Trop long" }],
    });
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
    expect(participantsLine(defaultStaff, ["coach", "medical"])).toBe(
      "Claire, avec Inès",
    );
    expect(staffReads(consultDone)).toEqual([
      "Signalements · 14 jours",
      "Profil et contexte",
    ]);
    expect(threadPreview(defaultStaff, consultDone)).toBe(
      "Comment réagit ton genou en descente ?",
    );
    expect(threadPreview(defaultStaff, answered.slice(0, -1))).toBe(
      "Inès : @Jules Alors c’est compatible.",
    );
    expect(suiviParticipants(defaultStaff, answered)).toEqual([
      { agent: "coach", role: "Coach · mène", messages: 0 },
      { agent: "medical", role: "Médecin · mentionnée", messages: 2 },
    ]);
    const steps = suiviTimeline({
      staff: defaultStaff,
      items: consultDone,
      status: "question",
      pendingToolUseId: "sevt_ask",
      proposalStatuses: {},
      timeZone: tz,
    });
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Ta demande", "done"],
      ["Réponse de Claire", "done"],
      ["Claire passe la main à Inès", "done"],
      ["Question d’Inès", "current"],
      ["Réponse d’Inès", "upcoming"],
    ]);
  });

  it("follows every turn of the thread in Déroulé", () => {
    const items: ThreadItem[] = [
      ...consultDone,
      { kind: "answer", at: at(5), toolUseId: "sevt_ask", text: "Non" },
      { kind: "coach", at: at(6), text: "Je relance Inès." },
      {
        kind: "consult_request",
        at: at(6),
        thread: "sthr_m",
        agent: "medical",
        text: "No downhill pain.",
      },
      {
        kind: "consult_reply",
        at: at(7),
        thread: "sthr_m",
        agent: "medical",
        text: "Fine.",
      },
      { kind: "coach", at: at(8), text: "**Verdict** : on continue." },
      {
        kind: "proposal",
        at: at(9),
        proposalId,
        scope: "session",
        title: "Séance allégée",
        summary: null,
        opinions: [],
      },
    ];
    const timeline = (
      status: "working" | "proposal" | null,
      decided?: string,
    ) =>
      suiviTimeline({
        staff: defaultStaff,
        items,
        status,
        pendingToolUseId: null,
        proposalStatuses: decided ? { [proposalId]: decided } : {},
        timeZone: tz,
      }).map((step) => [step.label, step.state]);
    expect(timeline("proposal")).toEqual([
      ["Ta demande", "done"],
      ["Réponse de Claire", "done"],
      ["Claire passe la main à Inès", "done"],
      ["Question d’Inès", "done"],
      ["Ta réponse à Inès", "done"],
      ["Claire passe la main à Inès", "done"],
      ["Réponse d’Inès", "done"],
      ["Réponse de Claire", "done"],
      ["Proposition du staff", "done"],
      ["À toi de décider", "current"],
    ]);
    expect(timeline(null, "applied").at(-1)).toEqual([
      "Ta décision",
      "current",
    ]);
    const last = suiviTimeline({
      staff: defaultStaff,
      items,
      status: null,
      pendingToolUseId: null,
      proposalStatuses: { [proposalId]: "applied" },
      timeZone: tz,
    }).at(-1);
    expect(last).toMatchObject({ tone: "neutral", hint: "Dernière étape" });
    const working = timeline("working", "applied");
    expect(working.slice(-3)).toEqual([
      ["Ta décision", "done"],
      ["Le staff travaille", "current"],
      ["Réponse de Claire", "upcoming"],
    ]);
    expect(working.filter(([, state]) => state === "current")).toHaveLength(1);
    expect(threadPreview(defaultStaff, items.slice(0, -1))).toBe(
      "Claire : Verdict : on continue.",
    );
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
    expect(portraitCrop(36)).toEqual({ scale: 1.8, originY: 0.073 });
    expect(portraitCrop(96)).toEqual({ scale: 1.3, originY: 0 });
    expect(portraitCrop(168)).toBeNull();
    expect(portraitSourceSize(36)).toBe(65);
    expect(portraitSourceSize(96)).toBe(125);
    expect(portraitSourceSize(168)).toBe(168);
    expect(portraitFrame(50)).toEqual({
      width: 90,
      height: 90,
      left: -20,
      top: -2.92,
    });
    expect(portraitFrame(100)).toEqual({
      width: 130,
      height: 130,
      left: -15,
      top: -0,
    });
    expect(portraitFrame(168)).toBeNull();
  });
});

describe("staff faces", () => {
  const swapped = staffOf({
    coach: "thomas",
    medical: "karim",
    director: "sophie",
    strategist: "nadia",
    nutritionist: "yanis",
  });
  const defaults = {
    coach: "claire",
    medical: "ines",
    director: "marc",
    strategist: "hugo",
    nutritionist: "lea",
  };

  it("defaults to the board faces and ignores unknown stored faces", () => {
    expect(staffFacesOf(null)).toEqual(defaults);
    expect(
      staffFacesOf({
        coach_face: "marc",
        medical_face: "karim",
        strategist_face: "nadia",
        nutritionist_face: "ines",
      }),
    ).toEqual({ ...defaults, medical: "karim", strategist: "nadia" });
  });

  it("changes names, alt text and grammar but never the role", () => {
    expect(swapped.coach).toMatchObject({
      name: "Thomas",
      role: "Coach",
      alt: "Thomas, coach",
      pronoun: "Il",
    });
    expect(swapped.medical).toMatchObject({
      name: "Karim",
      role: "Médecin",
      consulted: "consulté",
    });
    expect(swapped.director).toMatchObject({
      name: "Sophie",
      role: "Directeur sportif",
      consulted: "consultée",
    });
    expect(questionAttribution(swapped.medical)).toBe("Question de Karim");
    expect(participantsLine(swapped, ["coach", "medical"])).toBe(
      "Thomas, avec Karim",
    );
  });

  it("only accepts a face that belongs to the role", () => {
    expect(
      staffFaceChoiceSchema.safeParse({ agent: "coach", face: "thomas" })
        .success,
    ).toBe(true);
    expect(
      staffFaceChoiceSchema.safeParse({ agent: "coach", face: "karim" })
        .success,
    ).toBe(false);
    expect(
      staffFaceChoiceSchema.safeParse({ agent: "nutritionist", face: "lea" })
        .success,
    ).toBe(true);
    expect(
      staffFaceChoiceSchema.safeParse({ agent: "director", face: "hugo" })
        .success,
    ).toBe(false);
  });
});

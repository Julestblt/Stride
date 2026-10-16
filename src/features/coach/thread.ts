import type { ItemOf, ProposalOpinion, ThreadItem } from "./items";
import type { StaffAgent, StaffMember } from "./staff";

export type ConsultStep = {
  from: StaffAgent;
  to: StaffAgent | null;
  text: string;
};

export type ConsultView = {
  agent: StaffAgent;
  thread: string;
  state: "working" | "replied" | "asked";
  steps: ConsultStep[];
  reads: string[];
  summary: string;
};

export type ProposalCardStatus =
  "pending" | "applying" | "applied" | "rejected" | "closed";

export type QuestionState = "pending" | "answered" | "closed";

export type CoachBlock =
  | { type: "text"; text: string }
  | { type: "consult"; key: string; live: boolean; consults: ConsultView[] }
  | {
      type: "question";
      toolUseId: string;
      question: string;
      askedFor: StaffAgent;
      state: QuestionState;
      answeredAt: string | null;
    }
  | {
      type: "proposal";
      proposalId: string;
      scope: "new_plan" | "session";
      title: string;
      summary: string | null;
      opinions: ProposalOpinion[];
      status: ProposalCardStatus;
    }
  | { type: "error"; text: string };

export type ThreadEntry =
  | {
      type: "athlete";
      key: string;
      at: string;
      text: string;
      consult: StaffAgent | null;
      answer: boolean;
    }
  | { type: "coach"; key: string; at: string; blocks: CoachBlock[] };

export type ThreadInput = {
  items: readonly ThreadItem[];
  live: boolean;
  pendingToolUseId: string | null;
  proposalStatuses?: Readonly<Record<string, string>>;
};

const consultKinds = new Set([
  "consult_request",
  "consult_reply",
  "consult_note",
  "consult_end",
]);

type ConsultItem =
  | ItemOf<"consult_request">
  | ItemOf<"consult_reply">
  | ItemOf<"consult_note">
  | ItemOf<"consult_end">
  | ItemOf<"read">;

function isConsultItem(item: ThreadItem): item is ConsultItem {
  return (
    consultKinds.has(item.kind) ||
    (item.kind === "read" && item.agent !== "coach")
  );
}

export function proposalCardStatus(status: string | undefined) {
  switch (status) {
    case undefined:
    case "draft":
    case "ready":
      return "pending";
    case "accepted":
      return "applying";
    case "applied":
      return "applied";
    case "rejected":
      return "rejected";
    default:
      return "closed";
  }
}

function consultSummary(consult: Omit<ConsultView, "summary">) {
  if (consult.state === "asked") return "Question pour toi";
  if (consult.state === "replied") return "Avis rendu";
  const read = consult.reads.at(-1);
  return read ? `Lit ${read.toLowerCase()}…` : "Analyse en cours…";
}

function foldConsults(
  items: readonly ConsultItem[],
  live: boolean,
): { consults: ConsultView[]; live: boolean } {
  const byThread = new Map<string, Omit<ConsultView, "summary">>();
  const ended = new Set<string>();
  for (const item of items) {
    const consult = byThread.get(item.thread) ?? {
      agent: item.agent,
      thread: item.thread,
      state: "working" as const,
      steps: [],
      reads: [],
    };
    byThread.set(item.thread, consult);
    if (item.kind === "consult_request")
      consult.steps.push({ from: "coach", to: item.agent, text: item.text });
    if (item.kind === "consult_reply") {
      consult.steps.push({ from: item.agent, to: "coach", text: item.text });
      consult.state = "replied";
    }
    if (item.kind === "consult_note")
      consult.steps.push({ from: item.agent, to: null, text: item.text });
    if (item.kind === "read" && !consult.reads.includes(item.label))
      consult.reads.push(item.label);
    if (item.kind === "consult_end") ended.add(item.thread);
  }
  const consults = [...byThread.values()].map((consult) => {
    const state: ConsultView["state"] =
      consult.state === "replied" || ended.has(consult.thread) || !live
        ? "replied"
        : "working";
    return {
      ...consult,
      state,
      summary: consultSummary({ ...consult, state }),
    };
  });
  return {
    consults,
    live: live && consults.some((consult) => consult.state === "working"),
  };
}

export function buildThread(input: ThreadInput): ThreadEntry[] {
  const answers = new Map(
    input.items.flatMap((item) =>
      item.kind === "answer" ? [[item.toolUseId, item.at] as const] : [],
    ),
  );
  const entries: ThreadEntry[] = [];
  let coach: Extract<ThreadEntry, { type: "coach" }> | null = null;
  type PendingConsult = { index: number; items: ConsultItem[] };
  let pending: PendingConsult[] = [];
  let open: PendingConsult | null = null;
  let byThread = new Map<string, PendingConsult>();

  function finishEntry(live: boolean) {
    if (coach)
      for (const block of pending) {
        const folded = foldConsults(block.items, live);
        coach.blocks[block.index] = {
          type: "consult",
          key: `${coach.key}-${block.index}`,
          live: folded.live,
          consults: folded.consults,
        };
      }
    pending = [];
    open = null;
    byThread = new Map();
  }

  input.items.forEach((item, index) => {
    if (item.kind === "athlete" || item.kind === "answer") {
      finishEntry(false);
      coach = null;
      entries.push({
        type: "athlete",
        key: `athlete-${index}`,
        at: item.at,
        text: item.text,
        consult: item.kind === "athlete" ? item.consult : null,
        answer: item.kind === "answer",
      });
      return;
    }
    if (item.kind === "read" && item.agent === "coach") return;
    if (!coach) {
      coach = { type: "coach", key: `coach-${index}`, at: item.at, blocks: [] };
      entries.push(coach);
    }
    if (isConsultItem(item)) {
      let block = byThread.get(item.thread) ?? open;
      if (!block) {
        block = { index: coach.blocks.length, items: [] };
        coach.blocks.push({ type: "text", text: "" });
        pending.push(block);
      }
      block.items.push(item);
      byThread.set(item.thread, block);
      open = block;
      return;
    }
    if (item.kind === "coach") {
      open = null;
      if (item.text.trim())
        coach.blocks.push({ type: "text", text: item.text });
      return;
    }
    if (item.kind === "question") {
      const answeredAt = answers.get(item.toolUseId) ?? null;
      coach.blocks.push({
        type: "question",
        toolUseId: item.toolUseId,
        question: item.question,
        askedFor: item.askedFor,
        state: answeredAt
          ? "answered"
          : item.toolUseId === input.pendingToolUseId
            ? "pending"
            : "closed",
        answeredAt,
      });
      return;
    }
    if (item.kind === "proposal") {
      coach.blocks.push({
        type: "proposal",
        proposalId: item.proposalId,
        scope: item.scope,
        title: item.title,
        summary: item.summary,
        opinions: item.opinions,
        status: proposalCardStatus(input.proposalStatuses?.[item.proposalId]),
      });
      return;
    }
    if (item.kind === "error")
      coach.blocks.push({ type: "error", text: item.text });
  });
  finishEntry(input.live);
  for (const entry of entries)
    if (entry.type === "coach") linkQuestions(entry.blocks);
  return entries;
}

function linkQuestions(blocks: CoachBlock[]) {
  blocks.forEach((block, index) => {
    if (block.type !== "question") return;
    for (const earlier of blocks.slice(0, index).reverse()) {
      if (earlier.type !== "consult") continue;
      const consult = earlier.consults.findLast(
        (item) => item.agent === block.askedFor,
      );
      if (!consult) continue;
      consult.state = "asked";
      consult.summary = consultSummary(consult);
      earlier.live =
        earlier.live &&
        earlier.consults.some((item) => item.state === "working");
      return;
    }
  });
}

export function consultHeadline(consults: readonly ConsultView[]) {
  const count = consults.length;
  return count === 1 ? "1 avis" : `${count} avis`;
}

export function ofName({ name }: StaffMember) {
  return /^[aeiouyàâéèêëîïôûùh]/i.test(name) ? `d’${name}` : `de ${name}`;
}

export function questionAttribution(member: StaffMember) {
  return `Question ${ofName(member)}`;
}

export function askedByLabel(member: StaffMember) {
  return `Demandée par ${member.name}`;
}

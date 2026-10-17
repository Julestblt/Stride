import type { ProposalOpinion, ThreadItem } from "./items";
import type { StaffAgent, StaffMember } from "./staff";

export type ProposalCardStatus =
  "pending" | "applying" | "applied" | "rejected" | "closed";

export type QuestionState = "pending" | "answered" | "closed";

export type StaffBlock =
  | { type: "text"; text: string }
  | {
      type: "question";
      toolUseId: string;
      question: string;
      options: string[];
      askedFor: StaffAgent;
      state: QuestionState;
      answer: string | null;
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
      replyTo: StaffAgent | null;
    }
  | {
      type: "staff";
      key: string;
      at: string;
      agent: StaffAgent;
      blocks: StaffBlock[];
      reads: string[];
    }
  | {
      type: "typing";
      key: string;
      at: string;
      agent: StaffAgent;
      read: string | null;
    };

export type ThreadInput = {
  items: readonly ThreadItem[];
  live: boolean;
  pendingToolUseId: string | null;
  proposalStatuses?: Readonly<Record<string, string>>;
};

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

type Handoff = {
  agent: StaffAgent;
  at: string;
  reads: string[];
  done: boolean;
  spoke: boolean;
};

export function buildThread(input: ThreadInput): ThreadEntry[] {
  const answers = new Map(
    input.items.flatMap((item) =>
      item.kind === "answer" ? [[item.toolUseId, item] as const] : [],
    ),
  );
  const askedFor = new Map(
    input.items.flatMap((item) =>
      item.kind === "question"
        ? [[item.toolUseId, item.askedFor] as const]
        : [],
    ),
  );
  const entries: ThreadEntry[] = [];
  let current: Extract<ThreadEntry, { type: "staff" }> | null = null;
  let handoffs = new Map<string, Handoff>();

  function speak(agent: StaffAgent, at: string, index: number) {
    if (!current || current.agent !== agent) {
      current = {
        type: "staff",
        key: `staff-${index}`,
        at,
        agent,
        blocks: [],
        reads: [],
      };
      entries.push(current);
    }
    if (agent !== "coach")
      for (const handoff of handoffs.values())
        if (handoff.agent === agent)
          for (const read of handoff.reads.splice(0))
            if (!current.reads.includes(read)) current.reads.push(read);
    return current;
  }

  function handoffOf(thread: string, agent: StaffAgent, at: string) {
    const handoff = handoffs.get(thread) ?? {
      agent,
      at,
      reads: [],
      done: false,
      spoke: false,
    };
    handoffs.set(thread, handoff);
    return handoff;
  }

  input.items.forEach((item, index) => {
    switch (item.kind) {
      case "athlete":
      case "answer": {
        current = null;
        if (item.kind === "athlete") handoffs = new Map();
        const target =
          item.kind === "answer"
            ? (askedFor.get(item.toolUseId) ?? null)
            : null;
        entries.push({
          type: "athlete",
          key: `athlete-${index}`,
          at: item.at,
          text: item.text,
          consult: item.kind === "athlete" ? item.consult : null,
          replyTo: target === "coach" ? null : target,
        });
        return;
      }
      case "coach":
        if (item.text.trim())
          speak("coach", item.at, index).blocks.push({
            type: "text",
            text: item.text,
          });
        return;
      case "consult_request": {
        const handoff = handoffOf(item.thread, item.agent, item.at);
        handoff.done = false;
        handoff.spoke = false;
        return;
      }
      case "staff_message": {
        const handoff = handoffOf(item.thread, item.agent, item.at);
        handoff.done = true;
        handoff.spoke = true;
        speak(item.agent, item.at, index).blocks.push({
          type: "text",
          text: item.text,
        });
        return;
      }
      case "read":
        if (item.agent !== "coach") {
          const handoff = handoffOf(item.thread, item.agent, item.at);
          if (!handoff.reads.includes(item.label))
            handoff.reads.push(item.label);
        }
        return;
      case "consult_note":
        return;
      case "consult_reply": {
        const handoff = handoffOf(item.thread, item.agent, item.at);
        handoff.done = true;
        if (!handoff.spoke && item.text.trim())
          speak(item.agent, item.at, index).blocks.push({
            type: "text",
            text: item.text,
          });
        return;
      }
      case "consult_end":
        handoffOf(item.thread, item.agent, item.at).done = true;
        return;
      case "question": {
        const answer = answers.get(item.toolUseId) ?? null;
        speak(item.askedFor, item.at, index).blocks.push({
          type: "question",
          toolUseId: item.toolUseId,
          question: item.question,
          options: item.options,
          askedFor: item.askedFor,
          state: answer
            ? "answered"
            : item.toolUseId === input.pendingToolUseId
              ? "pending"
              : "closed",
          answer: answer?.text ?? null,
          answeredAt: answer?.at ?? null,
        });
        return;
      }
      case "proposal":
        speak("coach", item.at, index).blocks.push({
          type: "proposal",
          proposalId: item.proposalId,
          scope: item.scope,
          title: item.title,
          summary: item.summary,
          opinions: item.opinions,
          status: proposalCardStatus(input.proposalStatuses?.[item.proposalId]),
        });
        return;
      case "error":
        speak("coach", item.at, index).blocks.push({
          type: "error",
          text: item.text,
        });
        return;
    }
  });

  if (input.live && !input.pendingToolUseId)
    for (const [thread, handoff] of handoffs)
      if (!handoff.done)
        entries.push({
          type: "typing",
          key: `typing-${thread}`,
          at: handoff.at,
          agent: handoff.agent,
          read: handoff.reads.at(-1) ?? null,
        });
  return entries;
}

export function typingLabel(member: StaffMember, read: string | null) {
  return read
    ? `${member.name} lit ${read.toLowerCase()}…`
    : `${member.name} écrit…`;
}

export function ofName({ name }: StaffMember) {
  return /^[aeiouyàâéèêëîïôûùh]/i.test(name) ? `d’${name}` : `de ${name}`;
}

export function questionAttribution(member: StaffMember) {
  return `Question ${ofName(member)}`;
}

export function replyToLabel(member: StaffMember) {
  return `En réponse à ${member.name}`;
}

export function splitMentions(text: string) {
  return text.split(/(@[\p{Lu}][\p{L}’'-]*)/u);
}

import type { ThreadItem } from "./items";
import { markdownPlainText } from "./markdown";
import { staffJoin, type Staff, type StaffAgent } from "./staff";
import { ofName, proposalCardStatus } from "./thread";

export const turnStaleMs = 15 * 60 * 1000;

export type SessionState =
  | "running"
  | "idle"
  | "awaiting_athlete"
  | "budget_reached"
  | "timed_out"
  | "failed"
  | "terminated";

export type ThreadStatus =
  "working" | "question" | "proposal" | "applied" | "closed" | null;

export const closedStates: readonly SessionState[] = [
  "budget_reached",
  "failed",
  "terminated",
];

export const statusLabels: Record<
  Exclude<ThreadStatus, null>,
  { label: string; tone: "accent" | "warning" | "success" | "muted" }
> = {
  working: { label: "Le staff travaille", tone: "accent" },
  question: { label: "Question pour toi", tone: "warning" },
  proposal: { label: "Proposition à valider", tone: "warning" },
  applied: { label: "Appliqué", tone: "success" },
  closed: { label: "Terminée", tone: "muted" },
};

export function threadTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nouvelle conversation";
  const sentence = /^(.{12,60}?)[.!?…](\s|$)/u.exec(clean);
  if (sentence) return sentence[1].trim();
  if (clean.length <= 60) return clean;
  const cut = clean.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export function threadStatus(input: {
  state: SessionState;
  lastTurnAt: string | null;
  now: Date;
  proposalStatuses: readonly string[];
}): ThreadStatus {
  if (
    input.state === "running" &&
    input.lastTurnAt !== null &&
    input.now.getTime() - Date.parse(input.lastTurnAt) < turnStaleMs
  )
    return "working";
  if (input.state === "awaiting_athlete") return "question";
  const cards = input.proposalStatuses.map((status) =>
    proposalCardStatus(status),
  );
  if (cards.includes("pending")) return "proposal";
  if (closedStates.includes(input.state)) return "closed";
  if (cards.includes("applied")) return "applied";
  return null;
}

export function staffMessages(items: readonly ThreadItem[]) {
  const spoke = new Set<string>();
  const shown: ThreadItem[] = [];
  for (const item of items) {
    if (item.kind === "consult_request") spoke.delete(item.thread);
    if (item.kind === "staff_message") {
      spoke.add(item.thread);
      shown.push(item);
    }
    if (item.kind === "consult_reply" && !spoke.has(item.thread))
      shown.push(item);
  }
  return new Set(shown);
}

export function threadParticipants(items: readonly ThreadItem[]) {
  const agents: StaffAgent[] = ["coach"];
  for (const item of items) {
    const agent =
      item.kind === "consult_request" ||
      item.kind === "consult_reply" ||
      item.kind === "staff_message" ||
      item.kind === "read"
        ? item.agent
        : item.kind === "question"
          ? item.askedFor
          : null;
    if (agent && !agents.includes(agent)) agents.push(agent);
  }
  return agents;
}

export function participantsLine(staff: Staff, agents: readonly StaffAgent[]) {
  const others = agents.filter((agent) => agent !== "coach");
  return others.length
    ? `${staff.coach.name}, avec ${staffJoin(staff, others)}`
    : staff.coach.name;
}

export function threadPreview(staff: Staff, items: readonly ThreadItem[]) {
  const shown = staffMessages(items);
  for (const item of [...items].reverse()) {
    if (item.kind === "coach" && item.text.trim())
      return `${staff.coach.name} : ${markdownPlainText(item.text)}`;
    if (
      (item.kind === "consult_reply" || item.kind === "staff_message") &&
      shown.has(item) &&
      item.text.trim()
    )
      return `${staff[item.agent].name} : ${markdownPlainText(item.text)}`;
    if (item.kind === "question") return item.question;
    if (item.kind === "athlete" || item.kind === "answer")
      return `Toi : ${item.text.replace(/\s+/g, " ").trim()}`;
    if (item.kind === "error") return item.text;
  }
  return "";
}

export function isUnread(lastActivityAt: string, readAt: string | null) {
  return readAt === null || Date.parse(lastActivityAt) > Date.parse(readAt);
}

const timeFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function daysBetween(from: Date, to: Date, timeZone: string) {
  return Math.round(
    (Date.parse(dayKey(to, timeZone)) - Date.parse(dayKey(from, timeZone))) /
      86_400_000,
  );
}

export function timeLabel(iso: string, timeZone: string) {
  return timeFormat(timeZone).format(new Date(iso));
}

export function listDateLabel(iso: string, now: Date, timeZone: string) {
  const date = new Date(iso);
  const days = daysBetween(date, now, timeZone);
  if (days <= 0) return timeLabel(iso, timeZone);
  if (days === 1) return "Hier";
  if (days < 7)
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      timeZone,
    }).format(date);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function dayLabel(iso: string, now: Date, timeZone: string) {
  const date = new Date(iso);
  const days = daysBetween(date, now, timeZone);
  const text = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(days > 300 ? { year: "numeric" as const } : {}),
    timeZone,
  }).format(date);
  if (days <= 0) return `Aujourd’hui · ${text}`;
  if (days === 1) return `Hier · ${text}`;
  return text;
}

export function sameDay(first: string, second: string, timeZone: string) {
  return (
    dayKey(new Date(first), timeZone) === dayKey(new Date(second), timeZone)
  );
}

export type ConversationSummary = {
  id: string;
  title: string;
  lastActivityAt: string;
  readAt: string | null;
  state: SessionState;
  lastTurnAt: string | null;
  preview: string;
  participants: StaffAgent[];
  proposalStatuses: string[];
};

export type ConversationRow = {
  id: string;
  title: string;
  preview: string;
  date: string;
  unread: boolean;
  status: ThreadStatus;
  participants: StaffAgent[];
};

export type ConversationSection = { label: string; rows: ConversationRow[] };

export function conversationSections(
  conversations: readonly ConversationSummary[],
  now: Date,
  timeZone: string,
): ConversationSection[] {
  const sections: ConversationSection[] = [
    { label: "En cours", rows: [] },
    { label: "Cette semaine", rows: [] },
    { label: "Plus ancien", rows: [] },
  ];
  for (const conversation of [...conversations].sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  )) {
    const status = threadStatus({
      state: conversation.state,
      lastTurnAt: conversation.lastTurnAt,
      now,
      proposalStatuses: conversation.proposalStatuses,
    });
    const row: ConversationRow = {
      id: conversation.id,
      title: conversation.title,
      preview: conversation.preview,
      date: listDateLabel(conversation.lastActivityAt, now, timeZone),
      unread: isUnread(conversation.lastActivityAt, conversation.readAt),
      status,
      participants: conversation.participants,
    };
    const ongoing =
      status === "working" || status === "question" || status === "proposal";
    const recent =
      daysBetween(new Date(conversation.lastActivityAt), now, timeZone) < 7;
    sections[ongoing ? 0 : recent ? 1 : 2].rows.push(row);
  }
  return sections.filter((section) => section.rows.length > 0);
}

export type SuiviCard = {
  tone: "accent" | "warning" | "success" | "muted";
  title: string;
  detail: string;
};

export function suiviCard(staff: Staff, status: ThreadStatus): SuiviCard {
  switch (status) {
    case "working":
      return {
        tone: "accent",
        title: "Le staff travaille",
        detail: `${staff.coach.name} te répond dès que la concertation est terminée.`,
      };
    case "question":
      return {
        tone: "warning",
        title: "Question pour toi",
        detail: "Le staff attend ta réponse pour continuer.",
      };
    case "proposal":
      return {
        tone: "warning",
        title: "Proposition à valider",
        detail: "Le plan ne change pas tant que tu n’as pas décidé.",
      };
    case "applied":
      return {
        tone: "success",
        title: "Proposition appliquée",
        detail: "Ton plan a été mis à jour.",
      };
    case "closed":
      return {
        tone: "muted",
        title: "Conversation terminée",
        detail: "Démarre une nouvelle conversation pour continuer.",
      };
    default:
      return {
        tone: "muted",
        title: "Rien en attente",
        detail: "Aucune décision n’attend ta réponse.",
      };
  }
}

export type SuiviParticipant = {
  agent: StaffAgent;
  role: string;
  messages: number;
};

export function suiviParticipants(
  staff: Staff,
  items: readonly ThreadItem[],
): SuiviParticipant[] {
  const shown = staffMessages(items);
  return threadParticipants(items).map((agent) => {
    const messages = items.filter((item) =>
      item.kind === "consult_reply" || item.kind === "staff_message"
        ? shown.has(item) && item.agent === agent
        : item.kind === "question" && item.askedFor === agent,
    ).length;
    return {
      agent,
      role:
        agent === "coach"
          ? `${staff.coach.role} · mène`
          : `${staff[agent].role} · ${staff[agent].mentioned}`,
      messages,
    };
  });
}

export function messagesLabel(count: number) {
  if (count === 0) return "";
  return count === 1 ? "1 message" : `${count} messages`;
}

export type TimelineStep = {
  key: string;
  label: string;
  detail: string | null;
  at: string | null;
  state: "done" | "current" | "upcoming";
  tone: "accent" | "warning" | "neutral" | null;
  hint: string | null;
};

export function suiviTimeline(input: {
  staff: Staff;
  items: readonly ThreadItem[];
  status: ThreadStatus;
  pendingToolUseId: string | null;
  proposalStatuses: Readonly<Record<string, string>>;
  timeZone: string;
}): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const at = (iso: string) => timeLabel(iso, input.timeZone);
  const answered = new Set(
    input.items.flatMap((item) =>
      item.kind === "answer" ? [item.toolUseId] : [],
    ),
  );
  const askedFor = new Map(
    input.items.flatMap((item) =>
      item.kind === "question"
        ? [[item.toolUseId, item.askedFor] as const]
        : [],
    ),
  );
  let awaitingFrom: StaffAgent = "coach";
  const lastCoach = new Set<number>();
  let segmentCoach = -1;
  input.items.forEach((item, index) => {
    if (item.kind === "athlete" || item.kind === "answer") {
      if (segmentCoach >= 0) lastCoach.add(segmentCoach);
      segmentCoach = -1;
    }
    if (item.kind === "coach" && item.text.trim()) segmentCoach = index;
  });
  if (segmentCoach >= 0) lastCoach.add(segmentCoach);

  const done = (
    key: string,
    label: string,
    iso: string | null,
    detail: string | null = null,
  ) =>
    steps.push({
      key,
      label,
      detail,
      at: iso ? at(iso) : null,
      state: "done",
      tone: null,
      hint: null,
    });
  let awaitingAnswer = false;
  let consulted = new Set<string>();
  let replied = new Set<string>();

  input.items.forEach((item, index) => {
    const key = `step-${index}`;
    switch (item.kind) {
      case "athlete":
      case "answer": {
        consulted = new Set();
        replied = new Set();
        const target =
          item.kind === "answer" ? askedFor.get(item.toolUseId) : undefined;
        done(
          key,
          item.kind === "athlete"
            ? "Ta demande"
            : target && target !== "coach"
              ? `Ta réponse à ${input.staff[target].name}`
              : "Ta réponse",
          item.at,
        );
        break;
      }
      case "consult_request":
        if (consulted.has(item.thread)) break;
        consulted.add(item.thread);
        done(
          key,
          `${input.staff.coach.name} passe la main à ${input.staff[item.agent].name}`,
          item.at,
          input.staff[item.agent].role,
        );
        break;
      case "consult_reply":
      case "staff_message":
        if (replied.has(item.thread)) break;
        replied.add(item.thread);
        done(key, `Réponse ${ofName(input.staff[item.agent])}`, item.at);
        break;
      case "question": {
        const current =
          item.toolUseId === input.pendingToolUseId &&
          !answered.has(item.toolUseId);
        if (current) {
          awaitingAnswer = true;
          awaitingFrom = item.askedFor;
        }
        steps.push({
          key,
          label: `Question ${ofName(input.staff[item.askedFor])}`,
          detail: current ? item.question : null,
          at: at(item.at),
          state: current ? "current" : "done",
          tone: current ? "warning" : null,
          hint: null,
        });
        break;
      }
      case "coach":
        if (lastCoach.has(index))
          done(key, `Réponse ${ofName(input.staff.coach)}`, item.at);
        break;
      case "proposal": {
        const card = proposalCardStatus(
          input.proposalStatuses[item.proposalId],
        );
        done(key, "Proposition du staff", item.at, item.title);
        if (card === "pending" || card === "applying")
          steps.push({
            key: `${key}-decision`,
            label: "À toi de décider",
            detail: card === "applying" ? "Application en cours" : null,
            at: null,
            state: "current",
            tone: "warning",
            hint: null,
          });
        else
          done(
            `${key}-decision`,
            "Ta décision",
            null,
            card === "applied"
              ? "Appliquée"
              : card === "rejected"
                ? "Refusée"
                : "Plus applicable",
          );
        break;
      }
      case "error":
        done(key, "Réponse interrompue", item.at);
        break;
    }
  });
  if (input.status === "working")
    steps.push({
      key: "working",
      label: "Le staff travaille",
      detail: null,
      at: null,
      state: "current",
      tone: "accent",
      hint: null,
    });
  const current = steps.find((step) => step.state === "current");
  if (input.status === "working" || awaitingAnswer)
    steps.push({
      key: "upcoming-answer",
      label: `Réponse ${ofName(input.staff[awaitingFrom])}`,
      detail: null,
      at: null,
      state: "upcoming",
      tone: null,
      hint: null,
    });
  else if (!current && steps.length) {
    const last = steps[steps.length - 1];
    steps[steps.length - 1] = {
      ...last,
      state: "current",
      tone: "neutral",
      hint: "Dernière étape",
    };
  }
  return steps;
}

export function staffReads(items: readonly ThreadItem[]) {
  const labels: string[] = [];
  for (const item of items)
    if (item.kind === "read" && !labels.includes(item.label))
      labels.push(item.label);
  return labels;
}

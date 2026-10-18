import type { ThreadStatus } from "./conversations";
import type { ThreadItem } from "./items";

export const suggestedReplyLimit = 3;
export const suggestedReplyLength = 40;

export const suggestedReplySets = {
  start: [
    "Comment s’est passée ma semaine ?",
    "Prépare ma prochaine séance",
    "J’ai une douleur à signaler",
  ],
  afterReply: [
    "Pourquoi ?",
    "Explique-moi plus simplement",
    "Qu’est-ce que ça change cette semaine ?",
  ],
  proposal: [
    "Pourquoi ce changement ?",
    "Quel impact sur ma semaine ?",
    "Propose une autre option",
  ],
  applied: [
    "Qu’est-ce qui change cette semaine ?",
    "Comment je saurai si ça marche ?",
  ],
} as const satisfies Record<string, readonly string[]>;

const staffKinds: readonly ThreadItem["kind"][] = [
  "coach",
  "staff_message",
  "consult_reply",
  "proposal",
];

const conversationKinds: readonly ThreadItem["kind"][] = [
  ...staffKinds,
  "athlete",
  "answer",
  "question",
  "error",
];

export type SuggestedReplyState = {
  mode: "conversation" | "plan";
  busy: boolean;
  closed: boolean;
  questionPending: boolean;
  status: ThreadStatus;
  items: readonly ThreadItem[];
};

export function suggestedReplies(
  state: SuggestedReplyState,
): readonly string[] {
  if (state.busy || state.closed || state.questionPending) return [];
  if (state.status === "working" || state.status === "question") return [];
  if (state.status === "closed") return [];
  if (state.items.length === 0)
    return state.mode === "conversation" ? suggestedReplySets.start : [];
  if (state.status === "proposal") return suggestedReplySets.proposal;
  if (state.status === "applied") return suggestedReplySets.applied;
  const last = state.items.findLast((item) =>
    conversationKinds.includes(item.kind),
  );
  return last && staffKinds.includes(last.kind)
    ? suggestedReplySets.afterReply
    : [];
}

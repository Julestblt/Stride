export type CoachAttention = { questions: number; proposals: number };

function count(value: number, one: string, many: string) {
  if (value === 0) return null;
  return value === 1 ? `1 ${one}` : `${value} ${many}`;
}

export function coachAttentionLabel(attention: CoachAttention) {
  const parts = [
    count(attention.questions, "question", "questions"),
    count(attention.proposals, "proposition", "propositions"),
  ].filter(Boolean);
  return `${parts.join(" et ")} en attente`;
}

export function coachWaiting(attention: CoachAttention | null) {
  return attention ? attention.questions + attention.proposals : 0;
}

export function coachActionLabel(attention: CoachAttention | null) {
  return attention && coachWaiting(attention) > 0
    ? `Coach, ${coachAttentionLabel(attention)}`
    : "Coach";
}

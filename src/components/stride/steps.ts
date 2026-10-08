export type StepStatus = "done" | "background" | "current" | "upcoming";

export function describeProgress(statuses: readonly StepStatus[]) {
  const total = statuses.length;
  const current = statuses.indexOf("current");
  const done = statuses.filter((status) => status === "done").length;
  const position = current === -1 ? Math.min(done + 1, total) : current + 1;
  return { position, total, label: `Step ${position} of ${total}` };
}

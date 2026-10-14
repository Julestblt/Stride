import type { PlanBlock } from "./plan";

export function weekKey(weekStart: string) {
  return `w-${weekStart}`;
}

export function blockKey(kind: PlanBlock["kind"], ordinal: number) {
  return `b-${kind.replace("_", "-")}-${ordinal}`;
}

export function sessionKey(
  scheduledOn: string,
  existingKeys: Iterable<string>,
) {
  const taken = new Set(existingKeys);
  for (let slot = 1; ; slot += 1) {
    const candidate = `s-${scheduledOn}-${slot}`;
    if (!taken.has(candidate)) return candidate;
  }
}

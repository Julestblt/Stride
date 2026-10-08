export type Zone = 1 | 2 | 3 | 4 | 5;

export type SessionBlock = {
  minutes: number;
  zone: Zone;
  removed?: boolean;
};

export const zoneHeights: Record<Zone, number> = {
  1: 20,
  2: 32,
  3: 60,
  4: 88,
  5: 100,
};

export function summarizeSession(blocks: readonly SessionBlock[]) {
  const kept = blocks.filter((block) => !block.removed);
  const removed = blocks.filter((block) => block.removed);
  const minutes = (list: readonly SessionBlock[]) =>
    list.reduce((total, block) => total + Math.max(0, block.minutes), 0);
  const hardest = kept.reduce<Zone | undefined>(
    (zone, block) =>
      zone === undefined || block.zone > zone ? block.zone : zone,
    undefined,
  );
  const parts = [`${minutes(kept)} minutes`];
  if (hardest !== undefined) parts.push(`peaking in zone ${hardest}`);
  if (removed.length > 0)
    parts.push(
      `${removed.length} ${removed.length === 1 ? "block" : "blocks"} removed (${minutes(removed)} minutes)`,
    );
  return `Session shape: ${parts.join(", ")}`;
}

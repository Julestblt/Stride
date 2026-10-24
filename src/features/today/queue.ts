export function queueOrder<T extends { key: string }>(
  items: T[],
  currentKey: string | null,
) {
  const index = Math.max(
    0,
    items.findIndex((item) => item.key === currentKey),
  );
  return [...items.slice(index), ...items.slice(0, index)];
}

export function queueNext(labels: string[]) {
  if (labels.length === 0) return null;
  if (labels.length === 1)
    return `Ensuite : ${labels[0]}${labels[0] === "tes jambes" ? " ce matin" : ""}`;
  return `Ensuite : ${labels.slice(0, -1).join(", ")}, puis ${labels.at(-1)}`;
}

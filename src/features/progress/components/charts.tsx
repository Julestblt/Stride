import { cn } from "@/lib/utils";

const nightDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function nightTitle(day: string) {
  return `Nuit du ${nightDate.format(new Date(`${day}T00:00:00Z`))}`;
}

export function Legend({
  items,
}: {
  items: { label: string; swatch: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={item.swatch} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

const width = 340;

export function RangeChart({
  card,
  label,
  unfavorable,
  tone = "foreground",
  height = 90,
}: {
  card: {
    points: { day: string; value: number | null }[];
    range: { low: number; high: number } | null;
  };
  label: string;
  unfavorable: boolean;
  tone?: "foreground" | "provider" | "success";
  height?: number;
}) {
  const values = card.points.flatMap((point) =>
    point.value === null ? [] : [point.value],
  );
  const bounds = [
    ...values,
    ...(card.range ? [card.range.low, card.range.high] : []),
  ];
  const min = Math.min(...bounds);
  const max = Math.max(...bounds);
  const pad = Math.max(1, (max - min) * 0.25);
  const top = 8;
  const bottom = height - 8;
  const y = (value: number) =>
    bottom - ((value - (min - pad)) / (max - min + pad * 2)) * (bottom - top);
  const step = width / Math.max(1, card.points.length - 1);
  const segments: string[][] = [];
  card.points.forEach((point, index) => {
    if (point.value === null) return;
    const previous = card.points[index - 1];
    if (index === 0 || !previous || previous.value === null) segments.push([]);
    segments
      .at(-1)!
      .push(`${(index * step).toFixed(1)},${y(point.value).toFixed(1)}`);
  });
  const lastIndex = card.points.findLastIndex((point) => point.value !== null);
  const last = card.points[lastIndex];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={label}
    >
      {card.range && (
        <rect
          x="0"
          width={width}
          y={y(card.range.high)}
          height={Math.max(2, y(card.range.low) - y(card.range.high))}
          className="fill-surface-raised"
        />
      )}
      {segments.map((segment, index) =>
        segment.length > 1 ? (
          <polyline
            key={index}
            points={segment.join(" ")}
            fill="none"
            strokeWidth="1.8"
            strokeLinejoin="round"
            className={cn(
              tone === "foreground" && "stroke-foreground",
              tone === "provider" && "stroke-provider",
              tone === "success" && "stroke-success",
            )}
          />
        ) : null,
      )}
      {last?.value != null && (
        <circle
          cx={lastIndex * step}
          cy={y(last.value)}
          r="3.5"
          className={
            unfavorable
              ? "fill-warning"
              : tone === "foreground"
                ? "fill-foreground"
                : tone === "provider"
                  ? "fill-provider"
                  : "fill-success"
          }
        />
      )}
    </svg>
  );
}

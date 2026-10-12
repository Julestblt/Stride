import { cn } from "@/lib/utils";

const width = 130;
const height = 30;
const inset = 3;

export function sparklinePoints(values: (number | null)[]) {
  const present = values.flatMap((value, index) =>
    value === null || !Number.isFinite(value) ? [] : [{ value, index }],
  );
  if (present.length < 2) return null;
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return present
    .map(({ value, index }) => {
      const y =
        max === min
          ? height / 2
          : inset + ((max - value) / span) * (height - inset * 2);
      return `${Math.round(index * step * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  tone = "muted",
  className,
}: {
  values: (number | null)[];
  tone?: "success" | "muted" | "warning" | "danger";
  className?: string;
}) {
  const points = sparklinePoints(values);
  return (
    <svg
      data-slot="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn("h-7.5 w-32.5 overflow-visible", className)}
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={cn(
            tone === "success" && "stroke-success",
            tone === "muted" && "stroke-muted",
            tone === "warning" && "stroke-warning",
            tone === "danger" && "stroke-danger",
          )}
        />
      ) : (
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          strokeDasharray="2 4"
          className="stroke-border-strong"
        />
      )}
    </svg>
  );
}

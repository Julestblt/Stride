import { cn } from "@/lib/utils";

export type Confidence = "low" | "moderate" | "high";

const filled: Record<Confidence, number> = { low: 1, moderate: 2, high: 3 };

const labels: Record<Confidence, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export function ConfidenceMeter({
  level,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { level: Confidence }) {
  return (
    <span
      data-slot="confidence-meter"
      data-level={level}
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1.25 w-3",
              segment <= filled[level] ? "bg-foreground" : "bg-border-strong",
            )}
          />
        ))}
      </span>
      <span className="text-xs text-muted">
        <span className="sr-only">Confidence: </span>
        {labels[level]}
      </span>
    </span>
  );
}

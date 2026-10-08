import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { DirectionMark, type Direction } from "@/components/stride/marks";

export function SignalChip({
  label,
  value,
  direction,
  tone = "warning",
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  label: string;
  value: React.ReactNode;
  direction?: Direction;
  tone?: "warning" | "success" | "muted";
}) {
  return (
    <span
      data-slot="signal-chip"
      className={cn(
        "inline-flex items-center gap-2 rounded-control border border-border-strong px-2.25 py-1.25 text-meta whitespace-nowrap",
        className,
      )}
      {...props}
    >
      <MonoLabel size="micro">{label}</MonoLabel>
      <span>{value}</span>
      {direction && (
        <>
          <DirectionMark direction={direction} tone={tone} />
          <span className="sr-only">
            {direction === "flat"
              ? "steady"
              : direction === "up"
                ? "rising"
                : "falling"}
          </span>
        </>
      )}
    </span>
  );
}

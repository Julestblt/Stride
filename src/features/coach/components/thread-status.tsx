import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import { statusLabels, type ThreadStatus } from "../conversations";

const toneText = {
  accent: "text-accent",
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted-foreground",
} as const;

export function ThreadStatusLabel({
  status,
  className,
}: {
  status: ThreadStatus;
  className?: string;
}) {
  if (!status) return null;
  const { label, tone } = statusLabels[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        toneText[tone],
        className,
      )}
    >
      <PulseDot
        tone={tone === "muted" ? "foreground" : tone}
        breathing={status === "working"}
        className={cn(tone === "muted" && "bg-dim")}
      />
      {label}
    </span>
  );
}

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { DirectionMark, PulseDot } from "@/components/stride/marks";

export type SyncState =
  "importing" | "current" | "partial" | "retrying" | "expired";

const frames: Record<SyncState, string> = {
  importing: "border-border",
  current: "border-success-border",
  partial: "border-warning-border",
  retrying: "border-warning-border",
  expired: "border-danger-border bg-danger-surface",
};

function SyncMark({ state }: { state: SyncState }) {
  switch (state) {
    case "importing":
      return <PulseDot tone="provider" className="size-2" />;
    case "current":
      return (
        <CheckIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-success"
          strokeWidth={3}
        />
      );
    case "partial":
      return <DirectionMark direction="down" className="size-2.5" />;
    case "retrying":
      return <PulseDot tone="warning" breathing={false} className="size-2" />;
    case "expired":
      return (
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full border-[1.5px] border-danger"
        />
      );
  }
}

export function SyncStatus({
  state,
  progress,
  progressLabel = "Progression de l’import",
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  state: SyncState;
  progress?: number;
  progressLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      data-slot="sync-status"
      data-state={state}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-card border px-3.5 py-2.75 text-meta",
        frames[state],
        className,
      )}
      {...props}
    >
      <SyncMark state={state} />
      <span className="min-w-0 flex-1 text-pretty">{children}</span>
      {state === "importing" && progress !== undefined && (
        <Progress
          value={progress}
          aria-label={progressLabel}
          className="w-20 shrink-0"
          indicatorClassName="bg-provider after:absolute after:inset-0 after:bg-linear-to-r after:from-transparent after:via-foreground/55 after:to-transparent motion-safe:after:animate-sheen"
        />
      )}
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

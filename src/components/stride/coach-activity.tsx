import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { PulseDot, SourceMark } from "@/components/stride/marks";

export type CoachState =
  "idle" | "reading" | "watching" | "noticing" | "changed";

export function CoachActivity({
  state,
  shortcut = "⌘K",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  state: CoachState;
  shortcut?: string;
}) {
  return (
    <div
      role="status"
      data-slot="coach-activity"
      data-state={state}
      className={cn(
        "flex min-w-0 items-center gap-2 text-meta",
        (state === "idle" || state === "noticing") && "text-muted",
        state === "reading" && "flex-col items-stretch gap-1.5",
        className,
      )}
      {...props}
    >
      {state === "watching" && <PulseDot />}
      {state === "changed" && (
        <SourceMark source="estimate" className="size-1.75" />
      )}
      <span className="min-w-0">{children}</span>
      {state === "idle" && shortcut && <Kbd>{shortcut}</Kbd>}
      {state === "reading" && (
        <span
          aria-hidden="true"
          className="relative h-0.5 overflow-hidden rounded-full bg-border"
        >
          <span className="absolute inset-y-0 left-0 w-[30%] bg-linear-to-r from-transparent via-accent to-transparent motion-safe:animate-trace motion-reduce:hidden" />
        </span>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { StrideMark } from "@/components/stride/stride-mark";

export function CoachNote({
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"aside"> & { action?: React.ReactNode }) {
  return (
    <aside
      data-slot="coach-note"
      className={cn(
        "flex items-start gap-3 rounded-card border border-border bg-surface px-4.5 py-3.5 text-sm",
        className,
      )}
      {...props}
    >
      <StrideMark className="mt-0.75" />
      <div className="min-w-0 flex-1 text-pretty">{children}</div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </aside>
  );
}

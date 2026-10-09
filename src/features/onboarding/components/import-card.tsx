import { PulseDot } from "@/components/stride/marks";
import {
  importCaption,
  type ImportSummary,
} from "@/features/onboarding/shell-status";
import { cn } from "@/lib/utils";

export function ImportCard({ summary }: { summary: ImportSummary }) {
  const active = summary.phase === "preparing" || summary.phase === "importing";
  return (
    <section
      aria-label="Import depuis Garmin"
      className="mt-auto flex flex-col gap-2.5 rounded-card border border-border p-3.5"
    >
      <p className="flex items-center gap-2 text-xs font-semibold">
        {active && <PulseDot />}
        {summary.phase === "attention" || summary.phase === "unavailable" ? (
          <PulseDot tone="warning" breathing={false} />
        ) : null}
        Import depuis Garmin
      </p>
      <span
        aria-hidden="true"
        className="relative h-1 overflow-hidden rounded-mark bg-border"
      >
        {active ? (
          <>
            <span className="absolute inset-y-0 left-0 w-[30%] bg-linear-to-r from-transparent via-accent to-transparent motion-safe:animate-trace motion-reduce:hidden" />
            <span className="absolute inset-y-0 left-0 hidden w-1/3 bg-accent/60 motion-reduce:block" />
          </>
        ) : (
          <span
            className={cn(
              "absolute inset-0",
              summary.phase === "complete" ? "bg-success" : "bg-warning/60",
            )}
          />
        )}
      </span>
      <p className="text-xs text-muted-foreground">{importCaption(summary)}</p>
    </section>
  );
}

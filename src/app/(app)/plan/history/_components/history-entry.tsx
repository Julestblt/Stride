import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type { PlanHistoryEntry } from "@/features/plans/review/history";
import {
  StaffStack,
  ToneDot,
  toneText,
} from "../../_components/proposal-review";
import { ProposalLink } from "../../_components/proposal-sheet";

export function HistoryEntry({ entry }: { entry: PlanHistoryEntry }) {
  const action = entry.reviewable ? (
    <Button asChild size="md" className="max-sm:h-11 max-sm:w-full">
      <ProposalLink
        href={`/plan?proposal=${entry.id}`}
        prefetch={false}
        data-proposal-id={entry.id}
      >
        Examiner
      </ProposalLink>
    </Button>
  ) : (entry.isNewPlan || entry.isExtension) &&
    entry.status.tone === "success" ? (
    <Button
      asChild
      variant="outline"
      size="md"
      className="max-sm:h-11 max-sm:w-full"
    >
      <Link href="/plan" prefetch={false}>
        Voir le programme
      </Link>
    </Button>
  ) : null;
  return (
    <article
      aria-labelledby={`history-${entry.id}`}
      className={cn(
        "grid gap-x-4.5 gap-y-2 rounded-card border px-3.5 py-3.5 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:px-4.5 sm:py-4",
        entry.highlighted
          ? "border-warning-border bg-surface"
          : entry.status.tone === "success"
            ? "border-border bg-surface"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs sm:flex-col sm:items-start sm:text-meta">
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            toneText[entry.status.tone],
          )}
        >
          <ToneDot tone={entry.status.tone} />
          {entry.status.label}
        </span>
        <span className="text-xs text-muted-foreground">{entry.when}</span>
        {entry.version && (
          <MonoLabel size="micro" className="max-sm:ml-auto">
            {entry.version}
          </MonoLabel>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h3
          id={`history-${entry.id}`}
          className="text-base leading-[1.3] font-semibold"
        >
          {entry.title}
        </h3>
        <span className="inline-flex items-center gap-2 text-meta text-muted">
          <StaffStack staff={entry.origin.staff} />
          {entry.origin.line}
        </span>
        {entry.note && (
          <p className="text-meta leading-normal text-muted-foreground">
            {entry.note}
          </p>
        )}
      </div>
      {action && (
        <div className="flex flex-col items-end gap-2.5 max-sm:items-stretch max-sm:pt-1">
          {action}
        </div>
      )}
    </article>
  );
}

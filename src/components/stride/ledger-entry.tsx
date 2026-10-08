import { cn } from "@/lib/utils";
import {
  DecisionMark,
  DoneMark,
  decisionLabels,
  type DecisionStatus,
} from "@/components/stride/marks";

function LedgerStatus({ status }: { status: DecisionStatus }) {
  if (status === "accepted") return <DoneMark />;
  return (
    <span className="grid size-6.5 place-items-center" aria-hidden="true">
      <DecisionMark status={status} className="size-3" />
    </span>
  );
}

export function LedgerEntry({
  status,
  title,
  attribution,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"article">, "title"> & {
  status: DecisionStatus;
  title: React.ReactNode;
  attribution?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <article
      data-slot="ledger-entry"
      data-status={status}
      className={cn("grid grid-cols-[1.625rem_minmax(0,1fr)] gap-3", className)}
      {...props}
    >
      <LedgerStatus status={status} />
      <div className="flex flex-col gap-2 rounded-card border border-border p-3.5">
        <h3 className="text-body font-semibold">
          <span className="sr-only">{decisionLabels[status]}: </span>
          {title}
        </h3>
        {children && <p className="text-meta text-muted">{children}</p>}
        {attribution && (
          <p className="text-xs text-muted-foreground">{attribution}</p>
        )}
        {action && <div className="text-xs text-muted">{action}</div>}
      </div>
    </article>
  );
}

export function DecisionLegend({
  className,
  statuses = ["open", "accepted", "declined", "automatic"],
}: {
  className?: string;
  statuses?: DecisionStatus[];
}) {
  return (
    <ul className={cn("flex flex-wrap gap-3.5 text-xs text-muted", className)}>
      {statuses.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <DecisionMark status={status} />
          {decisionLabels[status]}
        </li>
      ))}
    </ul>
  );
}

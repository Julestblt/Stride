import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";

export function Recommendation({
  className,
  ...props
}: React.ComponentProps<"article">) {
  return (
    <article
      data-slot="recommendation"
      className={cn(
        "flex flex-col rounded-card border border-border bg-surface motion-safe:animate-rise",
        className,
      )}
      {...props}
    />
  );
}

export function RecommendationHeader({
  source,
  status,
  className,
  ...props
}: Omit<React.ComponentProps<"header">, "children"> & {
  source?: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <header
      data-slot="recommendation-header"
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border px-4.5 py-3.5",
        className,
      )}
      {...props}
    >
      <StrideMark />
      <span className="text-sm font-semibold">Stride Coach</span>
      {source && <MonoLabel size="micro">{source}</MonoLabel>}
      {status && <span className="ml-auto">{status}</span>}
    </header>
  );
}

export function RecommendationBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="recommendation-body"
      className={cn("flex flex-col gap-3.5 p-4.5", className)}
      {...props}
    />
  );
}

export function RecommendationTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="recommendation-title"
      className={cn("text-title font-semibold text-balance", className)}
      {...props}
    />
  );
}

export function RecommendationDiff({
  from,
  to,
  className,
}: {
  from: React.ReactNode;
  to: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      data-slot="recommendation-diff"
      className={cn("flex flex-wrap items-center gap-2.5 text-sm", className)}
    >
      <span className="sr-only">Change from </span>
      <del className="text-muted-foreground">{from}</del>
      <ArrowRightIcon
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
      />
      <span className="sr-only"> to </span>
      <ins className="no-underline">{to}</ins>
    </p>
  );
}

export function RecommendationSignals({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="recommendation-signals"
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  );
}

export function RecommendationActions({
  confidence,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { confidence?: React.ReactNode }) {
  return (
    <div
      data-slot="recommendation-actions"
      className={cn("flex flex-wrap items-center gap-2.5", className)}
      {...props}
    >
      {children}
      {confidence && <span className="ml-auto">{confidence}</span>}
    </div>
  );
}

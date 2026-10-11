import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";

export function RaceCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-panel border border-border bg-surface px-5 py-5 sm:px-6 sm:py-5.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardLabel({
  coach = false,
  className,
  children,
  ...props
}: React.ComponentProps<"h2"> & { coach?: boolean }) {
  return (
    <MonoLabel asChild>
      <h2 className={cn("flex items-center gap-2", className)} {...props}>
        {coach && <StrideMark className="size-3.5" />}
        <span>{children}</span>
      </h2>
    </MonoLabel>
  );
}

export function Figure({
  value,
  label,
  tone,
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  tone?: "night" | "accent";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span
        className={cn(
          "font-metric text-[1.625rem] leading-none font-semibold tracking-[-0.01em] tabular-nums",
          tone === "night" && "text-night",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?:
    | "neutral"
    | "outline"
    | "accent"
    | "success"
    | "warning"
    | "danger"
    | "provider";
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.25 py-0.75 text-xs whitespace-nowrap",
        {
          neutral: "bg-surface-raised text-foreground",
          outline: "border border-border-strong text-muted",
          accent: "bg-accent text-accent-foreground",
          success: "bg-success-surface text-success",
          warning: "bg-warning/10 text-warning",
          danger: "bg-danger/10 text-danger",
          provider: "bg-provider/10 text-provider",
        }[tone],
        className,
      )}
    >
      {dot && (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

export function LegendItem({
  mark,
  children,
}: {
  mark: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      {mark}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-card border border-dashed border-border-strong bg-surface-inset px-4 py-4",
        className,
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-meta text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

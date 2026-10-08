import { cn } from "@/lib/utils";
import { Metric } from "@/components/stride/metric";
import { TrendLabel, type Trend } from "@/components/stride/marks";

export function VerdictList({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="verdict-list"
      className={cn("flex flex-col border-t border-border", className)}
      {...props}
    />
  );
}

export function VerdictRow({
  label,
  detail,
  value,
  unit,
  trend,
  verdict,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"li">, "children"> & {
  label: React.ReactNode;
  detail?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  trend: Trend;
  verdict?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li
      data-slot="verdict-row"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border py-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,7.5rem)]",
        children &&
          "lg:grid-cols-[minmax(0,1.4fr)_6rem_8rem_minmax(0,1.3fr)] lg:gap-x-4.5",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm">{label}</span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </span>
      <Metric
        value={value}
        unit={unit}
        className="justify-self-end sm:justify-self-start"
      />
      {children && (
        <span aria-hidden="true" className="hidden lg:block">
          {children}
        </span>
      )}
      <TrendLabel
        trend={trend}
        className="col-span-2 sm:col-span-1 [&>span:last-child]:text-pretty"
      >
        {verdict}
      </TrendLabel>
    </li>
  );
}

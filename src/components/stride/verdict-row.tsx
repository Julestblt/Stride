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
  metricSize = "md",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"li">, "children" | "value"> & {
  label: React.ReactNode;
  detail?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  trend?: Trend;
  verdict?: React.ReactNode;
  metricSize?: "md" | "lg";
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
        size={metricSize}
        className="justify-self-end sm:justify-self-start"
      />
      {children && (
        <span className="col-start-2 row-start-2 justify-self-end sm:hidden lg:col-start-auto lg:row-start-auto lg:block lg:justify-self-stretch">
          {children}
        </span>
      )}
      {trend ? (
        <TrendLabel
          trend={trend}
          className={cn(
            "[&>span:last-child]:text-pretty",
            children
              ? "col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto"
              : "col-span-2 sm:col-span-1",
          )}
        >
          {verdict}
        </TrendLabel>
      ) : (
        <span
          className={cn(
            "text-xs text-pretty text-muted-foreground",
            children
              ? "col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto"
              : "col-span-2 sm:col-span-1",
          )}
        >
          {verdict}
        </span>
      )}
    </li>
  );
}

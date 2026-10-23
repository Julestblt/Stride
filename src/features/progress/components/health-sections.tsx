import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type { HealthKpi, Tone } from "../health-view";

const toneDot: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
};

export function KpiStrip({ kpis }: { kpis: HealthKpi[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="flex flex-col gap-1.5 border-border p-4 not-last:border-b sm:not-last:border-r lg:border-b-0"
        >
          <dt>
            <MonoLabel size="nano">{kpi.label}</MonoLabel>
          </dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="font-metric text-[28px] leading-none font-semibold tabular-nums">
              {kpi.value}
            </span>
            {kpi.unit && (
              <span className="text-xs text-muted-foreground">{kpi.unit}</span>
            )}
          </dd>
          <dd className="flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                toneDot[kpi.tone],
              )}
            />
            {kpi.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

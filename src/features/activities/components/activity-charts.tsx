import type { ReactNode } from "react";
import { MonoLabel } from "@/components/stride/mono-label";
import { chartWidth, type ChartsView, type LineChart } from "../charts";

function ChartFrame({
  title,
  unit,
  chart,
  view,
  tone,
  children,
  inverted = false,
}: {
  title: string;
  unit: string;
  chart: LineChart;
  view: ChartsView;
  tone: string;
  children?: ReactNode;
  inverted?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="min-w-0 border-b border-border-subtle pb-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <MonoLabel>{title}</MonoLabel>
        <MonoLabel size="nano">{unit} · Garmin</MonoLabel>
      </div>
      <div className="relative mt-3 pl-8">
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between pb-5 font-mono text-nano text-muted-foreground">
          <span>{inverted ? chart.minLabel : chart.maxLabel}</span>
          <span>{inverted ? chart.maxLabel : chart.minLabel}</span>
        </div>
        <svg
          role="img"
          aria-label={`${title} over ${view.axis}`}
          viewBox={`0 0 ${chartWidth} ${chart.height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: chart.height }}
        >
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={chartWidth}
              y1={chart.height * fraction}
              y2={chart.height * fraction}
              className="stroke-border-subtle"
            />
          ))}
          {view.bands.map((band) => (
            <rect
              key={band.label}
              x={band.x}
              width={band.width}
              y={0}
              height={chart.height}
              className="fill-surface-raised"
            />
          ))}
          {children}
          <path
            d={chart.path}
            fill="none"
            className={tone}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {view.axis === "sample position" && (
          <MonoLabel size="nano">Sample position</MonoLabel>
        )}
        <div className="flex justify-between font-mono text-nano text-muted-foreground">
          {view.timeLabels.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ActivityCharts({ view }: { view: ChartsView }) {
  if (!view.pace && !view.heartRate && !view.cadence && !view.elevation)
    return null;
  return (
    <section
      aria-label="Activity charts"
      className="flex min-w-0 flex-col gap-4"
    >
      <MonoLabel>Activity charts</MonoLabel>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          {view.pace && (
            <ChartFrame
              inverted
              title="Pace"
              unit="min/km"
              chart={view.pace}
              view={view}
              tone="stroke-provider"
            />
          )}
          {view.heartRate && (
            <ChartFrame
              title="Heart rate"
              unit="bpm"
              chart={view.heartRate}
              view={view}
              tone="stroke-danger"
            >
              {view.heartRate.zoneBand && (
                <rect
                  x={0}
                  width={chartWidth}
                  y={view.heartRate.zoneBand.y}
                  height={view.heartRate.zoneBand.height}
                  className="fill-zone-4/10"
                />
              )}
              {view.heartRate.peak && (
                <g>
                  <circle
                    cx={view.heartRate.peak.x}
                    cy={view.heartRate.peak.y}
                    r={3}
                    className="fill-danger"
                  />
                  <text
                    x={Math.max(
                      24,
                      Math.min(chartWidth - 24, view.heartRate.peak.x),
                    )}
                    y={Math.max(12, view.heartRate.peak.y - 8)}
                    textAnchor="middle"
                    className="fill-danger font-mono text-xs"
                  >
                    {view.heartRate.peak.value}
                  </text>
                </g>
              )}
            </ChartFrame>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {view.cadence && (
            <ChartFrame
              title="Cadence"
              unit="steps/min"
              chart={view.cadence}
              view={view}
              tone="stroke-muted"
            />
          )}
          {view.elevation && (
            <ChartFrame
              title="Elevation"
              unit="m"
              chart={view.elevation}
              view={view}
              tone="stroke-muted-foreground"
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function ActivityScatter({ view }: { view: ChartsView }) {
  return (
    <>
      {" "}
      {view.scatter && (
        <section
          aria-label="Pace and heart rate"
          className="min-w-0 border-t border-border-subtle pt-5"
        >
          <div className="flex items-baseline justify-between">
            <MonoLabel>Pace and heart rate</MonoLabel>
            <MonoLabel size="nano">bpm · min/km · Garmin</MonoLabel>
          </div>
          <div className="relative mt-3 pl-8">
            <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-4 font-mono text-nano text-muted-foreground">
              <span>{view.scatter.heartRateLabels[1]}</span>
              <span>{view.scatter.heartRateLabels[0]}</span>
            </div>
            <svg
              role="img"
              aria-label="Heart rate by running pace"
              viewBox={`0 0 ${chartWidth} ${view.scatter.height}`}
              className="h-52 w-full"
              preserveAspectRatio="none"
            >
              {view.scatter.points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  className="fill-provider/60"
                />
              ))}
            </svg>
          </div>
          <div className="flex justify-between font-mono text-nano text-muted-foreground">
            {view.scatter.paceLabels.map((label, index) => (
              <span key={index}>{label} /km</span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

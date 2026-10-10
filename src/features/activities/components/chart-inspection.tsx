"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { chartWidth, type LineChart } from "../charts";

export function ChartInspection({
  title,
  axis,
  chart,
  children,
}: {
  title: string;
  axis: string;
  chart: LineChart;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const sample = selected === null ? null : chart.samples[selected];
  const inspect = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
    let nearest = 0;
    chart.samples.forEach((point, index) => {
      if (Math.abs(point.x - x) < Math.abs(chart.samples[nearest].x - x))
        nearest = index;
    });
    setSelected(nearest);
  };

  return (
    <div
      role="group"
      aria-label={`Inspecter ${title.toLocaleLowerCase("fr-FR")} · flèches pour parcourir, Échap pour fermer`}
      tabIndex={0}
      className="relative rounded-control outline-none focus-visible:ring-2 focus-visible:ring-focus"
      onFocus={() => setSelected((current) => current ?? 0)}
      onBlur={() => setSelected(null)}
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setSelected(null);
      }}
      onPointerCancel={() => setSelected(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setSelected(null);
        else if (
          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          const last = chart.samples.length - 1;
          setSelected(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : Math.max(
                    0,
                    Math.min(
                      last,
                      (selected ?? 0) + (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
          );
        }
      }}
    >
      <svg
        role="img"
        aria-label={`${title} selon ${axis}`}
        viewBox={`0 0 ${chartWidth} ${chart.height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chart.height }}
      >
        {children}
        {sample && (
          <g aria-hidden="true">
            <line
              x1={sample.x}
              x2={sample.x}
              y1={0}
              y2={chart.height}
              className="stroke-foreground/60"
              vectorEffect="non-scaling-stroke"
            />
            {sample.y !== null && (
              <circle
                cx={sample.x}
                cy={sample.y}
                r={3}
                className="fill-foreground stroke-surface"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        )}
      </svg>
      {sample && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 right-0 max-w-full rounded-control border border-border-strong bg-surface px-2 py-1 font-mono text-xs"
        >
          <p>{sample.value ?? "Mesure indisponible"}</p>
          <p className="text-nano text-muted-foreground">{sample.position}</p>
        </div>
      )}
    </div>
  );
}

import { StrideMark } from "@/components/stride/stride-mark";
import type { LoadChart as LoadChartModel } from "../load";
import { addDays, daysBetween } from "../period";
import {
  formatDayMonth,
  formatDayMonthShort,
  formatInteger,
  formatMonthShort,
} from "../format";

type Frame = {
  width: number;
  height: number;
  baseline: number;
  top: number;
  lineBottom: number;
  barDepth: number;
  font: number;
  axisGap: number;
  maxMonths: number;
};

const desktop: Frame = {
  width: 1200,
  height: 244,
  baseline: 200,
  top: 30,
  lineBottom: 160,
  barDepth: 26,
  font: 10,
  axisGap: 40,
  maxMonths: 13,
};

const mobile: Frame = {
  width: 350,
  height: 168,
  baseline: 140,
  top: 22,
  lineBottom: 112,
  barDepth: 14,
  font: 8,
  axisGap: 26,
  maxMonths: 7,
};

function monthTicks(start: string, end: string, maximum: number) {
  const ticks: string[] = [];
  let cursor = `${start.slice(0, 7)}-01`;
  if (cursor < start) cursor = addDays(`${cursor.slice(0, 7)}-28`, 4);
  while (cursor <= end) {
    ticks.push(cursor);
    cursor = `${addDays(`${cursor.slice(0, 7)}-28`, 4).slice(0, 7)}-01`;
  }
  const step = Math.ceil(ticks.length / maximum);
  return ticks.filter((_, index) => index % step === 0);
}

function path(points: [number, number][]) {
  return points
    .map(
      ([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join(" ");
}

function Plot({
  chart,
  frame,
  className,
}: {
  chart: LoadChartModel;
  frame: Frame;
  className: string;
}) {
  const span = Math.max(1, daysBetween(chart.start, chart.end));
  const x = (day: string) =>
    (daysBetween(chart.start, day) / span) * frame.width;
  const values = chart.points.flatMap((point) => [
    point.condition,
    point.fatigue,
  ]);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const y = (value: number) =>
    frame.lineBottom -
    ((value - min) / Math.max(1, max - min)) * (frame.lineBottom - frame.top);
  const freshnessMax = Math.max(
    1,
    ...chart.weeks.map((week) => Math.abs(week.freshness)),
  );
  const weekWidth = Math.max(2, (7 / span) * frame.width * 0.6);
  const ticks = monthTicks(chart.start, chart.end, frame.maxMonths);
  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className={className}
      role="img"
      aria-label={`Condition ${formatInteger(chart.current.condition)}, fatigue ${formatInteger(chart.current.fatigue)} au ${formatDayMonth(chart.end)}. Pic de condition ${formatInteger(chart.peak.condition)} le ${formatDayMonth(chart.peak.day)}.`}
    >
      <g className="stroke-border-subtle">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const lineY = frame.top + ratio * (frame.baseline - frame.top);
          return (
            <line key={ratio} x1="0" x2={frame.width} y1={lineY} y2={lineY} />
          );
        })}
      </g>
      <g className="fill-provider" opacity="0.45">
        {chart.weeks.map((week) => {
          const height =
            (Math.abs(week.freshness) / freshnessMax) * frame.barDepth;
          const left = Math.min(
            Math.max(0, x(week.start)),
            frame.width - weekWidth,
          );
          return (
            <rect
              key={week.start}
              x={left}
              y={week.freshness >= 0 ? frame.baseline - height : frame.baseline}
              width={weekWidth}
              height={Math.max(1, height)}
            />
          );
        })}
      </g>
      <line
        x1="0"
        x2={frame.width}
        y1={frame.baseline}
        y2={frame.baseline}
        className="stroke-border-strong"
      />
      <path
        d={path(
          chart.points.map((point) => [x(point.day), y(point.condition)]),
        )}
        fill="none"
        strokeWidth="2.2"
        strokeLinejoin="round"
        className="stroke-foreground"
      />
      <path
        d={path(chart.points.map((point) => [x(point.day), y(point.fatigue)]))}
        fill="none"
        strokeWidth="1.6"
        strokeDasharray="5 4"
        strokeLinejoin="round"
        className="stroke-danger"
      />
      <g
        className="font-mono uppercase"
        fontSize={frame.font}
        letterSpacing="0.06em"
      >
        {chart.markers.map((marker, index) => {
          const markerX = x(marker.day);
          const labelY = frame.top - 12 + (index % 2) * (frame.font + 6);
          const end = markerX > frame.width * 0.7;
          return (
            <g key={`${marker.day}-${marker.name}`}>
              <line
                x1={markerX}
                x2={markerX}
                y1={labelY + 2}
                y2={frame.baseline}
                strokeDasharray="2 3"
                className="stroke-dim"
              />
              <text
                x={end ? markerX - 6 : markerX + 6}
                y={labelY}
                textAnchor={end ? "end" : "start"}
                className="fill-foreground"
              >
                {`${marker.name} · ${formatDayMonthShort(marker.day)}`}
              </text>
            </g>
          );
        })}
        {ticks.map((tick, index) => (
          <text
            key={tick}
            x={
              index === ticks.length - 1 && x(tick) > frame.width - 30
                ? frame.width
                : x(tick)
            }
            y={frame.baseline + frame.axisGap}
            textAnchor={
              index === ticks.length - 1 && x(tick) > frame.width - 30
                ? "end"
                : "start"
            }
            className="fill-muted-foreground"
          >
            {formatMonthShort(tick)}
          </text>
        ))}
      </g>
    </svg>
  );
}

export function LoadLegend({ className }: { className?: string }) {
  return (
    <ul className={className}>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-3.5 bg-foreground" />
        Condition · 28 j
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-3.5 border-t-2 border-dashed border-danger"
        />
        Fatigue · 7 j
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-3 bg-provider opacity-50" />
        Fraîcheur
      </li>
    </ul>
  );
}

export function LoadChart({
  chart,
}: {
  chart: LoadChartModel & { note: string };
}) {
  return (
    <figure className="flex flex-col gap-3">
      <Plot
        chart={chart}
        frame={desktop}
        className="h-auto w-full max-sm:hidden"
      />
      <Plot chart={chart} frame={mobile} className="h-auto w-full sm:hidden" />
      <figcaption className="flex items-start gap-2.5 text-sm text-muted sm:text-meta">
        <StrideMark className="mt-0.5 size-3.5 shrink-0" />
        <span className="text-pretty">{chart.note}</span>
      </figcaption>
    </figure>
  );
}

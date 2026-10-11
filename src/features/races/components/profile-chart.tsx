"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { formatClock, formatKm, formatMeters } from "../format";
import type { ProfileData, ProfileMarker } from "../profile";
import { WeatherGlyph, glyphTone } from "./weather-icon";

type Variant = "full" | "mobile" | "compact" | "editor";

const niceSteps = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
const axisSteps = [5, 10, 20, 25, 50, 100, 200];

function layout(variant: Variant, data: ProfileData) {
  const width = variant === "mobile" ? 360 : 1000;
  const x0 = variant === "mobile" ? 22 : variant === "compact" ? 34 : 34;
  const x1 = variant === "mobile" ? 352 : 990;
  const weather =
    (variant === "full" || variant === "mobile") && data.weather
      ? variant === "mobile"
        ? 58
        : 66
      : 0;
  const markers = variant === "compact" ? 0 : 26;
  const plotTop = weather + markers + (variant === "compact" ? 8 : 0);
  const plotHeight =
    variant === "compact"
      ? 96
      : variant === "mobile"
        ? 120
        : variant === "editor"
          ? 150
          : 184;
  const plotBottom = plotTop + plotHeight;
  const axis = variant === "compact" ? 0 : 14;
  const segments =
    data.segments.length && variant !== "compact"
      ? variant === "mobile"
        ? 26
        : 40
      : 0;
  const passages = variant === "full" && data.segments.length ? 96 : 0;
  return {
    width,
    x0,
    x1,
    weatherTop: 0,
    markerY: weather + 12,
    plotTop,
    plotBottom,
    axisY: plotBottom + 12,
    segTop: plotBottom + axis + 4,
    passTop: plotBottom + axis + segments + 18,
    height:
      plotBottom + axis + segments + passages + (variant === "compact" ? 4 : 8),
  };
}

function MarkerShape({
  marker,
  x,
  y,
  size,
  active,
}: {
  marker: ProfileMarker;
  x: number;
  y: number;
  size: number;
  active?: boolean;
}) {
  const { mark } = marker;
  const r = size / 2;
  const font = size * 0.55;
  if (mark.shape === "circle") {
    const filled = mark.tone === "start" || mark.tone === "finish" || active;
    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={r}
          className={cn(
            mark.tone === "finish" || active
              ? "fill-accent"
              : mark.tone === "start"
                ? "fill-foreground"
                : "fill-background",
            !filled && "stroke-foreground",
          )}
          strokeWidth={filled ? 0 : 1.4}
        />
        <text
          x={x}
          y={y + font * 0.36}
          textAnchor="middle"
          className={cn(
            "font-metric font-bold",
            filled ? "fill-background" : "fill-foreground",
          )}
          fontSize={font}
        >
          {mark.label}
        </text>
      </g>
    );
  }
  if (mark.shape === "square")
    return (
      <g>
        <rect
          x={x - r}
          y={y - r}
          width={size}
          height={size}
          rx={size / 4}
          className={active ? "fill-accent" : "fill-background stroke-provider"}
          strokeWidth={active ? 0 : 1.4}
        />
        <text
          x={x}
          y={y + font * 0.36}
          textAnchor="middle"
          className={cn(
            "font-metric font-bold",
            active ? "fill-background" : "fill-foreground",
          )}
          fontSize={font}
        >
          {mark.label}
        </text>
      </g>
    );
  if (mark.shape === "triangle")
    return (
      <path
        d={`M${x},${y - r} L${x + r},${y + r * 0.8} L${x - r},${y + r * 0.8}Z`}
        className="fill-background stroke-muted"
        strokeWidth={1.4}
      />
    );
  return (
    <path
      d={`M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y}Z`}
      className={cn(
        "fill-background",
        mark.tone === "caution" ? "stroke-warning" : "stroke-night",
      )}
      strokeWidth={1.4}
    />
  );
}

export function ProfileChart({
  data,
  variant = "full",
  activeId = null,
  onPick,
  label,
  className,
}: {
  data: ProfileData;
  variant?: Variant;
  activeId?: string | null;
  onPick?: (distanceM: number) => void;
  label: string;
  className?: string;
}) {
  const patternId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [inspectedMarkerId, setInspectedMarkerId] = useState<string | null>(
    null,
  );
  const box = layout(variant, data);
  const span = Math.max(1, data.distanceM);
  const x = (distanceM: number) =>
    box.x0 +
    (Math.max(0, Math.min(span, distanceM)) / span) * (box.x1 - box.x0);
  const values = data.elevation.map(([, ele]) => ele);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const step =
    niceSteps.find((value) => (maximum - minimum) / value <= 4) ?? 1000;
  const low = Math.floor(minimum / step) * step;
  const high = Math.max(low + step, Math.ceil(maximum / step) * step);
  const y = (ele: number) =>
    box.plotBottom -
    ((ele - low) / (high - low)) * (box.plotBottom - box.plotTop);
  const line = data.elevation
    .map(
      ([d, e], index) =>
        `${index ? "L" : "M"}${x(d).toFixed(1)},${y(e).toFixed(1)}`,
    )
    .join("");
  const area = data.elevation.length
    ? `${line}L${x(data.distanceM).toFixed(1)},${box.plotBottom}L${box.x0},${box.plotBottom}Z`
    : "";
  const eleAt = (distanceM: number) => {
    let best = data.elevation[0];
    for (const point of data.elevation) {
      if (point[0] > distanceM) break;
      best = point;
    }
    return best ? best[1] : null;
  };
  const walkPaths = data.walk.map((portion) =>
    data.elevation
      .filter(([d]) => d >= portion.fromM - 1 && d <= portion.toM + 1)
      .map(
        ([d, e], index) =>
          `${index ? "L" : "M"}${x(d).toFixed(1)},${y(e).toFixed(1)}`,
      )
      .join(""),
  );
  const shown = data.markers.filter(
    (marker) => variant === "editor" || marker.boundary,
  );
  const inspectedMarker = shown.find(
    (marker) => marker.id === inspectedMarkerId,
  );
  const axisStep =
    axisSteps.find(
      (value) => span / 1000 / value <= (variant === "mobile" ? 3 : 6),
    ) ?? 200;
  const ticks = Array.from(
    { length: Math.floor(span / 1000 / axisStep) + 1 },
    (_, index) => index * axisStep,
  );
  const grid = Array.from(
    { length: Math.round((high - low) / step) },
    (_, index) => low + (index + 1) * step,
  );
  const markerSize = variant === "mobile" ? 14 : 20;
  const weather =
    (variant === "full" || variant === "mobile") && data.weather
      ? data.weather.filter(
          (_, index) => variant !== "mobile" || index % 2 === 0,
        )
      : [];
  const interactive = variant === "editor" && Boolean(onPick);
  const inspectable = variant === "full" || variant === "mobile" || interactive;
  const hoveredElevation = hover === null ? null : eleAt(hover);
  const hoveredPassage = (() => {
    if (hover === null || data.passageTimes.length < 2) return null;
    const nextIndex = data.passageTimes.findIndex(
      (passage) => passage.distanceM >= hover,
    );
    const endIndex =
      nextIndex < 0 ? data.passageTimes.length - 1 : Math.max(1, nextIndex);
    const end = data.passageTimes[endIndex];
    const start = data.passageTimes[endIndex - 1];
    const fraction = Math.max(
      0,
      Math.min(
        1,
        (hover - start.distanceM) /
          Math.max(1, end.distanceM - start.distanceM),
      ),
    );
    return formatClock(
      start.clockMinutes + fraction * (end.clockMinutes - start.clockMinutes),
    );
  })();
  const fromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * box.width;
    if (svgX < box.x0 || svgX > box.x1) return null;
    return ((svgX - box.x0) / (box.x1 - box.x0)) * span;
  };
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        className={cn("block w-full", inspectable && "cursor-crosshair")}
        role="img"
        aria-label={
          hover === null || interactive
            ? label
            : `${label}. Km ${formatKm(hover)}${hoveredElevation === null ? "" : `, altitude ${formatMeters(hoveredElevation)}`}${hoveredPassage ? `, passage estimé à ${hoveredPassage}` : ""}.`
        }
        tabIndex={interactive ? undefined : inspectable ? 0 : undefined}
        onFocus={
          inspectable && !interactive ? () => setHover(span / 2) : undefined
        }
        onBlur={inspectable && !interactive ? () => setHover(null) : undefined}
        onKeyDown={
          inspectable && !interactive
            ? (event) => {
                const step = span / 20;
                const next =
                  event.key === "ArrowRight"
                    ? Math.min(span, (hover ?? span / 2) + step)
                    : event.key === "ArrowLeft"
                      ? Math.max(0, (hover ?? span / 2) - step)
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? span
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setHover(next);
                }
              }
            : undefined
        }
        onPointerMove={
          inspectable ? (event) => setHover(fromPointer(event)) : undefined
        }
        onPointerLeave={
          inspectable
            ? () => {
                setHover(null);
                setInspectedMarkerId(null);
              }
            : undefined
        }
        onClick={
          interactive
            ? (event) => {
                const distance = fromPointer(
                  event as unknown as React.PointerEvent<SVGSVGElement>,
                );
                if (distance !== null) onPick?.(distance);
              }
            : undefined
        }
      >
        <defs>
          <pattern
            id={patternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              className="stroke-provider"
              strokeWidth="1.2"
              opacity=".55"
            />
          </pattern>
        </defs>
        {weather.map((slot) => {
          const cx = x(slot.distanceM);
          const scale = variant === "mobile" ? 0.8 : 1;
          return (
            <g key={`${slot.hour}-${slot.distanceM}`}>
              <text
                x={cx}
                y={10 * scale}
                textAnchor="middle"
                className="fill-muted-foreground font-mono uppercase"
                fontSize={8.5 * scale}
              >
                {slot.hour}
              </text>
              <g
                transform={`translate(${cx - 8 * scale},${16 * scale}) scale(${scale})`}
                className={glyphTone(slot.glyph)}
              >
                <WeatherGlyph glyph={slot.glyph} />
              </g>
              <text
                x={cx}
                y={45 * scale}
                textAnchor="middle"
                className="fill-foreground font-metric font-semibold"
                fontSize={14 * scale}
              >
                {slot.temperature}°
              </text>
              {variant !== "mobile" && (
                <text
                  x={cx}
                  y={55}
                  textAnchor="middle"
                  className={cn(
                    "font-mono",
                    slot.precipitation >= 50 ? "fill-provider" : "fill-dim",
                  )}
                  fontSize={8}
                >
                  {slot.precipitation}%
                </text>
              )}
            </g>
          );
        })}
        {data.night.map((range, index) => (
          <g key={`night-${index}`}>
            <rect
              x={x(range.fromM)}
              y={box.plotTop}
              width={Math.max(0, x(range.toM) - x(range.fromM))}
              height={box.plotBottom - box.plotTop}
              className="fill-night"
              opacity={0.09}
            />
            {range.label && variant !== "compact" && (
              <text
                x={x(range.fromM) + 6}
                y={box.plotTop + 14}
                className="fill-night font-mono uppercase"
                fontSize={variant === "mobile" ? 7 : 9}
                letterSpacing=".08em"
              >
                {range.label}
              </text>
            )}
          </g>
        ))}
        {data.rain.map((range, index) => (
          <g key={`rain-${index}`}>
            <rect
              x={x(range.fromM)}
              y={box.plotTop}
              width={Math.max(0, x(range.toM) - x(range.fromM))}
              height={box.plotBottom - box.plotTop}
              fill={`url(#${patternId})`}
              opacity={0.5}
            />
            {variant !== "compact" && (
              <text
                x={x(range.fromM) + 6}
                y={box.plotTop + 14}
                className="fill-provider font-mono uppercase"
                fontSize={9}
                letterSpacing=".08em"
              >
                Averses
              </text>
            )}
          </g>
        ))}
        {variant !== "compact" &&
          grid.map((value) => (
            <g key={value}>
              <line
                x1={box.x0}
                x2={box.x1}
                y1={y(value)}
                y2={y(value)}
                className="stroke-border-subtle"
              />
              <text
                x={box.x0 - 6}
                y={y(value) + 3}
                textAnchor="end"
                className="fill-dim font-mono"
                fontSize={variant === "mobile" ? 7 : 8.5}
              >
                {value}
              </text>
            </g>
          ))}
        <path d={area} className="fill-foreground" opacity={0.05} />
        <path
          d={line}
          fill="none"
          className="stroke-foreground"
          strokeWidth={variant === "mobile" ? 1.2 : 1.4}
          strokeLinejoin="round"
        />
        {walkPaths.map((path, index) => (
          <path
            key={index}
            d={path}
            fill="none"
            className="stroke-accent"
            strokeWidth={variant === "compact" ? 2.6 : 3.2}
            strokeLinecap="round"
          />
        ))}
        {shown.map((marker, index) => {
          const mx = x(marker.distanceM);
          const ele = marker.ele ?? eleAt(marker.distanceM);
          const edge =
            index === 0 ||
            (marker.mark.shape === "circle" && marker.mark.tone === "start");
          return (
            <g
              key={marker.id}
              tabIndex={inspectable && !interactive ? 0 : undefined}
              role={inspectable && !interactive ? "img" : undefined}
              aria-label={
                inspectable && !interactive
                  ? `${marker.name}, km ${formatKm(marker.distanceM)}${marker.clock ? `, passage prévu à ${marker.clock}` : ""}`
                  : undefined
              }
              onPointerEnter={
                inspectable && !interactive
                  ? () => setInspectedMarkerId(marker.id)
                  : undefined
              }
              onPointerLeave={
                inspectable && !interactive
                  ? () => setInspectedMarkerId(null)
                  : undefined
              }
              onFocus={
                inspectable && !interactive
                  ? () => setInspectedMarkerId(marker.id)
                  : undefined
              }
              onBlur={
                inspectable && !interactive
                  ? () => setInspectedMarkerId(null)
                  : undefined
              }
            >
              <line
                x1={mx}
                x2={mx}
                y1={box.plotTop - (variant === "compact" ? 0 : 4)}
                y2={box.plotBottom}
                className={edge ? "stroke-border-strong" : "stroke-dim"}
                strokeDasharray={edge ? "2 3" : undefined}
                opacity={marker.boundary ? 1 : 0.5}
              />
              {ele !== null && (
                <circle
                  cx={mx}
                  cy={y(ele)}
                  r={3.2}
                  className="fill-background stroke-foreground"
                  strokeWidth={1.4}
                />
              )}
              {variant !== "compact" && (
                <MarkerShape
                  marker={marker}
                  x={mx}
                  y={box.markerY}
                  size={markerSize}
                  active={
                    marker.id === activeId || marker.id === inspectedMarkerId
                  }
                />
              )}
            </g>
          );
        })}
        {variant !== "compact" &&
          ticks.map((tick) => (
            <text
              key={tick}
              x={x(tick * 1000)}
              y={box.axisY}
              textAnchor="middle"
              className="fill-dim font-mono"
              fontSize={variant === "mobile" ? 7 : 8.5}
            >
              {tick}
            </text>
          ))}
        {variant !== "compact" &&
          data.segments.map((segment, index) => {
            const left = x(segment.fromM) + 1;
            const width = Math.max(0, x(segment.toM) - x(segment.fromM) - 2);
            const cx = left + width / 2;
            const height = variant === "mobile" ? 18 : 34;
            return (
              <g key={`${segment.fromM}-${segment.toM}`}>
                <rect
                  x={left}
                  y={box.segTop}
                  width={width}
                  height={height}
                  rx={4}
                  className={
                    index % 2 ? "fill-surface-inset" : "fill-surface-raised"
                  }
                />
                {width > (variant === "mobile" ? 16 : 42) && (
                  <text
                    x={cx}
                    y={box.segTop + (variant === "mobile" ? 12 : 15)}
                    textAnchor="middle"
                    className="fill-foreground font-metric font-semibold"
                    fontSize={variant === "mobile" ? 8 : 13}
                  >
                    {variant === "mobile"
                      ? segment.km.replace(" km", "")
                      : segment.km}
                  </text>
                )}
                {variant !== "mobile" && width > 56 && (
                  <text
                    x={cx}
                    y={box.segTop + 27}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    fontSize={8}
                  >
                    {segment.detail}
                  </text>
                )}
              </g>
            );
          })}
        {variant === "full" &&
          shown.map((marker, index) => {
            if (!marker.clock) return null;
            const mx = x(marker.distanceM);
            const last = index === shown.length - 1;
            const anchor = index === 0 ? "start" : last ? "end" : "middle";
            const lower = index % 2 === 1 && !last;
            const top = box.passTop + (lower ? 46 : 0);
            const tx = index === 0 ? mx - 2 : last ? mx + 2 : mx;
            const passageLabel =
              marker.mark.shape === "circle"
                ? marker.mark.tone === "start"
                  ? "Départ"
                  : marker.mark.tone === "finish"
                    ? "Arrivée"
                    : "Ravito"
                : marker.mark.shape === "square"
                  ? "Eau"
                  : "Point";
            return (
              <g key={`passage-${marker.id}`}>
                {lower && (
                  <line
                    x1={mx}
                    x2={mx}
                    y1={box.segTop + 36}
                    y2={top - 12}
                    className="stroke-border"
                  />
                )}
                <text x={tx} y={top} textAnchor={anchor} fontSize={10}>
                  <tspan className="fill-foreground font-semibold">
                    {passageLabel}
                  </tspan>
                </text>
                <text
                  x={tx}
                  y={top + 14}
                  textAnchor={anchor}
                  className="fill-accent font-metric font-semibold"
                  fontSize={14}
                >
                  {marker.clock}
                </text>
                {marker.cutoff && (
                  <text
                    x={tx}
                    y={top + 26}
                    textAnchor={anchor}
                    className="fill-warning font-mono"
                    fontSize={8.5}
                  >
                    BH {marker.cutoff}
                  </text>
                )}
              </g>
            );
          })}
        {inspectable && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={box.plotTop}
              y2={box.plotBottom}
              className="stroke-accent"
              strokeDasharray="2 3"
            />
            <circle
              cx={x(hover)}
              cy={
                hoveredElevation === null ? box.plotBottom : y(hoveredElevation)
              }
              r={4}
              className="fill-accent stroke-background"
              strokeWidth={2}
            />
            {interactive && (
              <rect
                x={Math.min(box.x1 - 132, Math.max(box.x0, x(hover) - 66))}
                y={box.markerY - 11}
                width={132}
                height={22}
                rx={5}
                className="fill-accent"
              />
            )}
            {interactive && (
              <text
                x={Math.min(box.x1 - 66, Math.max(box.x0 + 66, x(hover)))}
                y={box.markerY + 4}
                textAnchor="middle"
                className="fill-accent-foreground font-semibold"
                fontSize={11}
              >
                {`+ Ajouter ici · km ${formatKm(hover)}`}
              </text>
            )}
          </g>
        )}
      </svg>
      {(variant === "full" || variant === "mobile") && (
        <div className="mt-2 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border-subtle pt-2 text-xs text-muted">
          {inspectedMarker ? (
            <>
              <span className="font-semibold text-foreground">
                {inspectedMarker.name}
              </span>
              <span>km {formatKm(inspectedMarker.distanceM)}</span>
              {inspectedMarker.clock && (
                <span className="font-mono text-accent">
                  {inspectedMarker.clock}
                </span>
              )}
              {inspectedMarker.cutoff && (
                <span className="font-mono text-warning">
                  BH {inspectedMarker.cutoff}
                </span>
              )}
            </>
          ) : hover !== null ? (
            <>
              <span className="font-semibold text-foreground">
                km {formatKm(hover)}
              </span>
              {hoveredElevation !== null && (
                <span>{formatMeters(hoveredElevation)}</span>
              )}
              {hoveredPassage && (
                <span className="font-mono text-accent">{hoveredPassage}</span>
              )}
            </>
          ) : (
            <span>Survole le profil ou un repère pour voir le détail.</span>
          )}
        </div>
      )}
    </div>
  );
}

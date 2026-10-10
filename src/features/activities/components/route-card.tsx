"use client";

import { useMemo, useState } from "react";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  availableModes,
  type ColorMode,
} from "@/features/activities/route-colors";
import type { RouteView } from "@/features/activities/track";
import { RouteMap } from "./route-map";

const kilometers = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const profileWidth = 800;
const profileHeight = 70;

function ElevationProfile({
  view,
  gain,
  hover,
  onHover,
}: {
  view: RouteView;
  gain: number | null;
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  const profile = view.profile;
  const range = view.elevationRange;
  if (!profile || !range) return null;
  const span = range.max - range.min || 1;
  const x = (fraction: number) => fraction * profileWidth;
  const y = (value: number) =>
    6 + (1 - (value - range.min) / span) * (profileHeight - 12);
  const line = profile.fractions
    .map(
      (fraction, index) =>
        `${index === 0 ? "M" : "L"}${x(fraction).toFixed(1)},${y(profile.elevation[index]).toFixed(1)}`,
    )
    .join("");
  const hovered = hover !== null ? view.fractions[hover] : null;
  const hoveredElevation = hover !== null ? view.elevation[hover] : null;
  return (
    <div className="border-t border-border bg-surface-inset px-3.5 pt-2.5 pb-2">
      <div className="flex items-baseline justify-between">
        <MonoLabel size="nano">Profil d’altitude</MonoLabel>
        <MonoLabel size="nano">
          {gain !== null ? `D+ ${Math.round(gain)} m · ` : ""}min{" "}
          {Math.round(range.min)} m · max {Math.round(range.max)} m
        </MonoLabel>
      </div>
      <svg
        viewBox={`0 0 ${profileWidth} ${profileHeight}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            onHover(
              Math.max(
                0,
                Math.min(
                  view.route.length - 1,
                  (hover ?? 0) + (event.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
        }}
        onBlur={() => onHover(null)}
        preserveAspectRatio="none"
        className="block h-16 w-full touch-pan-y"
        role="img"
        aria-label="Profil d’altitude du parcours"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const fraction = (event.clientX - rect.left) / rect.width;
          let best = 0;
          view.fractions.forEach((value, index) => {
            if (
              Math.abs(value - fraction) <
              Math.abs(view.fractions[best] - fraction)
            )
              best = index;
          });
          onHover(best);
        }}
        onPointerLeave={() => onHover(null)}
      >
        {view.bands.map((band) => (
          <rect
            key={band.label}
            x={x(band.from)}
            y={0}
            width={x(band.to) - x(band.from)}
            height={profileHeight}
            className="fill-surface"
          />
        ))}
        <path
          d={`${line}L${profileWidth},${profileHeight}L0,${profileHeight}Z`}
          className="fill-surface-raised/60"
        />
        <path
          d={line}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
        {hovered !== null && (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={0}
            y2={profileHeight}
            className="stroke-foreground"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hovered !== null && hoveredElevation !== null && (
          <circle
            cx={x(hovered)}
            cy={y(hoveredElevation)}
            r={3}
            className="fill-foreground"
          />
        )}
      </svg>
      <div className="flex justify-between">
        <MonoLabel size="nano">0 km</MonoLabel>
        <MonoLabel size="nano">
          {kilometers.format(view.distanceKm / 2)} km
        </MonoLabel>
        <MonoLabel size="nano">
          {kilometers.format(view.distanceKm)} km
        </MonoLabel>
      </div>
    </div>
  );
}

export function RouteCard({
  view,
  gain,
  height = "h-95",
}: {
  view: RouteView;
  gain: number | null;
  height?: string;
}) {
  const modes = useMemo(
    () => availableModes(view).map((item) => item.mode),
    [view],
  );
  const [mode, setMode] = useState<ColorMode>(modes[0] ?? "zones");
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section aria-label="Parcours" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <MonoLabel>Parcours</MonoLabel>
        <MonoLabel size="micro">
          {kilometers.format(view.distanceKm)} km · tracé Garmin
        </MonoLabel>
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-surface-inset">
        <div className={`relative ${height}`}>
          <RouteMap
            view={view}
            mode={mode}
            modes={modes}
            onModeChange={setMode}
            hover={hover}
            onHover={setHover}
          />
        </div>
        <ElevationProfile
          view={view}
          gain={gain}
          hover={hover}
          onHover={setHover}
        />
      </div>
    </section>
  );
}

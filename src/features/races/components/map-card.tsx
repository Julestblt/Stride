"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatKm } from "../format";
import type { MapData } from "../map";
import { RaceMap, type MapLayers } from "./race-map";

export function LayerChip({
  pressed,
  onPressedChange,
  dot,
  children,
  className,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  dot: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Toggle
      variant="segment"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className={cn(
        "min-h-8 gap-1.75 rounded-full border border-border-strong px-3 text-meta text-muted data-[state=on]:border-dim data-[state=on]:bg-surface-raised data-[state=on]:text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.75 rounded-full", dot)} />
      {children}
    </Toggle>
  );
}

export function MapCard({
  data,
  fileName,
  rainLabel,
  hasWeather,
  walkThreshold,
  kind = "trail",
}: {
  data: MapData;
  walkThreshold: number;
  fileName: string;
  rainLabel: "Météo" | "Averses";
  hasWeather: boolean;
  kind?: "road" | "trail";
}) {
  const road = kind === "road";
  const [layers, setLayers] = useState<MapLayers>({
    markers: !road,
    walk: !road,
    night: !road,
    rain: !road && rainLabel === "Averses",
  });
  const toggle = (key: keyof MapLayers) => (pressed: boolean) =>
    setLayers((current) => ({ ...current, [key]: pressed }));
  const chips = road ? null : (
    <>
      <LayerChip
        pressed={layers.markers}
        onPressedChange={toggle("markers")}
        dot="bg-foreground"
      >
        Ravitos
      </LayerChip>
      <LayerChip
        pressed={layers.walk}
        onPressedChange={toggle("walk")}
        dot="bg-accent"
      >
        <span className="max-sm:hidden">Marche ≥ {walkThreshold} %</span>
        <span className="sm:hidden">Marche</span>
      </LayerChip>
      {data.night.length > 0 && (
        <LayerChip
          pressed={layers.night}
          onPressedChange={toggle("night")}
          dot="bg-night"
        >
          Nuit
        </LayerChip>
      )}
      {hasWeather && (
        <LayerChip
          pressed={layers.rain}
          onPressedChange={toggle("rain")}
          dot="bg-provider"
        >
          {rainLabel}
        </LayerChip>
      )}
    </>
  );
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
      <div className="hidden flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-4 sm:flex">
        <MonoLabel asChild>
          <h2>Parcours · {fileName}</h2>
        </MonoLabel>
        <div className="flex flex-wrap gap-2">{chips}</div>
      </div>
      <RaceMap
        data={data}
        layers={layers}
        label={`Carte du parcours, ${formatKm(data.distanceM)} km${road ? "" : `, ${data.markers.length} points de passage`}`}
        className="h-60 sm:h-105"
      />
      {chips && (
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-3 py-3 sm:hidden">
          {chips}
        </div>
      )}
    </section>
  );
}

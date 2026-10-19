"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatKm } from "../format";
import {
  nearestRouteDistance,
  rangeLines,
  type MapData,
  type MapMarker,
} from "../map";

const styleUrl =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const workerUrl = new URL(
  "../../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  import.meta.url,
).toString();
const padding = 48;

export type MapLayers = {
  markers: boolean;
  walk: boolean;
  night: boolean;
  rain: boolean;
};

function token(element: Element, name: string) {
  const styles = getComputedStyle(element);
  const value = styles.getPropertyValue(name).trim();
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? styles.getPropertyValue(reference[1]).trim() : value;
}

function boundsOf(route: MapData["route"]) {
  const latitudes = route.map((point) => point[0]);
  const longitudes = route.map((point) => point[1]);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ] as [[number, number], [number, number]];
}

function markerElement(marker: MapMarker, active: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute(
    "aria-label",
    `${marker.name}, km ${formatKm(marker.distanceM)}`,
  );
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  const { mark } = marker;
  const root = "group focus-visible:outline-2 focus-visible:outline-ring";
  const base =
    "grid size-full place-items-center font-metric text-xs leading-none font-bold transition-transform duration-150 ease-stride group-hover:scale-110";
  if (mark.shape === "circle") {
    const filled = mark.tone !== "station" || active;
    element.className = cn(root, "size-5.5 rounded-full");
    visual.className = cn(
      base,
      "rounded-full",
      mark.tone === "finish" || active
        ? "bg-accent text-accent-foreground"
        : mark.tone === "start"
          ? "bg-foreground text-background"
          : "border-[1.6px] border-foreground bg-background text-foreground",
      filled && "border-0",
    );
    visual.textContent = mark.label;
  } else if (mark.shape === "square") {
    element.className = cn(root, "size-5.5 rounded-tag");
    visual.className = cn(
      base,
      "rounded-tag",
      active
        ? "bg-accent text-accent-foreground"
        : "border-[1.6px] border-provider bg-background text-foreground",
    );
    visual.textContent = mark.label;
  } else {
    element.className = cn(root, "size-3.5");
    visual.className = cn(
      base,
      "rotate-45 border-[1.6px] bg-background",
      mark.shape === "triangle"
        ? "border-muted"
        : mark.tone === "caution"
          ? "border-warning"
          : "border-night",
    );
  }
  element.append(visual);
  return element;
}

export function RaceMap({
  data,
  layers,
  activeId = null,
  onSelect,
  onPick,
  label,
  className,
}: {
  data: MapData;
  layers: MapLayers;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onPick?: (distanceM: number) => void;
  label: string;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pickRef = useRef(onPick);
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltipPoint, setTooltipPoint] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const dataRef = useRef(data);
  useEffect(() => {
    pickRef.current = onPick;
    selectRef.current = onSelect;
    dataRef.current = data;
  }, [onPick, onSelect, data]);
  const routeKey = `${data.route.length}:${data.route[0]?.join(",")}:${data.route.at(-1)?.join(",")}`;

  const bounds = useMemo(() => boundsOf(data.route), [data.route]);

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | undefined;
    const container = canvas.current;
    if (!container) return;
    const timeout = setTimeout(() => !disposed && setFailed(true), 12000);
    const initial = dataRef.current;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed) return;
        maplibre.setWorkerUrl(workerUrl);
        map = new maplibre.Map({
          container,
          style: styleUrl,
          bounds: boundsOf(initial.route),
          fitBoundsOptions: { padding },
          attributionControl: false,
          cooperativeGestures: true,
          locale: {
            "Map.Title": "Carte du parcours",
            "CooperativeGesturesHandler.WindowsHelpText":
              "Ctrl + molette pour zoomer la carte",
            "CooperativeGesturesHandler.MacHelpText":
              "⌘ + molette pour zoomer la carte",
            "CooperativeGesturesHandler.MobileHelpText":
              "Deux doigts pour déplacer la carte",
          },
        });
        const current = map;
        mapRef.current = current;
        current.on("error", () => !disposed && setFailed(true));
        current.on("load", () => {
          if (disposed) return;
          clearTimeout(timeout);
          const background = token(container, "--background");
          if (current.getLayer("background"))
            current.setPaintProperty(
              "background",
              "background-color",
              background,
            );
          const line = (coordinates: [number, number][][]) => ({
            type: "Feature" as const,
            properties: {},
            geometry: { type: "MultiLineString" as const, coordinates },
          });
          const route = [
            initial.route.map(([lat, lon]) => [lon, lat] as [number, number]),
          ];
          current.addSource("route", { type: "geojson", data: line(route) });
          current.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#000",
              "line-opacity": 0.6,
              "line-width": 7,
            },
          });
          current.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": token(container, "--muted"),
              "line-width": 2.6,
            },
          });
          const overlays: [
            string,
            { fromM: number; toM: number }[],
            string,
            number,
          ][] = [
            ["rain", initial.rain, token(container, "--provider"), 6],
            ["night", initial.night, token(container, "--night"), 2.8],
            ["walk", initial.walk, token(container, "--accent"), 5],
          ];
          for (const [id, ranges, color, width] of overlays) {
            current.addSource(id, {
              type: "geojson",
              data: line(rangeLines(initial, ranges)),
            });
            current.addLayer({
              id,
              type: "line",
              source: id,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": color,
                "line-width": width,
                "line-opacity": id === "rain" ? 0.45 : 1,
              },
            });
          }
          setReady(true);
        });
        current.on("click", (event) => {
          if (!pickRef.current) return;
          const { distanceM, offsetM } = nearestRouteDistance(
            dataRef.current,
            event.lngLat.lat,
            event.lngLat.lng,
          );
          const metersPerPixel =
            (40_075_016.686 * Math.cos((event.lngLat.lat * Math.PI) / 180)) /
            (512 * 2 ** current.getZoom());
          if (offsetM / metersPerPixel < 24) pickRef.current(distanceM);
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [routeKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ["walk", "night", "rain"] as const)
      if (map.getLayer(id))
        map.setLayoutProperty(
          id,
          "visibility",
          layers[id] ? "visible" : "none",
        );
  }, [ready, layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let active = true;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (!active) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = data.markers
        .filter(
          (marker) =>
            layers.markers ||
            (marker.mark.shape === "circle" && marker.mark.tone !== "station"),
        )
        .map((marker) => {
          const element = markerElement(marker, marker.id === activeId);
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            setSelected((value) => (value === marker.id ? null : marker.id));
            selectRef.current?.(marker.id);
          });
          return new maplibre.Marker({ element })
            .setLngLat([marker.lon, marker.lat])
            .addTo(map);
        });
    })();
    return () => {
      active = false;
    };
  }, [ready, data.markers, layers.markers, activeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [id, ranges] of [
      ["walk", data.walk],
      ["night", data.night],
      ["rain", data.rain],
    ] as const) {
      const source = map.getSource(id) as GeoJSONSource | undefined;
      source?.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiLineString",
          coordinates: rangeLines(data, ranges),
        },
      });
    }
  }, [ready, data]);

  const tooltip = selected
    ? data.markers.find((marker) => marker.id === selected)
    : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !tooltip) return;
    const marker = tooltip;
    const update = () => {
      const point = map.project([marker.lon, marker.lat]);
      setTooltipPoint({
        x: point.x,
        y: point.y,
        width: frame.current?.clientWidth ?? 600,
      });
    };
    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [ready, tooltip]);

  return (
    <div
      ref={frame}
      className={cn("relative overflow-hidden bg-surface-inset", className)}
    >
      <div
        ref={canvas}
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-stride",
          ready ? "opacity-100" : "opacity-0",
        )}
        role="img"
        aria-label={label}
      />
      {!ready && (
        <svg
          viewBox="0 0 1000 420"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <path
            d={data.route
              .map(([lat, lon], index) => {
                const [[minLon, minLat], [maxLon, maxLat]] = bounds;
                const cosine = Math.cos(
                  (((minLat + maxLat) / 2) * Math.PI) / 180,
                );
                const spanX = Math.max((maxLon - minLon) * cosine, 1e-6);
                const spanY = Math.max(maxLat - minLat, 1e-6);
                const scale = Math.min(904 / spanX, 324 / spanY);
                const px =
                  48 +
                  (1000 - 96 - spanX * scale) / 2 +
                  (lon - minLon) * cosine * scale;
                const py =
                  420 - 48 - (324 - spanY * scale) / 2 - (lat - minLat) * scale;
                return `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
              })
              .join("")}
            fill="none"
            className="stroke-muted"
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        </svg>
      )}
      {ready && (
        <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-surface border border-border bg-surface/90">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Zoom avant"
            onClick={() => mapRef.current?.zoomIn()}
            className="rounded-none border-b border-border"
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Zoom arrière"
            onClick={() => mapRef.current?.zoomOut()}
            className="rounded-none border-b border-border"
          >
            <MinusIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Voir tout le parcours"
            onClick={() =>
              mapRef.current?.fitBounds(bounds, { padding, duration: 400 })
            }
            className="rounded-none"
          >
            <MaximizeIcon className="size-3.5" />
          </Button>
        </div>
      )}
      {tooltip && tooltipPoint && (
        <div
          className="pointer-events-none absolute z-10 flex min-w-40 flex-col gap-1 rounded-surface border border-border-strong bg-surface/95 px-3 py-2"
          style={{
            left: Math.min(tooltipPoint.x + 14, tooltipPoint.width - 190),
            top: Math.max(8, tooltipPoint.y - 64),
          }}
        >
          <MonoLabel size="nano">
            {tooltip.name} · km {formatKm(tooltip.distanceM)}
          </MonoLabel>
          <span className="flex items-baseline justify-between gap-4">
            {tooltip.clock ? (
              <span className="font-metric text-lg leading-none font-semibold">
                Passage {tooltip.clock}
              </span>
            ) : (
              <span className="text-sm text-muted">Pas de simulation</span>
            )}
            {tooltip.cutoff && (
              <MonoLabel size="micro" tone="warning">
                BH {tooltip.cutoff}
              </MonoLabel>
            )}
          </span>
        </div>
      )}
      {failed && !ready && (
        <span
          role="status"
          className="absolute top-3 left-3 rounded-control bg-surface px-2 py-1 text-xs text-muted"
        >
          Carte indisponible · tracé affiché
        </span>
      )}
      <span className="absolute right-2.5 bottom-2 font-mono text-nano text-muted-foreground uppercase">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          © OpenStreetMap
        </a>
        {" · "}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          © CARTO
        </a>
        {" · MapLibre"}
      </span>
    </div>
  );
}

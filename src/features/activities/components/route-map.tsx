"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { CrosshairIcon, MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/features/activities/charts";
import {
  colorModes,
  gradientStops,
  lineGradient,
  rampColor,
  vertexColors,
  zoneHex,
  type ColorMode,
  type RoutePalette,
} from "@/features/activities/route-colors";
import type { RouteView } from "@/features/activities/track";

const styleUrl =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const workerUrl = new URL(
  "../../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  import.meta.url,
).toString();
const initialSize = { width: 800, height: 380 };
const padding = 56;
const hoverRadius = 28;
const niceDistances = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const kilometers = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

type Engine = "loading" | "map" | "fallback";
type Point = { x: number; y: number };

function projectFallback(view: RouteView, size: typeof initialSize) {
  const latitudes = view.route.map((point) => point[0]);
  const longitudes = view.route.map((point) => point[1]);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const cosine = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * cosine, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min(
    (size.width - padding * 2) / spanX,
    (size.height - padding * 2) / spanY,
  );
  const offsetX = (size.width - spanX * scale) / 2;
  const offsetY = (size.height - spanY * scale) / 2;
  return {
    points: view.route.map(([latitude, longitude]): Point => ({
      x: offsetX + (longitude - minLon) * cosine * scale,
      y: size.height - offsetY - (latitude - minLat) * scale,
    })),
    metersPerPixel: 111_320 / scale,
  };
}

function scaleBar(metersPerPixel: number, maximumPixels = 72) {
  const target = metersPerPixel * maximumPixels;
  const meters = [...niceDistances].reverse().find((value) => value <= target);
  const value = meters ?? niceDistances[0];
  return {
    pixels: value / metersPerPixel,
    label: value >= 1000 ? `${value / 1000} km` : `${value} m`,
  };
}

function nearestVertex(points: Point[], x: number, y: number) {
  let best = -1;
  let distance = hoverRadius * hoverRadius;
  points.forEach((point, index) => {
    const squared = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (squared < distance) {
      distance = squared;
      best = index;
    }
  });
  return best === -1 ? null : best;
}

export function RouteMap({
  view,
  mode,
  modes,
  onModeChange,
  hover,
  onHover,
}: {
  view: RouteView;
  mode: ColorMode;
  modes: ColorMode[];
  onModeChange: (mode: ColorMode) => void;
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoverRef = useRef(onHover);
  const [engine, setEngine] = useState<Engine>("loading");
  const [palette, setPalette] = useState<RoutePalette>(zoneHex);
  const [size, setSize] = useState(initialSize);
  const [activeMap, setActiveMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    hoverRef.current = onHover;
  }, [onHover]);

  const fallback = useMemo(() => projectFallback(view, size), [view, size]);
  const colors = useMemo(
    () => vertexColors(view, mode, palette),
    [view, mode, palette],
  );

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
      const styles = getComputedStyle(element);
      const resolve = (token: string) => {
        const value = styles.getPropertyValue(token).trim();
        const reference = /^var\((--[\w-]+)\)$/.exec(value);
        return reference ? styles.getPropertyValue(reference[1]).trim() : value;
      };
      setPalette({
        1: resolve("--zone-1"),
        2: resolve("--zone-2"),
        3: resolve("--zone-3"),
        4: resolve("--zone-4"),
        5: resolve("--zone-5"),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | undefined;
    const markers: Marker[] = [];
    let frameId = 0;
    const timeout = setTimeout(() => {
      if (!disposed) setEngine("fallback");
    }, 12000);
    const container = canvas.current;
    if (!container) return;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed) return;
        maplibre.setWorkerUrl(workerUrl);
        const styles = getComputedStyle(container);
        const frameBackground = styles.getPropertyValue("--background").trim();
        const latitudes = view.route.map((point) => point[0]);
        const longitudes = view.route.map((point) => point[1]);
        map = new maplibre.Map({
          container,
          style: styleUrl,
          bounds: [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)],
          ],
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
        current.on("error", () => {
          if (!disposed) setEngine("fallback");
        });
        current.on("load", () => {
          if (disposed) return;
          clearTimeout(timeout);
          if (current.getLayer("background"))
            current.setPaintProperty(
              "background",
              "background-color",
              frameBackground,
            );
          const line = {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: view.route.map(([latitude, longitude]) => [
                longitude,
                latitude,
              ]),
            },
          };
          current.addSource("route", {
            type: "geojson",
            data: line,
            lineMetrics: true,
          });
          current.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": frameBackground, "line-width": 6.5 },
          });
          current.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-width": 3,
              "line-gradient": lineGradient(view, "zones"),
            },
          });
          current.addSource("hover", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          current.addLayer({
            id: "hover-point",
            type: "circle",
            source: "hover",
            paint: {
              "circle-radius": 6,
              "circle-color": styles.getPropertyValue("--foreground").trim(),
              "circle-stroke-color": frameBackground,
              "circle-stroke-width": 2,
            },
          });
          const first = view.route[0];
          const last = view.route[view.route.length - 1];
          const closed =
            Math.hypot(
              (first[0] - last[0]) * 111_320,
              (first[1] - last[1]) *
                111_320 *
                Math.cos((first[0] * Math.PI) / 180),
            ) < 120;
          const marker = (
            point: [number, number],
            label: string,
            start: boolean,
          ) => {
            const element = document.createElement("div");
            element.className = "pointer-events-none relative size-0";
            const dot = document.createElement("span");
            dot.className = cn(
              "absolute top-0 left-0 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
              start ? "bg-success" : "bg-foreground",
            );
            const text = document.createElement("span");
            text.className =
              "absolute top-1.5 left-2.5 font-mono text-nano whitespace-nowrap text-muted uppercase";
            text.textContent = label;
            element.append(dot, text);
            markers.push(
              new maplibre.Marker({ element })
                .setLngLat([point[1], point[0]])
                .addTo(current),
            );
          };
          marker(first, closed ? "Départ · arrivée" : "Départ", true);
          if (!closed) marker(last, "Arrivée", false);
          setActiveMap(current);
          setEngine("map");
        });
        const project = (index: number) => {
          const [latitude, longitude] = view.route[index];
          const projected = current.project([longitude, latitude]);
          return { x: projected.x, y: projected.y };
        };
        const pick = (x: number, y: number) =>
          nearestVertex(
            view.route.map((_, index) => project(index)),
            x,
            y,
          );
        current.on("mousemove", (event) =>
          hoverRef.current(pick(event.point.x, event.point.y)),
        );
        current.on("mouseout", () => hoverRef.current(null));
        current.on("click", (event) =>
          hoverRef.current(pick(event.point.x, event.point.y)),
        );

        current.on("move", () => {
          cancelAnimationFrame(frameId);
          frameId = requestAnimationFrame(() => setTick((value) => value + 1));
        });
      } catch {
        if (!disposed) setEngine("fallback");
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      cancelAnimationFrame(frameId);
      markers.forEach((marker) => marker.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "map" || !map?.getLayer("route-line")) return;
    map.setPaintProperty(
      "route-line",
      "line-gradient",
      lineGradient(view, mode, palette),
    );
  }, [engine, mode, view, palette]);

  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "map") return;
    const source = map?.getSource("hover");
    if (!source || !("setData" in source)) return;
    const geojson = source as {
      setData: (data: GeoJSON.FeatureCollection) => void;
    };
    if (hover === null) {
      geojson.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const [latitude, longitude] = view.route[hover];
    geojson.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [longitude, latitude] },
        },
      ],
    });
  }, [engine, hover, view]);

  const pointOf = useCallback(
    (index: number): Point => {
      const map = activeMap;
      if (engine === "map" && map) {
        const [latitude, longitude] = view.route[index];
        const projected = map.project([longitude, latitude]);
        return { x: projected.x, y: projected.y };
      }
      return fallback.points[index];
    },
    [engine, activeMap, fallback.points, view.route],
  );

  const map = activeMap;
  const metersPerPixel =
    engine === "map" && map
      ? (40_075_016.686 * Math.cos((map.getCenter().lat * Math.PI) / 180)) /
        (512 * 2 ** map.getZoom())
      : fallback.metersPerPixel;
  const bar = scaleBar(metersPerPixel);
  const tooltipPoint = hover !== null ? pointOf(hover) : null;
  const band =
    hover !== null
      ? view.bands.find(
          (item) =>
            view.fractions[hover] >= item.from &&
            view.fractions[hover] <= item.to,
        )
      : undefined;
  const lastIndex = view.route.length - 1;
  const showFlipped = tooltipPoint ? tooltipPoint.x > size.width - 190 : false;

  return (
    <div
      ref={frame}
      className="absolute inset-0 overflow-hidden bg-surface-inset"
    >
      <svg
        className={cn(
          "absolute inset-0 size-full touch-pan-y transition-opacity duration-300 ease-stride",
          engine === "map" && "pointer-events-none opacity-0",
        )}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`Tracé GPS, ${kilometers.format(view.distanceKm)} km`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onHover(
            nearestVertex(
              fallback.points,
              event.clientX - rect.left,
              event.clientY - rect.top,
            ),
          );
        }}
        onPointerLeave={() => onHover(null)}
      >
        <path
          d={fallback.points
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
            )
            .join("")}
          fill="none"
          className="stroke-background"
          strokeWidth={6.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {fallback.points.slice(1).map((point, index) => (
          <path
            key={index}
            d={`M${fallback.points[index].x.toFixed(1)},${fallback.points[index].y.toFixed(1)}L${point.x.toFixed(1)},${point.y.toFixed(1)}`}
            stroke={colors[index]}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <circle
          cx={fallback.points[0].x}
          cy={fallback.points[0].y}
          r={5}
          className="fill-success stroke-background"
          strokeWidth={2}
        />
        <circle
          cx={fallback.points[lastIndex].x}
          cy={fallback.points[lastIndex].y}
          r={4}
          className="fill-foreground stroke-background"
          strokeWidth={2}
        />
        {engine !== "map" && hover !== null && (
          <circle
            cx={fallback.points[hover].x}
            cy={fallback.points[hover].y}
            r={6}
            className="fill-foreground stroke-background"
            strokeWidth={2}
          />
        )}
      </svg>
      <div
        ref={canvas}
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-stride",
          engine === "map" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div className="absolute top-3 left-3 flex max-w-[calc(100%-4rem)] flex-col items-start gap-2">
        {modes.length > 0 && (
          <ToggleGroup
            variant="segment"
            type="single"
            aria-label="Colorer le tracé par"
            value={mode}
            onValueChange={(value) => {
              if (modes.includes(value as ColorMode))
                onModeChange(value as ColorMode);
            }}
            className="flex-wrap gap-0.5 rounded-surface border border-border bg-surface/90 p-0.5"
          >
            {colorModes
              .filter((item) => modes.includes(item.mode))
              .map((item) => (
                <ToggleGroupItem
                  key={item.mode}
                  value={item.mode}
                  className="min-h-6.5 rounded-control border-0 px-2.5 py-0 text-xs data-[state=on]:bg-surface-raised"
                >
                  {item.label}
                </ToggleGroupItem>
              ))}
          </ToggleGroup>
        )}
        {engine === "fallback" && (
          <span
            role="status"
            className="rounded-control bg-surface px-2 py-1 text-xs text-muted"
          >
            Carte indisponible · tracé GPS affiché
          </span>
        )}
      </div>
      {engine === "map" && (
        <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-surface border border-border bg-surface/90">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Zoom avant"
            onClick={() => map?.zoomIn()}
            className="grid size-8 place-items-center border-b border-border text-muted hover:text-foreground"
          >
            <PlusIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Zoom arrière"
            onClick={() => map?.zoomOut()}
            className="grid size-8 place-items-center border-b border-border text-muted hover:text-foreground"
          >
            <MinusIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Orienter au nord"
            onClick={() => map?.resetNorth()}
            className="grid size-8 place-items-center border-b border-border"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 1.5 L9.6 7 H4.4Z" className="fill-danger" />
              <path
                d="M7 12.5 L4.4 7 H9.6Z"
                className="fill-muted-foreground"
              />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Recentrer le tracé"
            onClick={() => {
              const latitudes = view.route.map((point) => point[0]);
              const longitudes = view.route.map((point) => point[1]);
              map?.fitBounds(
                [
                  [Math.min(...longitudes), Math.min(...latitudes)],
                  [Math.max(...longitudes), Math.max(...latitudes)],
                ],
                { padding, duration: 400 },
              );
            }}
            className="grid size-8 place-items-center text-muted hover:text-foreground"
          >
            <CrosshairIcon className="size-3.5" />
          </Button>
        </div>
      )}
      {tooltipPoint && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col gap-0.5 rounded-surface border border-border-strong bg-surface/95 px-2.5 py-2"
          style={{
            left: showFlipped ? undefined : tooltipPoint.x + 14,
            right: showFlipped ? size.width - tooltipPoint.x + 14 : undefined,
            top: Math.max(8, Math.min(size.height - 70, tooltipPoint.y - 22)),
          }}
        >
          <MonoLabel size="nano">
            km {kilometers.format(view.km[hover])}
            {band ? ` · ${band.label}` : ""}
          </MonoLabel>
          <span className="flex items-baseline gap-2.5 font-metric font-semibold tabular-nums">
            {view.pace[hover] !== null && (
              <span className="text-lead">
                {formatClock(view.pace[hover]!)} /km
              </span>
            )}
            {view.heartRate[hover] !== null && (
              <span className="text-lead text-danger">
                {view.heartRate[hover]} bpm
              </span>
            )}
            {view.elevation[hover] !== null && (
              <span className="text-body text-muted-foreground">
                {Math.round(view.elevation[hover]!)} m
              </span>
            )}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-8 left-3 flex flex-col gap-1.5 sm:bottom-3">
        {modes.length > 0 && (
          <div className="flex w-fit items-center gap-0.5 rounded-control border border-border bg-surface/90 px-1.5 py-1">
            <MonoLabel size="nano" className="mr-1">
              {colorModes.find((item) => item.mode === mode)?.label}
            </MonoLabel>
            {mode === "zones"
              ? ([1, 2, 3, 4, 5] as const).map((zone) => (
                  <span
                    key={zone}
                    className="h-1.25 w-4 rounded-mark"
                    style={{ background: `var(--zone-${zone})` }}
                  />
                ))
              : [0, 0.25, 0.5, 0.75, 1].map((value) => (
                  <span
                    key={value}
                    className="h-1.25 w-4 rounded-mark"
                    style={{ background: rampColor(value, palette) }}
                  />
                ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <span
            className="h-1.25 border border-t-0 border-muted-foreground"
            style={{ width: bar.pixels }}
          />
          <MonoLabel size="nano">{bar.label}</MonoLabel>
        </div>
      </div>
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
      {engine === "loading" && (
        <span className="sr-only">Chargement de la carte</span>
      )}
      <span className="sr-only" aria-live="polite">
        {gradientStops(view, mode).length > 0
          ? `Tracé coloré par ${colorModes.find((item) => item.mode === mode)?.label}`
          : ""}
      </span>
    </div>
  );
}

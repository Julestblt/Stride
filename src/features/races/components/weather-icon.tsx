import { cn } from "@/lib/utils";
import type { Glyph } from "../weather";

export function WeatherGlyph({ glyph }: { glyph: Glyph }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinejoin: "round" as const,
  };
  switch (glyph) {
    case "moon":
      return (
        <path d="M11.8 10.6A5 5 0 0 1 5.4 4.2A5 5 0 1 0 11.8 10.6Z" {...line} />
      );
    case "sun":
      return (
        <>
          <circle cx="8" cy="8" r="3" {...line} />
          <path
            d="M8 1.5V3 M8 13V14.5 M1.5 8H3 M13 8H14.5 M3.4 3.4L4.4 4.4 M11.6 11.6L12.6 12.6 M3.4 12.6L4.4 11.6 M11.6 4.4L12.6 3.4"
            stroke="currentColor"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </>
      );
    case "partly":
      return (
        <>
          <path
            d="M5 4.2A2.6 2.6 0 0 1 9.6 3.4 M5.2 1.2V2 M1.9 3.6L2.6 4.1 M8.9 1.6L8.4 2.3"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M5 13.5H11.8A2.7 2.7 0 0 0 11.5 8.1A3.6 3.6 0 0 0 4.7 9.1A2.2 2.2 0 0 0 5 13.5Z"
            {...line}
          />
        </>
      );
    case "rain":
      return (
        <>
          <path
            d="M4.5 9.5H11.5A2.8 2.8 0 0 0 11.2 3.9A3.8 3.8 0 0 0 3.9 5A2.3 2.3 0 0 0 4.5 9.5Z"
            {...line}
          />
          <path
            d="M5.5 11.5L4.8 13.5 M8.5 11.5L7.8 13.5 M11.3 11.5L10.6 13.5"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      );
    default:
      return (
        <path
          d="M4.5 12.5H11.5A3 3 0 0 0 11.2 6.5A4 4 0 0 0 3.6 7.6A2.5 2.5 0 0 0 4.5 12.5Z"
          {...line}
        />
      );
  }
}

export function glyphTone(glyph: Glyph) {
  return glyph === "moon"
    ? "text-night"
    : glyph === "rain"
      ? "text-provider"
      : "text-muted";
}

export function WeatherIcon({
  glyph,
  className,
  tone = true,
}: {
  glyph: Glyph;
  className?: string;
  tone?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-4 shrink-0", tone && glyphTone(glyph), className)}
    >
      <WeatherGlyph glyph={glyph} />
    </svg>
  );
}

import { cn } from "@/lib/utils";
import type { Glyph } from "../weather";

const outline = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

const cloud =
  "M4.6 13.2H11.6A2.8 2.8 0 0 0 11.4 7.6A3.9 3.9 0 0 0 4 8.6A2.3 2.3 0 0 0 4.6 13.2Z";

function Cloud({ d = cloud }: { d?: string }) {
  return (
    <path
      d={d}
      className="text-muted"
      fill="currentColor"
      fillOpacity={0.18}
      {...outline}
    />
  );
}

export function WeatherGlyph({ glyph }: { glyph: Glyph }) {
  switch (glyph) {
    case "moon":
      return (
        <path
          d="M12.2 10.4A5.2 5.2 0 0 1 5.6 3.8A5.2 5.2 0 1 0 12.2 10.4Z"
          className="text-night"
          fill="currentColor"
          fillOpacity={0.3}
          {...outline}
        />
      );
    case "sun":
      return (
        <g className="text-warning">
          <circle cx="8" cy="8" r="3" fill="currentColor" />
          <path
            d="M8 1.2V2.8 M8 13.2V14.8 M1.2 8H2.8 M13.2 8H14.8 M3.2 3.2L4.3 4.3 M11.7 11.7L12.8 12.8 M3.2 12.8L4.3 11.7 M11.7 4.3L12.8 3.2"
            {...outline}
          />
        </g>
      );
    case "partly":
      return (
        <>
          <g className="text-warning">
            <circle cx="5.6" cy="5.4" r="2.3" fill="currentColor" />
            <path
              d="M5.6 1V1.9 M1.2 5.4H2.1 M2.5 2.3L3.1 2.9 M8.7 2.3L8.1 2.9"
              {...outline}
              strokeWidth={1.4}
            />
          </g>
          <Cloud d="M5.4 14H12A2.6 2.6 0 0 0 11.8 8.8A3.5 3.5 0 0 0 5.2 9.7A2.1 2.1 0 0 0 5.4 14Z" />
        </>
      );
    case "rain":
      return (
        <>
          <Cloud d="M4.6 9.6H11.6A2.8 2.8 0 0 0 11.4 4A3.9 3.9 0 0 0 4 5A2.3 2.3 0 0 0 4.6 9.6Z" />
          <path
            d="M5.6 11.6L4.8 14 M8.6 11.6L7.8 14 M11.4 11.6L10.6 14"
            className="text-provider"
            {...outline}
            strokeWidth={1.8}
          />
        </>
      );
    default:
      return <Cloud />;
  }
}

export function WeatherIcon({
  glyph,
  className,
}: {
  glyph: Glyph;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      className={cn("size-5 shrink-0", className)}
    >
      <WeatherGlyph glyph={glyph} />
    </svg>
  );
}

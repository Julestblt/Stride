import { cn } from "@/lib/utils";

export type SessionTileKind =
  | "easy"
  | "recovery"
  | "long"
  | "long_trail"
  | "tempo"
  | "threshold"
  | "intervals"
  | "hills"
  | "fartlek"
  | "race_specific"
  | "strength"
  | "mobility"
  | "cross"
  | "race"
  | "rest";

type Tone =
  "provider" | "quality" | "terrain" | "support" | "cross" | "race" | "rest";

const glyphs: Record<SessionTileKind, React.ReactNode> = {
  easy: (
    <g transform="scale(.6667)" strokeWidth={2.25}>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4" />
      <path d="M4 13h4" />
    </g>
  ),
  recovery: (
    <>
      <path d="M3 13 C3 7 7 3 13 3 C13 9 9 13 3 13 Z" />
      <path d="M3 13 L9 7" />
    </>
  ),
  long: (
    <>
      <path d="M2.5 14 L6.5 2.5 M13.5 14 L9.5 2.5" />
      <path d="M8 13.5 V11.5 M8 9 V7.5 M8 5 V4" />
    </>
  ),
  long_trail: <path d="M1 13.5 L5.5 6 L8 9.5 L10.5 4.5 L15 13.5 Z" />,
  hills: (
    <>
      <path d="M1.5 13.5 H14.5" />
      <path d="M2.5 13.5 L11.5 4.5" />
      <path d="M7.5 4.5 H11.5 V8.5" />
    </>
  ),
  threshold: (
    <>
      <path d="M2 11.5 A6 6 0 0 1 14 11.5" />
      <path d="M8 11.5 L11.2 6.8" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" />
    </>
  ),
  intervals: (
    <path d="M1.5 11.5 H3.5 V4.5 H6 V11.5 H8 V4.5 H10.5 V11.5 H12.5 V4.5 H14.5" />
  ),
  fartlek: (
    <path d="M1.5 11.5 H3 V8 H4.5 V11.5 H6 V3.5 H9 V11.5 H10.5 V6.5 H12 V11.5 H14.5" />
  ),
  tempo: <path d="M3 4 L7 8 L3 12 M8.5 4 L12.5 8 L8.5 12" />,
  race_specific: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  race: (
    <>
      <path d="M4 14.5 V2" />
      <path d="M4 2.5 H13 L11 5.75 L13 9 H4" />
    </>
  ),
  strength: (
    <path d="M1.5 6 V10 M4 4.5 V11.5 M12 4.5 V11.5 M14.5 6 V10 M4 8 H12" />
  ),
  mobility: (
    <>
      <circle cx="8" cy="3" r="1.3" />
      <path d="M2.5 6.5 L8 5.5 L13.5 6.5 M8 5.5 V9.5 L5 14 M8 9.5 L11 14" />
    </>
  ),
  cross: (
    <>
      <circle cx="4" cy="11" r="2.8" />
      <circle cx="12" cy="11" r="2.8" />
      <path d="M4 11 L6.5 5.5 H10 L12 11 M6.5 5.5 L8.5 11 H4" />
    </>
  ),
  rest: <path d="M3.5 8 H12.5" />,
};

const tones: Record<SessionTileKind, Tone> = {
  easy: "provider",
  recovery: "provider",
  long: "provider",
  long_trail: "terrain",
  hills: "terrain",
  tempo: "quality",
  threshold: "quality",
  intervals: "quality",
  fartlek: "quality",
  race_specific: "quality",
  strength: "support",
  mobility: "support",
  cross: "cross",
  race: "race",
  rest: "rest",
};

const toneClasses: Record<Tone, string> = {
  provider: "border border-provider/30 bg-provider/14 text-provider",
  quality: "border border-zone-4/30 bg-zone-4/14 text-zone-4",
  terrain: "border border-zone-3/30 bg-zone-3/14 text-zone-3",
  support: "border border-muted/30 bg-muted/14 text-muted",
  cross: "border border-night/30 bg-night/14 text-night",
  race: "bg-accent text-accent-foreground",
  rest: "border border-dashed border-border-strong text-dim",
};

const sizes = {
  xs: "size-4.5 rounded-[4px] [&_svg]:size-2.5",
  sm: "size-5 rounded-tag [&_svg]:size-2.75",
  md: "size-6.5 rounded-control [&_svg]:size-3.5",
  lg: "size-8 rounded-surface [&_svg]:size-4",
  xl: "size-11 rounded-[11px] [&_svg]:size-6",
} as const;

export function SessionKindTile({
  kind,
  label,
  size = "sm",
  className,
}: {
  kind: SessionTileKind;
  label?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      data-slot="session-kind-tile"
      data-kind={kind}
      title={label}
      className={cn(
        "grid shrink-0 place-items-center",
        toneClasses[tones[kind]],
        sizes[size],
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={kind === "race" ? 1.7 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyphs[kind]}
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

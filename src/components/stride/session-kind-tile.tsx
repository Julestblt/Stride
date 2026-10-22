import {
  BikeIcon,
  ChartNoAxesColumnIcon,
  ChevronsRightIcon,
  DumbbellIcon,
  FlagIcon,
  FootprintsIcon,
  GaugeIcon,
  MinusIcon,
  MountainIcon,
  PersonStandingIcon,
  RouteIcon,
  TargetIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionTileKind =
  | "easy"
  | "long"
  | "long_trail"
  | "tempo"
  | "threshold"
  | "intervals"
  | "hills"
  | "race_specific"
  | "strength"
  | "mobility"
  | "cross"
  | "race"
  | "rest";

type Tone = "provider" | "quality" | "terrain" | "support" | "race" | "rest";

const kinds: Record<SessionTileKind, { icon: LucideIcon; tone: Tone }> = {
  easy: { icon: FootprintsIcon, tone: "provider" },
  long: { icon: RouteIcon, tone: "provider" },
  long_trail: { icon: MountainIcon, tone: "terrain" },
  tempo: { icon: ChevronsRightIcon, tone: "quality" },
  threshold: { icon: GaugeIcon, tone: "quality" },
  intervals: { icon: ChartNoAxesColumnIcon, tone: "quality" },
  hills: { icon: TrendingUpIcon, tone: "terrain" },
  race_specific: { icon: TargetIcon, tone: "quality" },
  strength: { icon: DumbbellIcon, tone: "support" },
  mobility: { icon: PersonStandingIcon, tone: "support" },
  cross: { icon: BikeIcon, tone: "support" },
  race: { icon: FlagIcon, tone: "race" },
  rest: { icon: MinusIcon, tone: "rest" },
};

const tones: Record<Tone, string> = {
  provider: "border border-provider/30 bg-provider/14 text-provider",
  quality: "border border-zone-4/30 bg-zone-4/14 text-zone-4",
  terrain: "border border-zone-3/30 bg-zone-3/14 text-zone-3",
  support: "border border-muted/30 bg-muted/14 text-muted",
  race: "bg-accent text-accent-foreground",
  rest: "border border-dashed border-border-strong text-dim",
};

const sizes = {
  xs: "size-4.5 rounded-[4px] [&_svg]:size-2.5",
  sm: "size-5 rounded-tag [&_svg]:size-2.75",
  md: "size-6.5 rounded-control [&_svg]:size-3.5",
  lg: "size-8 rounded-surface [&_svg]:size-4",
  xl: "size-11 rounded-[11px] [&_svg]:size-5",
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
  const { icon: Icon, tone } = kinds[kind];
  return (
    <span
      data-slot="session-kind-tile"
      data-kind={kind}
      title={label}
      className={cn(
        "grid shrink-0 place-items-center",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={kind === "race" ? 2.2 : 1.8} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

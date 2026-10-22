import { cn } from "@/lib/utils";
import {
  summarizeSession,
  zoneHeights,
  type SessionBlock,
  type Zone,
} from "@/components/stride/session-blocks";

export const zoneFills: Record<Zone, string> = {
  1: "bg-zone-1",
  2: "bg-zone-2",
  3: "bg-zone-3",
  4: "bg-zone-4",
  5: "bg-zone-5",
};

const surges = [
  [7, 18],
  [6, 50],
  [9, 18],
  [5, 75],
  [11, 20],
  [14, 100],
  [8, 20],
  [6, 55],
  [8, 20],
  [6, 85],
  [8, 20],
  [5, 45],
  [7, 18],
] as const;

export function FreeBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      data-free=""
      className={cn(
        "flex h-full min-w-0.5 items-end gap-px rounded-mark border border-dashed border-zone-4/45 bg-zone-4/8 px-px",
        className,
      )}
      style={style}
    >
      {surges.map(([grow, height], index) => (
        <span
          key={index}
          className={cn(
            "min-w-px rounded-[1.5px]",
            height > 20 ? "bg-zone-4" : "bg-zone-1",
          )}
          style={{ flexGrow: grow, flexBasis: 0, height: `${height}%` }}
        />
      ))}
    </span>
  );
}

export function SessionShape({
  blocks,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  blocks: readonly SessionBlock[];
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ?? summarizeSession(blocks)}
      data-slot="session-shape"
      className={cn("flex h-9 items-end gap-0.5", className)}
      {...props}
    >
      {blocks.map((block, index) =>
        block.free && !block.removed ? (
          <FreeBlock
            key={index}
            style={{ flexGrow: Math.max(block.minutes, 0), flexBasis: 0 }}
          />
        ) : (
          <span
            key={index}
            data-zone={block.zone}
            data-removed={block.removed || undefined}
            className={cn(
              "min-w-0.5 rounded-mark",
              block.removed
                ? "border border-dashed border-dim"
                : zoneFills[block.zone],
            )}
            style={{
              flexGrow: Math.max(block.minutes, 0),
              flexBasis: 0,
              height: `${zoneHeights[block.zone]}%`,
            }}
          />
        ),
      )}
    </div>
  );
}

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
      {blocks.map((block, index) => (
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
      ))}
    </div>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";
import claire from "../portraits/claire.webp";
import ines from "../portraits/ines.webp";
import { portraitCrop } from "../portrait-crop";
import { staff, type StaffAgent } from "../staff";

const portraits = { coach: claire, medical: ines } as const;

function radius(size: number) {
  if (size <= 22) return "rounded-mark";
  if (size <= 30) return "rounded-[4px]";
  if (size <= 40) return "rounded-control";
  if (size <= 48) return "rounded-[10px]";
  return "rounded-panel";
}

export function StaffPortrait({
  agent,
  size,
  decorative = false,
  className,
}: {
  agent: StaffAgent;
  size: number;
  decorative?: boolean;
  className?: string;
}) {
  const crop = portraitCrop(size);
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "block shrink-0 overflow-hidden bg-surface",
        radius(size),
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={portraits[agent]}
        alt={decorative ? "" : staff[agent].alt}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="block size-full object-cover"
        style={
          crop
            ? {
                transform: `scale(${crop.scale})`,
                transformOrigin: `50% ${crop.originY}`,
              }
            : undefined
        }
      />
    </span>
  );
}

export function StaffStack({
  agents,
  size,
  className,
}: {
  agents: readonly StaffAgent[];
  size: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("flex", className)}>
      {agents.map((agent, index) => (
        <StaffPortrait
          key={agent}
          agent={agent}
          size={size}
          decorative
          className={cn("ring-2 ring-surface-inset", index > 0 && "-ml-1.5")}
        />
      ))}
    </span>
  );
}

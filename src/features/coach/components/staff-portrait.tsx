"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import claire from "../portraits/claire.webp";
import ines from "../portraits/ines.webp";
import karim from "../portraits/karim.webp";
import thomas from "../portraits/thomas.webp";
import { portraitCrop, portraitSourceSize } from "../portrait-crop";
import { staffMember, type StaffAgent, type StaffFace } from "../staff";
import { useStaff } from "./staff-context";

const portraits = { claire, thomas, ines, karim } as const satisfies Record<
  StaffFace,
  unknown
>;

const portraitQuality = 90;

function radius(size: number) {
  if (size <= 22) return "rounded-mark";
  if (size <= 30) return "rounded-[4px]";
  if (size <= 40) return "rounded-control";
  if (size <= 48) return "rounded-[10px]";
  if (size <= 64) return "rounded-panel";
  if (size <= 80) return "rounded-[20px]";
  if (size <= 100) return "rounded-[28px]";
  return "rounded-[56px]";
}

export function StaffPortrait({
  agent,
  face,
  size,
  fill = false,
  decorative = false,
  className,
}: {
  agent: StaffAgent;
  face?: StaffFace;
  size: number;
  fill?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const current = useStaff()[agent];
  const member = face ? staffMember(agent, face) : current;
  const crop = fill ? null : portraitCrop(size);
  const source = fill ? size : portraitSourceSize(size);
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "relative block shrink-0 overflow-hidden bg-surface",
        fill ? "size-full" : radius(size),
        className,
      )}
      style={fill ? undefined : { width: size, height: size }}
    >
      <Image
        src={portraits[member.face]}
        alt={decorative ? "" : member.alt}
        {...(fill ? { fill: true } : { width: source, height: source })}
        sizes={`${source}px`}
        quality={portraitQuality}
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

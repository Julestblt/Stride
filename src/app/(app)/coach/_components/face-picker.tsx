"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { useStaff } from "@/features/coach/components/staff-context";
import {
  staffFaceOptions,
  staffMember,
  type StaffAgent,
  type StaffFace,
} from "@/features/coach/staff";
import { chooseStaffFace } from "@/server/coaching/actions";

export function FacePicker({
  agent,
  className,
}: {
  agent: StaffAgent;
  className?: string;
}) {
  const current = useStaff()[agent];
  const [face, setFace] = useOptimistic<StaffFace>(current.face);
  const [, start] = useTransition();

  function choose(next: StaffFace) {
    if (next === face) return;
    start(async () => {
      setFace(next);
      const result = await chooseStaffFace({ agent, face: next });
      if (!result.ok) toast.error("Le visage n’a pas pu être enregistré.");
    });
  }

  return (
    <div
      role="group"
      aria-label={`Visage de ${current.role.toLowerCase()}`}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {staffFaceOptions[agent].map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === face}
          onClick={() => choose(option)}
          className="flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border py-0.75 pr-2.5 pl-0.75 text-meta text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground aria-pressed:border-foreground aria-pressed:text-foreground md:min-h-8 md:rounded-[9px] md:pr-2 md:text-xs"
        >
          <StaffPortrait
            agent={agent}
            face={option}
            size={28}
            decorative
            className="md:hidden"
          />
          <StaffPortrait
            agent={agent}
            face={option}
            size={24}
            decorative
            className="max-md:hidden"
          />
          {staffMember(agent, option).name}
        </button>
      ))}
    </div>
  );
}

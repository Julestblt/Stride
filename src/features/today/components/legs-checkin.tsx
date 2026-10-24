"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { legsOptions, type Legs } from "@/features/progress/recovery";
import { legsLabels } from "@/features/progress/recovery-view";
import { saveCheckin } from "@/server/progress/actions";

const errors = {
  invalid: "Cette réponse n’est pas valide.",
  error: "Enregistrement impossible. Réessaie dans un instant.",
  "session-expired": "Ta session a expiré. Reconnecte-toi pour enregistrer.",
} as const;

const order = [...legsOptions].reverse();

export function LegsCheckin({
  initial,
  hint,
}: {
  initial: Legs | null;
  hint: string;
}) {
  const [legs, setLegs] = useState<Legs | null>(initial);
  const [, start] = useTransition();

  function answer(value: Legs) {
    const before = legs;
    setLegs(value);
    start(async () => {
      const result = await saveCheckin({ field: "legs", value });
      if (result.status === "saved") {
        toast.success("Ressenti enregistré.", { id: "today-legs" });
        return;
      }
      setLegs(before);
      toast.error(errors[result.status], { id: "today-legs" });
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex flex-col gap-0.5">
        <span id="today-legs" className="text-[15px] font-semibold">
          Et tes jambes ce matin ?
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
      <ToggleGroup
        type="single"
        variant="choice"
        aria-labelledby="today-legs"
        value={legs ?? ""}
        onValueChange={(value) => {
          const option = legsOptions.find((item) => item === value);
          if (option) answer(option);
        }}
        className="grid grid-cols-3 gap-1.5"
      >
        {order.map((option) => (
          <ToggleGroupItem key={option} value={option} className="min-h-11">
            {legsLabels[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

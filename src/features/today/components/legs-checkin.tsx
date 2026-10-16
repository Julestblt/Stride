"use client";

import { useState, useTransition } from "react";
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

export function LegsCheckin({ initial }: { initial: Legs | null }) {
  const [legs, setLegs] = useState<Legs | null>(initial);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function answer(value: Legs) {
    const before = legs;
    setLegs(value);
    start(async () => {
      const result = await saveCheckin({ field: "legs", value });
      if (result.status === "saved") setError("");
      else {
        setLegs(before);
        setError(errors[result.status]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <span id="today-legs" className="text-[13px]">
        Et tes jambes ce matin ?
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
          <ToggleGroupItem key={option} value={option}>
            {legsLabels[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

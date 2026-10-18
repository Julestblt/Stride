"use client";

import { useState } from "react";
import { ActivityIcon, CalendarIcon, FlagIcon } from "lucide-react";
import { ContextChip, ContextChipLink } from "@/components/stride/context-chip";

const examples = [
  {
    key: "activity",
    icon: <ActivityIcon />,
    label: "Sortie longue vallonnée",
    meta: "04/10/2026",
  },
  {
    key: "session",
    icon: <CalendarIcon />,
    label: "Seuil 3 × 10 min",
    meta: "09/10/2026",
  },
];

export function ContextChipsExample() {
  const [chips, setChips] = useState(examples);
  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Contexte joint au message"
        className="flex flex-wrap gap-1.5"
      >
        {chips.map((chip) => (
          <li key={chip.key} className="flex max-w-full">
            <ContextChip
              icon={chip.icon}
              label={chip.label}
              meta={chip.meta}
              removeLabel={`Retirer ${chip.label} du contexte`}
              onRemove={() =>
                setChips((current) =>
                  current.filter((item) => item.key !== chip.key),
                )
              }
            />
          </li>
        ))}
      </ul>
      <ul aria-label="Contexte joint" className="flex flex-wrap gap-1.5">
        <li className="flex max-w-full">
          <ContextChipLink
            href="/races"
            icon={<FlagIcon />}
            label="Trail des Lacs"
            meta="27/06/2027"
          />
        </li>
      </ul>
    </div>
  );
}

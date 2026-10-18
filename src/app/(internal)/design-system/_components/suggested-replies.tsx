"use client";

import { useState } from "react";
import { SuggestedReplies } from "@/components/stride/suggested-reply";

const replies = [
  "Pourquoi ce changement ?",
  "Quel impact sur ma semaine ?",
  "Propose une autre option",
];

export function SuggestedRepliesExample() {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SuggestedReplies replies={replies} onSelect={setChosen} />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {chosen ? `Envoyé : ${chosen}` : "Aucune réponse envoyée"}
      </p>
    </div>
  );
}

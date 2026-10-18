"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

export function CopyProgramButton({ text }: { text: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Programme copié", {
        id: "copy-program",
        description:
          "Colle-le dans l’IA de ton choix pour lui demander un second avis.",
      });
    } catch {
      toast.error("Le programme n’a pas pu être copié. Réessaie.", {
        id: "copy-program",
      });
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex min-h-9 shrink-0 items-center gap-2 rounded-surface border border-border px-3 text-[13px] text-muted hover:text-foreground max-sm:min-h-11"
    >
      <CopyIcon aria-hidden="true" className="size-3.5" />
      <span>
        Copier<span className="max-sm:sr-only"> le programme</span>
      </span>
    </button>
  );
}

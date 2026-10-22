"use client";

import { useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PanelCheckIn } from "@/features/plans/view/session-panel";
import {
  checkInSession,
  undoCheckIn,
  type CheckInActionResult,
} from "@/server/plans/check-in";

const errors: Record<
  Exclude<CheckInActionResult["status"], "checked-in" | "undone">,
  string
> = {
  "not-due": "Cette séance n’est pas encore passée.",
  "not-found": "Séance introuvable. Recharge la page puis réessaie.",
  "invalid-request": "Cette séance ne peut pas être notée comme faite.",
  "session-expired": "Ta session a expiré. Reconnecte-toi puis réessaie.",
  error: "Enregistrement impossible. Réessaie dans un instant.",
};

export function SessionCheckInButton({
  planId,
  sessionKey,
  checkIn,
  className,
}: {
  planId: string;
  sessionKey: string;
  checkIn: PanelCheckIn;
  className?: string;
}) {
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const input = { planId, sessionKey };
      const result = await (
        checkIn.done ? undoCheckIn(input) : checkInSession(input)
      ).catch((): CheckInActionResult => ({ status: "error" }));
      const id = `check-in-${sessionKey}`;
      if (result.status === "checked-in")
        toast.success("Séance notée comme faite", { id });
      else if (result.status === "undone")
        toast.success("C’est fait annulé", { id });
      else toast.error(errors[result.status], { id });
    });
  }

  if (checkIn.done)
    return (
      <Button
        type="button"
        variant="outline"
        size="md"
        disabled={pending}
        aria-busy={pending}
        onClick={submit}
        className={cn("rounded-control", className)}
      >
        Annuler « C’est fait »
      </Button>
    );
  return (
    <Button
      type="button"
      size="md"
      disabled={pending}
      aria-busy={pending}
      onClick={submit}
      className={cn("rounded-control", className)}
    >
      <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      C’est fait
    </Button>
  );
}

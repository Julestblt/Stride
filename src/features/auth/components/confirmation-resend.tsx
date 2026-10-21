"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  initialAuthState,
  type AuthAction,
  type AuthState,
} from "@/features/auth/schemas";

export function ConfirmationResend({
  action,
  email,
  sentAt,
}: {
  action: AuthAction;
  email: string;
  sentAt?: number;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: AuthState, data: FormData) => {
      const result = await action(previous, data);
      if (result.status === "success")
        toast.success(
          result.message ?? "Un nouveau lien de confirmation est parti.",
          { id: "confirmation-resend" },
        );
      else
        toast.error(
          result.message ??
            "Impossible d’envoyer un nouveau lien. Attends une minute et réessaie.",
          { id: "confirmation-resend" },
        );
      return result;
    },
    initialAuthState,
  );
  const [seconds, setSeconds] = useState(0);
  const latest = state.sentAt ?? sentAt;

  useEffect(() => {
    if (!latest) return;
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((latest + 60000 - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [latest]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending || seconds > 0}
        className="w-full"
      >
        {pending ? "Envoi…" : "Renvoyer l’e-mail"}
      </Button>
      {seconds > 0 && (
        <p className="text-center text-sm text-muted">
          Renvoi possible dans 0:{String(seconds).padStart(2, "0")}
        </p>
      )}
    </form>
  );
}

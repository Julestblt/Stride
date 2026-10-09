"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "./form-controls";
import { initialAuthState, type AuthAction } from "@/features/auth/schemas";

export function ConfirmationResend({
  action,
  email,
  sentAt,
}: {
  action: AuthAction;
  email: string;
  sentAt?: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
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
        {pending ? "Sending…" : "Resend email"}
      </Button>
      {seconds > 0 && (
        <p className="text-center text-sm text-muted">
          Resend available in 0:{String(seconds).padStart(2, "0")}
        </p>
      )}
      <FormFeedback state={state} />
    </form>
  );
}

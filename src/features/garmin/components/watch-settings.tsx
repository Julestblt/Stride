"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { WatchAction } from "@/features/garmin/watch";
import { setWatchWorkoutsEnabled } from "@/server/garmin/watch-actions";
import { failureMessage, useWatchSend } from "./watch-status";

export function WatchToggle({
  enabled,
  disabled = false,
}: {
  enabled: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(enabled);
  const [pending, start] = useTransition();
  function change(next: boolean) {
    setChecked(next);
    start(async () => {
      const result = await setWatchWorkoutsEnabled({ enabled: next }).catch(
        () => ({ status: "error" as const }),
      );
      if (result.status === "invalid" || result.status === "error") {
        setChecked(!next);
        toast.error("Le réglage n’a pas pu être enregistré. Réessaie.", {
          id: "watch-toggle",
        });
        return;
      }
      if (!next && result.status !== "disabled") setChecked(true);
      const message = failureMessage(result);
      if (message) toast.error(message, { id: "watch-toggle" });
    });
  }
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-border py-3.25">
      <span id="watch-toggle-label">
        Envoyer les séances prévues à ta montre
      </span>
      <Switch
        checked={checked}
        disabled={disabled || pending}
        onCheckedChange={change}
        aria-labelledby="watch-toggle-label"
        aria-describedby="watch-toggle-detail"
      />
      <span
        id="watch-toggle-detail"
        className="col-span-full text-xs leading-normal text-muted-foreground"
      >
        {pending && checked
          ? "Envoi vers ta montre…"
          : "Tes séances de course et de trail des 7 prochains jours, tenues à jour quand ton plan change. La seule chose que Stride écrit sur Garmin."}
      </span>
    </div>
  );
}

export function WatchRowAction({
  sessionKey,
  action,
  label,
}: {
  sessionKey: string;
  action: WatchAction;
  label: string;
}) {
  const { pending, send } = useWatchSend(sessionKey);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => send(action)}
      className="rounded-control text-[13px] max-sm:h-11"
    >
      {pending ? "Envoi…" : label}
    </Button>
  );
}

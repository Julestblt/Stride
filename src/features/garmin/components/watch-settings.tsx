"use client";

import { useState, useTransition } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  function change(next: boolean) {
    setChecked(next);
    setMessage(null);
    start(async () => {
      const result = await setWatchWorkoutsEnabled({ enabled: next }).catch(
        () => ({ status: "error" as const }),
      );
      if (result.status === "invalid" || result.status === "error") {
        setChecked(!next);
        setMessage("Le réglage n’a pas pu être enregistré. Réessaie.");
        return;
      }
      if (!next && result.status !== "disabled") setChecked(true);
      setMessage(failureMessage(result));
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
      {message && (
        <p role="alert" className="col-span-full text-xs text-danger">
          {message}
        </p>
      )}
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
  const { pending, message, send } = useWatchSend(sessionKey);
  return (
    <span className="flex flex-col items-end gap-1">
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
      {message && (
        <span role="alert" className="text-xs text-danger">
          {message}
        </span>
      )}
    </span>
  );
}

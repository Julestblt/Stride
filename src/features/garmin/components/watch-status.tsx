"use client";

import { useTransition } from "react";
import { WatchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WatchAction, WatchCopy } from "@/features/garmin/watch";
import {
  sendSessionToWatch,
  type WatchActionResult,
} from "@/server/garmin/watch-actions";

const toneClasses: Record<WatchCopy["tone"], string> = {
  muted: "border-border bg-background",
  success: "border-border bg-background",
  warning: "border-warning-border bg-background",
  danger: "border-danger-border bg-danger-surface",
};
const iconTones: Record<WatchCopy["tone"], string> = {
  muted: "text-muted",
  success: "text-muted",
  warning: "text-warning",
  danger: "text-danger",
};

export function failureMessage(result: WatchActionResult) {
  switch (result.status) {
    case "synced":
    case "disabled":
      return null;
    case "reconnect":
      return "Reconnecte Garmin pour envoyer tes séances.";
    case "session-expired":
      return "Ta session a expiré. Reconnecte-toi pour continuer.";
    case "unavailable":
      return "Garmin n’a pas répondu. Réessaie dans un moment.";
    default:
      return "L’envoi n’a pas pu partir. Réessaie.";
  }
}

export function WatchStatusBlock({
  copy,
  pending = false,
  className,
}: {
  copy: WatchCopy;
  pending?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label="Montre"
      className={cn(
        "flex items-start gap-3 rounded-[10px] border px-3.5 py-3",
        toneClasses[copy.tone],
        className,
      )}
    >
      <WatchIcon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", iconTones[copy.tone])}
      />
      <span className="flex min-w-0 flex-col gap-0.75" role="status">
        <span className="text-[13.5px] font-semibold">
          {pending ? "Envoi vers ta montre…" : copy.title}
        </span>
        <span className="text-[12.5px] leading-snug text-muted-foreground">
          {pending
            ? "Elle apparaît à la prochaine synchro de la montre avec Garmin Connect."
            : copy.detail}
        </span>
      </span>
    </section>
  );
}

export function useWatchSend(sessionKey: string) {
  const [pending, start] = useTransition();
  function send(action: WatchAction) {
    start(async () => {
      const result = await sendSessionToWatch({ sessionKey, action }).catch(
        () => ({ status: "error" as const }),
      );
      const id = `watch-send-${sessionKey}`;
      if (result.status === "synced") {
        toast.success("Séance envoyée vers ta montre.", { id });
        return;
      }
      const message = failureMessage(result);
      if (message) toast.error(message, { id });
    });
  }
  return { pending, send };
}

export function WatchSendButton({
  action,
  pending,
  onSend,
  iconOnly = false,
  className,
}: {
  action: NonNullable<WatchCopy["action"]>;
  pending: boolean;
  onSend: (action: WatchAction) => void;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon-lg" : "md"}
      disabled={pending}
      aria-label={iconOnly ? action.label : undefined}
      onClick={() => onSend(action.kind)}
      className={cn("rounded-control", className)}
    >
      <WatchIcon aria-hidden="true" />
      {!iconOnly && action.label}
    </Button>
  );
}

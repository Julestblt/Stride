"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { clockLabel } from "@/features/garmin/settings-view";
import { cn } from "@/lib/utils";
import { useDataActivity } from "./provider";

export function useSyncRequest() {
  const activity = useDataActivity();
  if (!activity) return null;
  const { state, sync } = activity;
  const running = sync.progress !== null || state === "syncing";
  const blocked =
    state === "offline" || state === "reconnect" || state === "unavailable";
  return {
    ...sync,
    state,
    running,
    disabled: sync.pending || running || blocked || sync.availableAt !== null,
  };
}

export function SyncNowButton({
  className,
  variant = "neutral",
}: {
  className?: string;
  variant?: "neutral" | "outline";
}) {
  const sync = useSyncRequest();
  if (!sync) return null;
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={sync.disabled}
      aria-describedby="garmin-sync-message"
      onClick={sync.request}
    >
      {sync.running
        ? "Synchronisation en cours…"
        : sync.pending
          ? "Demande envoyée…"
          : "Synchroniser maintenant"}
    </Button>
  );
}

export function SyncRequestMessage({ className }: { className?: string }) {
  const sync = useSyncRequest();
  if (!sync) return null;
  const availableAt =
    sync.availableAt !== null && !sync.running
      ? clockLabel(new Date(sync.availableAt).toISOString())
      : null;
  const message =
    sync.state === "offline"
      ? "Hors ligne : la synchronisation reprendra avec le réseau."
      : sync.state === "reconnect" || sync.failure === "reconnect"
        ? "reconnect"
        : sync.failure === "session-expired"
          ? "Ta session a expiré. Reconnecte-toi pour synchroniser."
          : sync.failure === "unavailable"
            ? "Garmin ne répond pas. Réessaie dans quelques minutes."
            : availableAt
              ? `Synchronisation possible à ${availableAt}.`
              : null;
  return (
    <p
      id="garmin-sync-message"
      role="status"
      className={cn(
        "text-xs leading-relaxed text-muted-foreground empty:hidden",
        sync.failure && "text-warning",
        className,
      )}
    >
      {message === "reconnect" ? (
        <>
          Reconnecte Garmin pour synchroniser.{" "}
          <Link className="underline" href="/settings/connections/garmin">
            Ouvrir les connexions
          </Link>
        </>
      ) : (
        message
      )}
    </p>
  );
}

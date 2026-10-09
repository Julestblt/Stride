"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SyncStatus } from "@/components/stride/sync-status";
import {
  garminSyncCategories,
  type GarminSyncStatus,
} from "@/features/garmin/sync";
import {
  initialSyncPollingState,
  nextSyncPollDelay,
  observeSync,
  syncObservationSchema,
} from "@/features/onboarding/sync-polling";
import {
  connectionNotice,
  type OnboardingConnection,
} from "@/features/onboarding/progress";
const categoryLabels = {
  activities: "Activités",
  recovery: "Récupération",
  fitness: "Forme",
  patterns: "Habitudes",
};
const stateLabels = {
  pending: "En attente",
  running: "Import en cours",
  partial: "Import partiel",
  complete: "À jour",
  failed: "Échec de l’import",
};
export function LiveSyncStatus({
  connection,
}: {
  connection: OnboardingConnection;
}) {
  const router = useRouter();
  const notice = connectionNotice(connection);
  const [state, setState] = useState(initialSyncPollingState);
  useEffect(() => {
    if (notice !== "connected") return;
    let disposed = false;
    let current = initialSyncPollingState;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;
    async function poll() {
      if (disposed || inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      let observation = null;
      try {
        const response = await fetch("/api/onboarding/sync", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if (disposed) return;
        if (response.status === 401) {
          router.replace("/sign-in");
          return;
        }
        const parsed = syncObservationSchema.safeParse(
          response.ok ? await response.json() : null,
        );
        if (parsed.success) observation = parsed.data;
      } catch {
        if (disposed || controller.signal.aborted) return;
      } finally {
        inFlight = false;
      }
      if (disposed) return;
      current = observeSync(current, observation);
      setState(current);
      const delay = nextSyncPollDelay(current);
      if (delay !== null) timer = setTimeout(poll, delay);
    }
    function resume() {
      clearTimeout(timer);
      if (
        !document.hidden &&
        (current.observation === null || nextSyncPollDelay(current) !== null)
      )
        void poll();
    }
    void poll();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [notice, router]);
  if (notice === "reconnect") {
    const status = connection.ok
      ? connection.value.status
      : "reconnect_required";
    if (status === "connecting")
      return (
        <SyncStatus state="importing">
          La connexion Garmin est en cours.
        </SyncStatus>
      );
    const firstConnection = status === "disconnected";
    const verification = status === "mfa_required";
    return (
      <SyncStatus
        state="expired"
        action={
          <Link href="/onboarding/garmin" className="text-accent underline">
            {firstConnection
              ? "Connecter"
              : verification
                ? "Vérifier"
                : "Reconnecter"}
          </Link>
        }
      >
        {firstConnection
          ? "Connecte Garmin pour terminer ton parcours."
          : verification
            ? "Une vérification Garmin est nécessaire."
            : "Garmin doit être reconnecté avant de terminer ton parcours."}
      </SyncStatus>
    );
  }
  if (notice === "unavailable" || state.unavailable)
    return (
      <div className="flex flex-col gap-2">
        <SyncStatus state="retrying">
          Garmin est indisponible. Les dernières données affichées peuvent être
          anciennes.
        </SyncStatus>
        {state.observation && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Dernière observation disponible
            </p>
            <SyncCategories observation={state.observation} />
          </div>
        )}
      </div>
    );
  if (!state.observation)
    return (
      <SyncStatus state="importing">
        Lecture de la synchronisation Garmin…
      </SyncStatus>
    );
  if (!state.observation.started)
    return (
      <SyncStatus state="partial">
        L’import Garmin n’a pas encore démarré.
      </SyncStatus>
    );
  return <SyncCategories observation={state.observation} />;
}
function SyncCategories({
  observation: status,
}: {
  observation: GarminSyncStatus;
}) {
  return (
    <div className="flex flex-col gap-2" aria-label="Synchronisation Garmin">
      {garminSyncCategories.map((category) => {
        const observation = status.categories[category];
        return (
          <SyncStatus
            key={category}
            state={
              observation.state === "complete"
                ? "current"
                : observation.state === "failed" ||
                    observation.state === "partial"
                  ? "partial"
                  : "importing"
            }
          >
            {categoryLabels[category]} · {stateLabels[observation.state]}
            {observation.activityCount !== null &&
              ` · ${observation.activityCount} activités`}
            {observation.oldestSynchronizedDate &&
              ` · Depuis le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(observation.oldestSynchronizedDate))}`}
          </SyncStatus>
        );
      })}
    </div>
  );
}

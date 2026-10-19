import { z } from "zod";
import {
  garminConnectionStatuses,
  type GarminConnectionStatus,
} from "@/features/garmin/connection";
import {
  garminSyncCategories,
  isSyncActive,
  type RequestedSyncPhase,
  type RequestedSyncProgress,
} from "@/features/garmin/sync";
import { syncObservationSchema } from "@/features/onboarding/sync-polling";
import { syncLabel } from "@/features/app-shell/shell";

export const dataActivitySchema = z.object({
  connection: z.enum(garminConnectionStatuses),
  sync: syncObservationSchema.omit({ firstActivityDate: true }),
});
export type DataActivityObservation = z.infer<typeof dataActivitySchema>;
export type DataActivityState =
  | "offline"
  | "unavailable"
  | "reconnect"
  | "syncing"
  | "attention"
  | "complete"
  | "waiting";

export function threadDelay(
  active: boolean,
  visibleSince: number,
  now: number,
) {
  return active
    ? visibleSince
      ? 0
      : 300
    : Math.max(0, 600 - (now - visibleSince));
}

export function activityState(
  observation: DataActivityObservation | null,
  offline: boolean,
  unavailable: boolean,
): DataActivityState {
  if (offline) return "offline";
  if (!observation) return "unavailable";
  if (
    ["expired", "reconnect_required", "disconnected"].includes(
      observation.connection,
    )
  )
    return "reconnect";
  if (unavailable) return "unavailable";
  if (observation.connection !== "connected") return "unavailable";
  if (isSyncActive(observation.sync)) return "syncing";
  if (
    garminSyncCategories.some(
      (key) => observation.sync.categories[key].state === "failed",
    )
  )
    return "attention";
  return observation.sync.started ? "complete" : "waiting";
}

export function freshCategories(
  previous: DataActivityObservation | null,
  next: DataActivityObservation,
) {
  if (!previous) return [];
  return garminSyncCategories.filter((key) => {
    const before = previous.sync.categories[key];
    const after = next.sync.categories[key];
    return (
      (after.lastSuccessAt !== null &&
        (before.lastSuccessAt === null ||
          Date.parse(after.lastSuccessAt) >
            Date.parse(before.lastSuccessAt))) ||
      (key === "activities" &&
        after.activityCount !== null &&
        before.activityCount !== null &&
        after.activityCount > before.activityCount)
    );
  });
}

export const activityLabels: Record<DataActivityState, string> = {
  offline: "Hors ligne · données conservées",
  unavailable: "Statut Garmin indisponible",
  reconnect: "Garmin déconnecté · Reconnecter",
  syncing: "Garmin · synchro…",
  attention: "Import Garmin à vérifier",
  complete: "Garmin à jour",
  waiting: "En attente de données Garmin",
};

export type GarminTone = "success" | "warning" | "danger" | "provider";

export function activityTone(state: DataActivityState): GarminTone {
  if (state === "syncing") return "provider";
  if (state === "complete") return "success";
  if (state === "reconnect") return "danger";
  return "warning";
}

const delayedConnections: GarminConnectionStatus[] = [
  "rate_limited",
  "provider_unavailable",
];

export function activityStatusLabel({
  state,
  observation,
  progress,
  now,
  short = false,
}: {
  state: DataActivityState;
  observation: DataActivityObservation | null;
  progress: RequestedSyncProgress | null;
  now: Date;
  short?: boolean;
}) {
  if (progress) return requestedSyncLabel(progress);
  const synced = syncLabel(observation?.sync.lastSyncAt ?? null, now);
  const time = synced?.replace(/^Synchronisé (le )?/, "") ?? null;
  if (state === "complete" && synced)
    return short ? `Garmin ${time}` : `Garmin ${synced.toLowerCase()}`;
  if (state === "reconnect" && short) return "Garmin déconnecté";
  if (state === "offline" && synced)
    return `Hors ligne · données ${synced.includes(" le ") ? "du" : "de"} ${time}`;
  if (
    state === "unavailable" &&
    observation &&
    delayedConnections.includes(observation.connection)
  )
    return "Garmin en retard";
  return activityLabels[state];
}

export const garminConnectionLabels: Record<GarminConnectionStatus, string> = {
  disconnected: "Déconnecté",
  connecting: "Connexion en cours",
  mfa_required: "Validation nécessaire",
  connected: "Connecté",
  expired: "Reconnexion requise",
  reconnect_required: "Reconnexion requise",
  rate_limited: "Garmin en retard",
  provider_unavailable: "Garmin indisponible",
  error: "Connexion à vérifier",
};

export function garminConnectionTone(
  status: GarminConnectionStatus | null,
): GarminTone {
  if (status === "connected") return "success";
  if (
    status === "expired" ||
    status === "reconnect_required" ||
    status === "disconnected"
  )
    return "danger";
  return "warning";
}

const requestedPhaseLabels: Record<RequestedSyncPhase, string> = {
  activities: "activités",
  recovery: "sommeil",
};

export function requestedSyncLabel(progress: RequestedSyncProgress) {
  const current = progress.current
    ? ` · ${requestedPhaseLabels[progress.current]}`
    : "";
  return `Garmin · ${progress.done} sur ${progress.total}${current}`;
}

export function requestedSyncShare(progress: RequestedSyncProgress) {
  return progress.total ? Math.max(0.1, progress.done / progress.total) : 1;
}

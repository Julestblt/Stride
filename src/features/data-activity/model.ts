import { z } from "zod";
import { garminConnectionStatuses } from "@/features/garmin/connection";
import {
  garminSyncCategories,
  isSyncActive,
  type RequestedSyncPhase,
  type RequestedSyncProgress,
} from "@/features/garmin/sync";
import { syncObservationSchema } from "@/features/onboarding/sync-polling";

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
  reconnect: "Garmin à reconnecter",
  syncing: "Synchronisation Garmin en cours",
  attention: "Import Garmin à vérifier",
  complete: "Garmin à jour",
  waiting: "En attente de données Garmin",
};

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

export const garminSyncCategories = [
  "activities",
  "recovery",
  "fitness",
  "patterns",
] as const;

export type GarminSyncCategory = (typeof garminSyncCategories)[number];

export const garminSyncStates = [
  "pending",
  "running",
  "partial",
  "complete",
  "failed",
] as const;

export type GarminSyncState = (typeof garminSyncStates)[number];

export type GarminSyncCategoryStatus = {
  state: GarminSyncState;
  oldestSynchronizedDate: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  activityCount: number | null;
};

export type GarminSyncStatus = {
  started: boolean;
  categories: Record<GarminSyncCategory, GarminSyncCategoryStatus>;
  lastSyncAt: string | null;
  updatedAt: string | null;
};

export type GarminSyncPhase =
  "not_started" | "importing" | "complete" | "attention";

const settledStates = new Set<GarminSyncState>(["complete", "failed"]);

export function syncPhase(status: GarminSyncStatus): GarminSyncPhase {
  if (!status.started) return "not_started";
  const states = garminSyncCategories.map(
    (category) => status.categories[category].state,
  );
  if (states.includes("failed")) return "attention";
  if (states.every((state) => state === "complete")) return "complete";
  return "importing";
}

export function isSyncActive(status: GarminSyncStatus) {
  return (
    status.started &&
    garminSyncCategories.some(
      (category) => !settledStates.has(status.categories[category].state),
    )
  );
}

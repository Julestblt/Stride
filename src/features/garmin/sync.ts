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

export const garminJobPhases = [
  "activities",
  "recovery",
  "fitness",
  "tracks",
] as const;

export type GarminJobPhase = (typeof garminJobPhases)[number];

export const garminJobStates = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;

export type GarminJobState = (typeof garminJobStates)[number];

export type GarminJobStatus = {
  state: GarminJobState;
  updatedAt: string | null;
};

export type GarminSyncStatus = {
  started: boolean;
  categories: Record<GarminSyncCategory, GarminSyncCategoryStatus>;
  lastSyncAt: string | null;
  updatedAt: string | null;
  phases?: Partial<Record<GarminJobPhase, GarminJobStatus>>;
  manualSyncAvailableAt?: string | null;
};

export type GarminSyncRequest = GarminSyncStatus & {
  request: "queued" | "already_running";
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

export const requestedSyncPhases = ["activities", "recovery"] as const;

export type RequestedSyncPhase = (typeof requestedSyncPhases)[number];

export type RequestedSyncProgress = {
  done: number;
  total: number;
  current: RequestedSyncPhase | null;
  settled: boolean;
};

const openJobStates = new Set<GarminJobState>(["queued", "running"]);

export function requestedSyncProgress(
  baseline: GarminSyncStatus,
  current: GarminSyncStatus,
): RequestedSyncProgress {
  const tracked = requestedSyncPhases.filter((phase) => {
    const job = baseline.phases?.[phase];
    return job !== undefined && openJobStates.has(job.state);
  });
  const open = tracked.filter((phase) => {
    const job = current.phases?.[phase];
    return job === undefined || openJobStates.has(job.state);
  });
  return {
    done: tracked.length - open.length,
    total: tracked.length,
    current: open[0] ?? null,
    settled: open.length === 0,
  };
}

export function manualSyncAvailableAt(
  status: GarminSyncStatus | null | undefined,
  now: number,
) {
  const value = status?.manualSyncAvailableAt;
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) || time <= now ? null : time;
}

export type SyncRequestResult =
  | { status: "requested"; sync: GarminSyncStatus }
  | { status: "throttled"; availableAt: string }
  | { status: "reconnect" | "unavailable" | "session-expired" };

import { z } from "zod";
import {
  garminJobPhases,
  garminJobStates,
  garminSyncStates,
  isSyncActive,
  type GarminSyncStatus,
} from "@/features/garmin/sync";
const category = z.object({
  state: z.enum(garminSyncStates),
  oldestSynchronizedDate: z.iso.date().nullable(),
  lastSuccessAt: z.iso.datetime({ offset: true }).nullable(),
  lastErrorCode: z.string().nullable(),
  activityCount: z.number().int().nonnegative().nullable(),
});
const job = z.object({
  state: z.enum(garminJobStates),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const syncObservationSchema = z.object({
  started: z.boolean(),
  categories: z.object({
    activities: category,
    recovery: category,
    fitness: category,
    patterns: category,
  }),
  lastSyncAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  phases: z.partialRecord(z.enum(garminJobPhases), job).optional(),
  manualSyncAvailableAt: z.iso.datetime({ offset: true }).nullable().optional(),
  firstActivityDate: z.iso.date().nullable().default(null),
});
export type SyncObservation = GarminSyncStatus & {
  firstActivityDate: string | null;
};
export type SyncPollingState = {
  observation: SyncObservation | null;
  unavailable: boolean;
  unchanged: number;
  failures: number;
};
export const initialSyncPollingState: SyncPollingState = {
  observation: null,
  unavailable: false,
  unchanged: 0,
  failures: 0,
};
export function observeSync(
  state: SyncPollingState,
  observation: SyncObservation | null,
): SyncPollingState {
  if (!observation)
    return { ...state, unavailable: true, failures: state.failures + 1 };
  const unchanged =
    JSON.stringify(state.observation) === JSON.stringify(observation);
  return {
    observation,
    unavailable: false,
    unchanged: unchanged ? state.unchanged + 1 : 0,
    failures: 0,
  };
}
export function nextSyncPollDelay(state: SyncPollingState): number | null {
  if (
    !state.unavailable &&
    state.observation &&
    !isSyncActive(state.observation)
  )
    return null;
  return Math.min(
    30_000,
    2_000 * 2 ** Math.min(4, Math.max(state.unchanged, state.failures)),
  );
}

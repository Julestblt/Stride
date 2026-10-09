import { describe, expect, it } from "vitest";
import {
  initialSyncPollingState,
  nextSyncPollDelay,
  observeSync,
  syncObservationSchema,
} from "../../src/features/onboarding/sync-polling";
import type { SyncObservation } from "../../src/features/onboarding/sync-polling";
function observation(
  state: "running" | "partial" | "complete" | "failed" = "running",
): SyncObservation {
  const category = {
    state,
    oldestSynchronizedDate: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    activityCount: 25,
  };
  return {
    started: true,
    categories: {
      activities: category,
      recovery: category,
      fitness: category,
      patterns: category,
    },
    lastSyncAt: null,
    updatedAt: null,
    firstActivityDate: null,
  };
}
describe("sync polling policy", () => {
  it("polls active states using bounded backoff when unchanged", () => {
    let state = observeSync(initialSyncPollingState, observation());
    expect(nextSyncPollDelay(state)).toBe(2000);
    for (let i = 0; i < 20; i++) state = observeSync(state, observation());
    expect(nextSyncPollDelay(state)).toBe(30000);
    expect(
      nextSyncPollDelay(
        observeSync(initialSyncPollingState, observation("partial")),
      ),
    ).toBe(2000);
  });
  it("resets backoff when real counts change", () => {
    let state = observeSync(initialSyncPollingState, observation());
    state = observeSync(state, observation());
    expect(nextSyncPollDelay(state)).toBe(4000);
    const newer = observation();
    newer.categories.activities.activityCount = 50;
    state = observeSync(state, newer);
    expect(nextSyncPollDelay(state)).toBe(2000);
    expect(state.observation?.categories.activities.activityCount).toBe(50);
  });
  it("keeps previous observation explicitly unavailable after failures", () => {
    const original = observation();
    let state = observeSync(initialSyncPollingState, original);
    for (let i = 0; i < 20; i++) state = observeSync(state, null);
    expect(state.observation).toBe(original);
    expect(state.unavailable).toBe(true);
    expect(nextSyncPollDelay(state)).toBe(30000);
    state = observeSync(state, observation());
    expect(state.unavailable).toBe(false);
    expect(state.failures).toBe(0);
  });
  it("stops after settled or not-started sync and retries unknown failures", () => {
    expect(
      nextSyncPollDelay(
        observeSync(initialSyncPollingState, observation("complete")),
      ),
    ).toBeNull();
    expect(
      nextSyncPollDelay(
        observeSync(initialSyncPollingState, observation("failed")),
      ),
    ).toBeNull();
    expect(
      nextSyncPollDelay(
        observeSync(initialSyncPollingState, {
          ...observation(),
          started: false,
        }),
      ),
    ).toBeNull();
    expect(nextSyncPollDelay(observeSync(initialSyncPollingState, null))).toBe(
      4000,
    );
  });
  it("validates browser observations without inventing metrics", () => {
    expect(syncObservationSchema.safeParse(observation()).success).toBe(true);
    expect(
      syncObservationSchema.safeParse({ ...observation(), categories: {} })
        .success,
    ).toBe(false);
    const status = observation();
    status.categories.activities.activityCount = -1;
    expect(syncObservationSchema.safeParse(status).success).toBe(false);
  });
});

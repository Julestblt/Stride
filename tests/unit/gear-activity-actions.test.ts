import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setActivityGear: vi.fn(),
  loadPairChecks: vi.fn(),
  recordDecision: vi.fn(),
  readShoe: vi.fn(),
  upsert: vi.fn(),
  pending: [] as (() => Promise<void>)[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => mocks.pending.push(task),
}));
vi.mock("@/server/garmin/session", () => ({
  getGarminClient: () => ({ setActivityGear: mocks.setActivityGear }),
}));
vi.mock("@/server/garmin/watch", () => ({
  tokenContext: (context: object) => context,
}));
vi.mock("@/server/onboarding/context", () => ({
  getOnboardingContext: async () => athlete,
}));
vi.mock("@/server/gear/shoes", async (original) => ({
  ...(await original<object>()),
  readShoe: mocks.readShoe,
}));

const athlete = {
  userId: "a4000000-0000-4000-8000-00000000000a",
  accessToken: "token",
  email: null,
  client: { from: () => ({ upsert: mocks.upsert }) },
};

const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const evo = "d1000000-0000-4000-8000-000000000001";
const zegama = "d1000000-0000-4000-8000-000000000003";

const check = {
  activityId,
  providerActivityId: "21894512345",
  day: "2026-10-20",
  distanceM: 8300,
  sessionKey: "s-2026-10-20-1",
  sessionTitle: "Footing",
  garminName: "Zegama",
  state: "different",
  pairId: zegama,
  garminPairId: zegama,
  plannedPairId: evo,
  garminGearUuid: "b".repeat(32),
  assignedByStride: false,
  assign: null,
};

describe("activity pair actions", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.pending.length = 0;
    for (const mock of [
      mocks.setActivityGear,
      mocks.loadPairChecks,
      mocks.recordDecision,
      mocks.readShoe,
      mocks.upsert,
    ])
      mock.mockReset();
    mocks.recordDecision.mockResolvedValue({ error: null });
    mocks.loadPairChecks.mockResolvedValue({
      checks: new Map([[activityId, check]]),
      shoes: [],
      today: "2026-10-21",
    });
    vi.doMock("@/server/gear/checks", () => ({
      loadPairChecks: mocks.loadPairChecks,
      recordDecision: mocks.recordDecision,
    }));
  });

  it("keeps Garmin's pair without writing to Garmin", async () => {
    const { setActivityPair } = await import("@/server/gear/actions");
    await expect(
      setActivityPair({ activityId, shoeId: null }),
    ).resolves.toEqual({ status: "saved" });
    expect(mocks.setActivityGear).not.toHaveBeenCalled();
    expect(mocks.recordDecision).toHaveBeenCalledWith(
      athlete,
      "21894512345",
      "confirmed",
      zegama,
    );
  });

  it("writes the planned pair to Garmin and marks it as corrected", async () => {
    mocks.readShoe.mockResolvedValue({
      id: evo,
      garminGearUuid: "a".repeat(32),
      retiredOn: null,
    });
    mocks.setActivityGear.mockResolvedValue({
      ok: true,
      value: { providerActivityId: "21894512345", gearUuid: "a".repeat(32) },
    });
    const { setActivityPair } = await import("@/server/gear/actions");
    await expect(setActivityPair({ activityId, shoeId: evo })).resolves.toEqual(
      {
        status: "saved",
      },
    );
    expect(mocks.setActivityGear).toHaveBeenCalledWith(
      { accessToken: "token" },
      "21894512345",
      "a".repeat(32),
    );
    expect(mocks.recordDecision).toHaveBeenCalledWith(
      athlete,
      "21894512345",
      "corrected",
      evo,
    );
  });

  it("keeps nothing when Garmin refuses the correction", async () => {
    mocks.readShoe.mockResolvedValue({
      id: evo,
      garminGearUuid: "a".repeat(32),
      retiredOn: null,
    });
    mocks.setActivityGear.mockResolvedValue({
      ok: false,
      failure: { code: "gear_starts_after_activity" },
    });
    const { setActivityPair } = await import("@/server/gear/actions");
    await expect(setActivityPair({ activityId, shoeId: evo })).resolves.toEqual(
      {
        status: "pair-too-recent",
      },
    );
    expect(mocks.recordDecision).not.toHaveBeenCalled();
  });

  it("rejects an activity Stride did not check", async () => {
    const { setActivityPair } = await import("@/server/gear/actions");
    await expect(
      setActivityPair({
        activityId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000009",
        shoeId: evo,
      }),
    ).resolves.toEqual({ status: "invalid" });
    expect(mocks.setActivityGear).not.toHaveBeenCalled();
  });
});

describe("missing pair assignment", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/server/gear/checks");
    mocks.pending.length = 0;
    mocks.setActivityGear.mockReset();
    mocks.upsert.mockReset();
  });

  const missing = {
    ...check,
    state: "missing",
    pairId: null,
    garminPairId: null,
    garminGearUuid: null,
    garminName: null,
    assign: { pairId: evo, gearUuid: "a".repeat(32) },
  };

  it("assigns the planned pair in Garmin after the response", async () => {
    mocks.upsert.mockResolvedValue({ error: null, count: 1 });
    mocks.setActivityGear.mockResolvedValue({ ok: true, value: {} });
    const { assignMissingPairsAfterResponse } =
      await import("@/server/gear/checks");
    assignMissingPairsAfterResponse(athlete as never, {
      checks: new Map([[activityId, missing]]) as never,
      shoes: [],
      today: "2026-10-21",
    });
    expect(mocks.setActivityGear).not.toHaveBeenCalled();
    await Promise.all(mocks.pending.map((task) => task()));
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      decision: "assigned",
      shoe_id: evo,
    });
    expect(mocks.setActivityGear).toHaveBeenCalledWith(
      { accessToken: "token" },
      "21894512345",
      "a".repeat(32),
    );
  });

  it("does not write twice when another request already claimed it", async () => {
    mocks.upsert.mockResolvedValue({ error: null, count: 0 });
    const { assignMissingPairsAfterResponse } =
      await import("@/server/gear/checks");
    assignMissingPairsAfterResponse(athlete as never, {
      checks: new Map([[activityId, missing]]) as never,
      shoes: [],
      today: "2026-10-21",
    });
    await Promise.all(mocks.pending.map((task) => task()));
    expect(mocks.setActivityGear).not.toHaveBeenCalled();
  });

  it("remembers a refused assignment so it is not retried", async () => {
    mocks.upsert.mockResolvedValue({ error: null, count: 1 });
    mocks.setActivityGear.mockResolvedValue({
      ok: false,
      failure: { code: "gear_starts_after_activity" },
    });
    const { assignMissingPairsAfterResponse } =
      await import("@/server/gear/checks");
    assignMissingPairsAfterResponse(athlete as never, {
      checks: new Map([[activityId, missing]]) as never,
      shoes: [],
      today: "2026-10-21",
    });
    await Promise.all(mocks.pending.map((task) => task()));
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[1][0]).toMatchObject({
      decision: "unassignable",
    });
  });
});

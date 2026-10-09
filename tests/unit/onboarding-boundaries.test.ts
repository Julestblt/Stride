import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  progress: vi.fn(),
  connection: vi.fn(),
  sync: vi.fn(),
  completion: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/onboarding/context", () => ({
  getOnboardingContext: mocks.context,
}));
vi.mock("@/server/onboarding/progress", () => ({
  ensureProgress: mocks.progress,
}));
vi.mock("@/server/garmin/session", () => ({
  getGarminClient: () => ({
    getConnection: mocks.connection,
    getSync: mocks.sync,
  }),
}));
vi.mock("@/server/supabase/completion-client", () => ({
  createCompletionClient: mocks.completion,
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
import {
  completeOnboarding,
  navigateOnboarding,
} from "../../src/server/onboarding/actions";
import { getOnboardingRequest } from "../../src/server/onboarding/request";
import { GET } from "../../src/app/api/onboarding/sync/route";
const date = "2026-10-09T12:00:00Z";
const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";
const progress = {
  user_id: userId,
  current_step: "about",
  revision: 7,
  completed_at: null,
  created_at: date,
  updated_at: date,
  welcome_completed_at: date,
  garmin_completed_at: date,
  history_completed_at: date,
  about_completed_at: date,
  goals_completed_at: date,
  profile_completed_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("ONBOARDING_ENABLED", "true");
  mocks.context.mockResolvedValue({
    client: { rpc: mocks.rpc },
    userId,
    email: "athlete@example.com",
    accessToken: "private-token",
  });
  mocks.progress.mockResolvedValue(progress);
  mocks.connection.mockResolvedValue({
    ok: true,
    value: { status: "connected", connectedAt: null, lastSyncAt: null },
  });
  mocks.rpc.mockResolvedValue({
    data: { ...progress, revision: 8 },
    error: null,
  });
});
describe("onboarding server wiring", () => {
  it("uses session RPCs for navigation and ordinary completion without creating privileged clients", async () => {
    expect(
      await navigateOnboarding({ step: "welcome", revision: 7 }),
    ).toMatchObject({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("set_onboarding_current_step", {
      p_step: "welcome",
      p_expected_revision: 7,
    });
    expect(
      await completeOnboarding({ step: "about", revision: 7 }),
    ).toMatchObject({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_onboarding_step", {
      p_step: "about",
      p_expected_revision: 7,
    });
    expect(mocks.completion).not.toHaveBeenCalled();
  });
  it.each(["garmin", "profile"])(
    "fails closed on missing credential for %s",
    async (step) => {
      mocks.completion.mockReturnValue(null);
      expect(await completeOnboarding({ step, revision: 7 })).toMatchObject({
        code: "unavailable",
      });
      expect(mocks.connection).toHaveBeenCalledWith({
        accessToken: "private-token",
      });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("passes only verified identity to constrained completion after fresh connected Garmin", async () => {
    const complete = vi.fn(async () => ({
      data: { ...progress, revision: 8 },
      error: null,
    }));
    mocks.completion.mockReturnValue({ complete });
    expect(
      await completeOnboarding({ step: "garmin", revision: 7 }),
    ).toMatchObject({ status: "success" });
    expect(complete).toHaveBeenCalledWith(userId, "garmin", 7);
    expect(mocks.context.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.connection.mock.invocationCallOrder[0],
    );
    expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
      complete.mock.invocationCallOrder[0],
    );
  });
  it("does not instantiate privileged access for disconnected or unverified callers", async () => {
    mocks.connection.mockResolvedValue({
      ok: true,
      value: { status: "disconnected", connectedAt: null, lastSyncAt: null },
    });
    expect(
      await completeOnboarding({ step: "garmin", revision: 7 }),
    ).toMatchObject({ code: "reconnect" });
    expect(mocks.completion).not.toHaveBeenCalled();
    mocks.context.mockResolvedValue(null);
    expect(
      await completeOnboarding({ step: "garmin", revision: 7 }),
    ).toMatchObject({ code: "session-expired" });
    expect(mocks.completion).not.toHaveBeenCalled();
  });
});
describe("onboarding request guards", () => {
  it("gates disabled routes and redirects signed-out visitors", async () => {
    vi.stubEnv("ONBOARDING_ENABLED", "false");
    await expect(getOnboardingRequest()).rejects.toThrow("not-found");
    expect(mocks.context).not.toHaveBeenCalled();
    vi.stubEnv("ONBOARDING_ENABLED", "true");
    mocks.context.mockResolvedValue(null);
    await expect(getOnboardingRequest()).rejects.toThrow("redirect:/sign-in");
  });
  it("shows database failure through the retry boundary and does not sign out", async () => {
    mocks.progress.mockRejectedValue(
      new Error("Unable to read onboarding progress"),
    );
    await expect(getOnboardingRequest()).rejects.toThrow(
      "Unable to read onboarding progress",
    );
    expect(mocks.connection).not.toHaveBeenCalled();
  });
  it("keeps unlocked progress available during Garmin infrastructure failures", async () => {
    mocks.connection.mockRejectedValue(new Error("network"));
    expect(await getOnboardingRequest()).toEqual({
      progress,
      connection: { ok: false, failure: { code: "network" } },
      email: "athlete@example.com",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.connection.mockResolvedValue({
      ok: false,
      failure: { code: "unauthorized" },
    });
    await expect(getOnboardingRequest()).rejects.toThrow("redirect:/sign-in");
  });
});
describe("sync route ownership and caching", () => {
  it("uses only verified request identity and returns no tokens", async () => {
    const category = {
      state: "running",
      oldestSynchronizedDate: null,
      lastSuccessAt: null,
      lastErrorCode: null,
      activityCount: 25,
    };
    const observation = {
      started: true,
      categories: {
        activities: category,
        recovery: category,
        fitness: category,
        patterns: category,
      },
      lastSyncAt: null,
      updatedAt: null,
    };
    mocks.sync.mockResolvedValue({ ok: true, value: observation });
    const eq = vi.fn(() => ({
      order: () => ({
        limit: () => ({
          maybeSingle: async () => ({
            data: { started_at: "2025-03-14T07:12:00+00:00" },
            error: null,
          }),
        }),
      }),
    }));
    const from = vi.fn(() => ({ select: () => ({ eq }) }));
    mocks.context.mockResolvedValue({
      client: { from },
      userId,
      email: "athlete@example.com",
      accessToken: "private-token",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({
      ...observation,
      firstActivityDate: "2025-03-14",
    });
    expect(mocks.sync).toHaveBeenCalledWith({ accessToken: "private-token" });
    expect(from).toHaveBeenCalledWith("provider_activities");
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });
  it("returns unauthorized for signed-out callers and never reads provider data", async () => {
    mocks.context.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it.each([
    ["unauthorized", 401],
    ["network", 503],
    ["malformed", 503],
    ["reconnect_required", 503],
  ])("sanitizes %s to HTTP %s", async (code, status) => {
    mocks.sync.mockResolvedValue({
      ok: false,
      failure: { code, raw: "private-token" },
    });
    const response = await GET();
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("private-token");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("returns retryable infrastructure failure without a sign-out response", async () => {
    mocks.context.mockRejectedValue(new Error("network"));
    expect((await GET()).status).toBe(503);
  });
  it("keeps disabled endpoints unavailable", async () => {
    vi.stubEnv("ONBOARDING_ENABLED", "false");
    expect((await GET()).status).toBe(404);
    expect(mocks.context).not.toHaveBeenCalled();
  });
});

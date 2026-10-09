import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "../../src/server/supabase/database.types";
import type { ProgressSnapshot } from "../../src/features/onboarding/schemas";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import {
  transitionOnboarding,
  type OnboardingServiceDependencies,
} from "../../src/server/onboarding/service";
import { verifyOnboardingContext } from "../../src/server/onboarding/context";
import { ensureProgress } from "../../src/server/onboarding/progress";
import { createCompletionClient } from "../../src/server/supabase/completion-client";
import { onboardingEnabled } from "../../src/server/onboarding/environment";
const date = "2026-10-09T12:00:00Z";
const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";
const otherId = "4504cfe3-377d-4056-a9fb-61c6c62c177f";
function snapshot(): ProgressSnapshot {
  return {
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
}
function setup() {
  const progress = snapshot();
  const context = {
    client: {} as SupabaseClient<Database>,
    userId,
    accessToken: "private-athlete-token",
  };
  const dependencies: OnboardingServiceDependencies = {
    enabled: () => true,
    context: vi.fn(async () => context),
    progress: vi.fn(async () => progress),
    connection: vi.fn(async () => ({
      ok: true as const,
      value: {
        status: "connected" as const,
        connectedAt: null,
        lastSyncAt: null,
      },
    })),
    navigate: vi.fn(async () => ({
      data: { ...progress, current_step: "welcome", revision: 8 },
      error: null,
    })),
    complete: vi.fn(async () => ({
      data: { ...progress, current_step: "profile", revision: 8 },
      error: null,
    })),
  };
  return { dependencies, progress, context };
}
describe("onboarding transitions", () => {
  it("verifies identity and refuses signed-out athletes before reading progress", async () => {
    const { dependencies } = setup();
    dependencies.context = vi.fn(async () => null);
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
      }),
    ).toMatchObject({ code: "session-expired" });
    expect(dependencies.progress).not.toHaveBeenCalled();
    expect(dependencies.navigate).not.toHaveBeenCalled();
  });
  it("shows a retryable infrastructure failure without signing out", async () => {
    const { dependencies } = setup();
    dependencies.progress = vi.fn(async () => {
      throw new Error("private DB details");
    });
    const result = await transitionOnboarding(dependencies, "navigate", {
      step: "welcome",
      revision: 7,
    });
    expect(result).toMatchObject({ code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("private DB details");
  });
  it("persists explicit navigation with the verified identity and expected revision", async () => {
    const { dependencies, context } = setup();
    const result = await transitionOnboarding(dependencies, "navigate", {
      step: "welcome",
      revision: 7,
    });
    expect(dependencies.navigate).toHaveBeenCalledWith(context, "welcome", 7);
    expect(result).toMatchObject({
      status: "success",
      href: "/onboarding/welcome",
      progress: { revision: 8 },
    });
    expect(JSON.stringify(result)).not.toContain(context.accessToken);
  });
  it("reloads stale revisions before any write", async () => {
    const { dependencies, progress } = setup();
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 6,
      }),
    ).toMatchObject({ code: "conflict", progress });
    expect(dependencies.navigate).not.toHaveBeenCalled();
  });
  it("reloads concurrent RPC conflicts", async () => {
    const { dependencies } = setup();
    dependencies.navigate = vi.fn(async () => ({
      data: null,
      error: { code: "PT409" },
    }));
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
      }),
    ).toMatchObject({ code: "conflict" });
    expect(dependencies.progress).toHaveBeenCalledTimes(2);
  });
  it("rejects locked targets and caller supplied ownership", async () => {
    const { dependencies, progress } = setup();
    progress.about_completed_at = null;
    progress.goals_completed_at = null;
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "goals",
        revision: 7,
      }),
    ).toMatchObject({ code: "locked" });
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
        userId: otherId,
      }),
    ).toMatchObject({ code: "invalid-input" });
    expect(dependencies.navigate).not.toHaveBeenCalled();
  });
  it.each(["welcome", "history", "about", "goals"])(
    "delegates %s completion to persisted database validation",
    async (step) => {
      const { dependencies } = setup();
      expect(
        await transitionOnboarding(dependencies, "complete", {
          step,
          revision: 7,
        }),
      ).toMatchObject({ status: "success" });
      expect(dependencies.connection).not.toHaveBeenCalled();
      expect(dependencies.complete).toHaveBeenCalled();
    },
  );
  it.each([
    ["PT422", "step_data_incomplete", "data-incomplete"],
    ["PT422", "prerequisites_incomplete", "locked"],
    ["PT401", "not_authenticated", "session-expired"],
    ["PT403", "permission_denied", "unavailable"],
  ])("surfaces %s %s safely", async (code, message, expected) => {
    const { dependencies } = setup();
    dependencies.complete = vi.fn(async () => ({
      data: null,
      error: { code, message },
    }));
    expect(
      await transitionOnboarding(dependencies, "complete", {
        step: "about",
        revision: 7,
      }),
    ).toMatchObject({ code: expected });
  });
  it.each(["garmin", "profile"])(
    "requires a fresh connected Garmin for %s completion",
    async (step) => {
      for (const code of [
        "network",
        "unauthorized",
        "provider_unavailable",
      ] as const) {
        const { dependencies } = setup();
        dependencies.connection = vi.fn(async () => ({
          ok: false as const,
          failure: { code },
        }));
        expect(
          await transitionOnboarding(dependencies, "complete", {
            step,
            revision: 7,
          }),
        ).toMatchObject({
          code: code === "unauthorized" ? "session-expired" : "unavailable",
        });
        expect(dependencies.complete).not.toHaveBeenCalled();
      }
      const { dependencies } = setup();
      dependencies.connection = vi.fn(async () => ({
        ok: true as const,
        value: {
          status: "reconnect_required" as const,
          connectedAt: null,
          lastSyncAt: null,
        },
      }));
      expect(
        await transitionOnboarding(dependencies, "complete", {
          step,
          revision: 7,
        }),
      ).toMatchObject({ code: "reconnect" });
      expect(dependencies.complete).not.toHaveBeenCalled();
    },
  );
  it("finishes only with all prerequisites and redirects completed athletes to the app", async () => {
    const { dependencies, progress } = setup();
    dependencies.complete = vi.fn(async () => ({
      data: {
        ...progress,
        completed_at: date,
        profile_completed_at: date,
        revision: 8,
      },
      error: null,
    }));
    expect(
      await transitionOnboarding(dependencies, "complete", {
        step: "profile",
        revision: 7,
      }),
    ).toMatchObject({ status: "success", href: "/" });
    progress.completed_at = date;
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
      }),
    ).toMatchObject({ href: "/" });
  });
  it("refuses foreign or malformed response data", async () => {
    const { dependencies, progress } = setup();
    dependencies.navigate = vi.fn(async () => ({
      data: { ...progress, user_id: otherId },
      error: null,
    }));
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
      }),
    ).toMatchObject({ code: "unavailable" });
  });
  it("fails closed when rollout is disabled", async () => {
    const { dependencies } = setup();
    dependencies.enabled = () => false;
    expect(
      await transitionOnboarding(dependencies, "navigate", {
        step: "welcome",
        revision: 7,
      }),
    ).toMatchObject({ code: "disabled" });
    expect(dependencies.context).not.toHaveBeenCalled();
  });
});
describe("verified request boundary", () => {
  it("obtains the token only after getUser and rejects an unrelated session", async () => {
    const order: string[] = [];
    const auth = {
      getUser: vi.fn(async () => {
        order.push("user");
        return { data: { user: { id: userId } }, error: null };
      }),
      getSession: vi.fn(async () => {
        order.push("session");
        return {
          data: {
            session: { user: { id: userId }, access_token: "private-token" },
          },
          error: null,
        };
      }),
    };
    const client = { auth } as unknown as SupabaseClient<Database>;
    expect(await verifyOnboardingContext(client)).toMatchObject({
      userId,
      accessToken: "private-token",
    });
    expect(order).toEqual(["user", "session"]);
    auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: otherId }, access_token: "other-token" } },
      error: null,
    });
    expect(await verifyOnboardingContext(client)).toBeNull();
  });
  it("does not trust an unverified session", async () => {
    const getSession = vi.fn();
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: new AuthSessionMissingError(),
        })),
        getSession,
      },
    } as unknown as SupabaseClient<Database>;
    expect(await verifyOnboardingContext(client)).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });
});
describe("auth infrastructure versus expired identity", () => {
  it.each([
    new AuthRetryableFetchError("network", 0),
    new AuthApiError("outage", 503, "unexpected_failure"),
    new Error("network"),
  ])("throws retryable identity failure %s", async (error) => {
    const getSession = vi.fn();
    const client = {
      auth: {
        getUser: async () => ({ data: { user: null }, error }),
        getSession,
      },
    } as unknown as SupabaseClient<Database>;
    await expect(verifyOnboardingContext(client)).rejects.toThrow(
      "Identity verification is unavailable",
    );
    expect(getSession).not.toHaveBeenCalled();
  });
  it.each([
    new AuthSessionMissingError(),
    new AuthApiError("invalid token", 401, "bad_jwt"),
    new AuthApiError("invalid token", 400, "bad_jwt"),
  ])("requires sign-in for %s", async (error) => {
    const client = {
      auth: { getUser: async () => ({ data: { user: null }, error }) },
    } as unknown as SupabaseClient<Database>;
    expect(await verifyOnboardingContext(client)).toBeNull();
  });
  it("throws retryable session failures after verified identity", async () => {
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: userId } }, error: null }),
        getSession: async () => ({
          data: { session: null },
          error: new AuthRetryableFetchError("network", 502),
        }),
      },
    } as unknown as SupabaseClient<Database>;
    await expect(verifyOnboardingContext(client)).rejects.toThrow(
      "Session verification is unavailable",
    );
  });
});
describe("idempotent first entry", () => {
  it.each([null, { code: "23505" }])(
    "creates or accepts a concurrent own row once (%j)",
    async (error) => {
      const row = snapshot();
      const reads = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: row, error: null });
      const insert = vi.fn(async () => ({ error }));
      const eq = vi.fn(() => ({ maybeSingle: reads }));
      const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })), insert }));
      const context = {
        client: { from } as unknown as SupabaseClient<Database>,
        userId,
        accessToken: "token",
      };
      expect(await ensureProgress(context)).toEqual(row);
      expect(insert).toHaveBeenCalledWith({ user_id: userId });
      expect(eq).toHaveBeenCalledWith("user_id", userId);
    },
  );
  it("does not write on refresh/relogin and refuses foreign rows", async () => {
    const insert = vi.fn();
    const reads = vi.fn(async () => ({ data: snapshot(), error: null }));
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: reads }) }),
      insert,
    }));
    const context = {
      client: { from } as unknown as SupabaseClient<Database>,
      userId,
      accessToken: "token",
    };
    await ensureProgress(context);
    await ensureProgress(context);
    expect(insert).not.toHaveBeenCalled();
    reads.mockResolvedValueOnce({
      data: { ...snapshot(), user_id: otherId },
      error: null,
    });
    await expect(ensureProgress(context)).rejects.toThrow(
      "Invalid onboarding owner",
    );
  });
  it("surfaces database creation failure for retry", async () => {
    const from = () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      insert: async () => ({ error: { code: "08006" } }),
    });
    await expect(
      ensureProgress({
        client: { from } as unknown as SupabaseClient<Database>,
        userId,
        accessToken: "token",
      }),
    ).rejects.toThrow("Unable to create onboarding progress");
  });
});
describe("server configuration", () => {
  beforeEach(() => vi.unstubAllEnvs());
  it("defaults rollout off and enables it only explicitly", () => {
    vi.stubEnv("ONBOARDING_ENABLED", undefined);
    expect(onboardingEnabled()).toBe(false);
    vi.stubEnv("ONBOARDING_ENABLED", "true");
    expect(onboardingEnabled()).toBe(true);
  });
  it("fails closed without a completion credential", () => {
    vi.stubEnv("SUPABASE_ONBOARDING_COMPLETION_KEY", undefined);
    expect(createCompletionClient()).toBeNull();
  });
});

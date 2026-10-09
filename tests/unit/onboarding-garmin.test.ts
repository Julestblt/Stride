import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/server/supabase/database.types";
import type { ProgressSnapshot } from "../../src/features/onboarding/schemas";
import type { GarminConnectFailure } from "../../src/features/garmin/connection";
vi.mock("server-only", () => ({}));
import {
  formatCountdown,
  garminFailureView,
  initialGarminScreen,
  normalizeCode,
  requiresNewSignIn,
} from "../../src/features/onboarding/garmin-flow";
import {
  connectGarmin,
  type GarminConnectionDependencies,
} from "../../src/server/onboarding/garmin-connection";

const date = "2026-10-09T12:00:00Z";
const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";
const challengeId = "8e0d2b3c-7c1a-4e4b-9a55-0c1f0f8d3b21";
const credentials = { email: "athlete@example.com", password: "s3cret-pass" };

function progress(welcome: string | null = date): ProgressSnapshot {
  return {
    user_id: userId,
    current_step: "garmin",
    revision: 3,
    completed_at: null,
    created_at: date,
    updated_at: date,
    welcome_completed_at: welcome,
    garmin_completed_at: null,
    history_completed_at: null,
    about_completed_at: null,
    goals_completed_at: null,
    profile_completed_at: null,
  };
}
function setup(overrides: Partial<GarminConnectionDependencies> = {}) {
  const context = {
    client: {} as SupabaseClient<Database>,
    userId,
    email: "athlete@example.com",
    accessToken: "private-token",
  };
  const dependencies: GarminConnectionDependencies = {
    enabled: () => true,
    context: vi.fn(async () => context),
    progress: vi.fn(async () => progress()),
    start: vi.fn(async () => ({
      ok: true as const,
      value: { status: "connected" as const },
    })),
    verify: vi.fn(async () => ({
      ok: true as const,
      value: { status: "connected" as const },
    })),
    ...overrides,
  };
  return { dependencies, context };
}
const failure = (
  state: GarminConnectFailure["state"],
  extra: Partial<GarminConnectFailure> = {},
): GarminConnectFailure => ({ state, canRetryCode: false, ...extra });

describe("Garmin step screen mapping", () => {
  it("starts connected athletes on the connected screen and everyone else on the intro", () => {
    expect(
      initialGarminScreen({
        ok: true,
        value: { status: "connected", connectedAt: date, lastSyncAt: null },
      }),
    ).toBe("connected");
    for (const status of [
      "disconnected",
      "mfa_required",
      "connecting",
      "reconnect_required",
    ] as const)
      expect(
        initialGarminScreen({
          ok: true,
          value: { status, connectedAt: null, lastSyncAt: null },
        }),
      ).toBe("intro");
    expect(
      initialGarminScreen({ ok: false, failure: { code: "network" } }),
    ).toBe("intro");
  });
  it("clears the password and keeps the form for invalid credentials", () => {
    expect(
      garminFailureView("credentials", failure("invalid_credentials")),
    ).toEqual({
      screen: "credentials",
      notice: "invalid_credentials",
      clearPassword: true,
      selectCode: false,
    });
  });
  it("keeps every input when Garmin is unavailable, on the current screen", () => {
    for (const stage of ["credentials", "code"] as const)
      expect(
        garminFailureView(stage, failure("garmin_unavailable")),
      ).toMatchObject({
        screen: stage,
        notice: "garmin_unavailable",
        clearPassword: false,
        selectCode: false,
      });
  });
  it("returns rate limits and failed connections to sign-in, with timing only when provided", () => {
    expect(
      garminFailureView("credentials", failure("rate_limited")),
    ).not.toHaveProperty("retryAfterSeconds");
    expect(
      garminFailureView(
        "code",
        failure("rate_limited", { retryAfterSeconds: 292 }),
      ),
    ).toMatchObject({
      screen: "credentials",
      notice: "rate_limited",
      retryAfterSeconds: 292,
    });
    expect(
      garminFailureView("code", failure("connection_failed")),
    ).toMatchObject({
      screen: "credentials",
      notice: "connection_failed",
      clearPassword: true,
    });
  });
  it("selects the code only when Garmin allows another attempt", () => {
    expect(
      garminFailureView("code", failure("invalid_mfa", { canRetryCode: true })),
    ).toMatchObject({
      screen: "code",
      notice: "invalid_code",
      selectCode: true,
    });
    const consumed = garminFailureView("code", failure("invalid_mfa"));
    expect(consumed).toMatchObject({ screen: "code", notice: "code_rejected" });
    const expired = garminFailureView("code", failure("expired_mfa"));
    expect(expired).toMatchObject({ screen: "code", notice: "expired_code" });
    expect(requiresNewSignIn("code_rejected")).toBe(true);
    expect(requiresNewSignIn("expired_code")).toBe(true);
    expect(requiresNewSignIn("invalid_code")).toBe(false);
  });
  it("sends expired Stride sessions to sign-in", () => {
    expect(garminFailureView("code", failure("session_expired"))).toBe(
      "session-expired",
    );
  });
  it("normalizes pasted codes and formats retry countdowns", () => {
    expect(normalizeCode("482 716")).toBe("482716");
    expect(normalizeCode("12-34-56-78")).toBe("123456");
    expect(normalizeCode("abc")).toBe("");
    expect(formatCountdown(292)).toBe("4:52");
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});

describe("Garmin connection actions", () => {
  it("forwards credentials once and never returns them", async () => {
    const { dependencies, context } = setup();
    const result = await connectGarmin(dependencies, "start", credentials);
    expect(result).toEqual({ status: "connected" });
    expect(dependencies.start).toHaveBeenCalledTimes(1);
    expect(dependencies.start).toHaveBeenCalledWith(context, credentials);
    expect(JSON.stringify(result)).not.toContain(credentials.password);
  });
  it("returns only the challenge identifier when Garmin asks for a code", async () => {
    const { dependencies } = setup({
      start: vi.fn(async () => ({
        ok: true as const,
        value: { status: "mfa_required" as const, challengeId },
      })),
    });
    expect(await connectGarmin(dependencies, "start", credentials)).toEqual({
      status: "mfa_required",
      challengeId,
    });
  });
  it("verifies codes against the active challenge", async () => {
    const { dependencies, context } = setup();
    expect(
      await connectGarmin(dependencies, "verify", {
        challengeId,
        otp: "482716",
      }),
    ).toEqual({ status: "connected" });
    expect(dependencies.verify).toHaveBeenCalledWith(context, {
      challengeId,
      otp: "482716",
    });
  });
  it("maps provider failures to approved states", async () => {
    const { dependencies } = setup({
      start: vi.fn(async () => ({
        ok: false as const,
        failure: { code: "invalid_credentials" as const },
      })),
      verify: vi.fn(async () => ({
        ok: false as const,
        failure: { code: "invalid_mfa" as const, challengeConsumed: true },
      })),
    });
    expect(await connectGarmin(dependencies, "start", credentials)).toEqual({
      status: "error",
      failure: { state: "invalid_credentials", canRetryCode: false },
    });
    expect(
      await connectGarmin(dependencies, "verify", {
        challengeId,
        otp: "000000",
      }),
    ).toEqual({
      status: "error",
      failure: { state: "invalid_mfa", canRetryCode: false },
    });
  });
  it.each([
    [{ email: "not-an-email", password: "x" }, "start"],
    [{ ...credentials, password: "" }, "start"],
    [{ ...credentials, extra: true }, "start"],
    [{ challengeId: "not-a-uuid", otp: "123456" }, "verify"],
    [{ challengeId, otp: "12345" }, "verify"],
    [{ challengeId, otp: "12a456" }, "verify"],
  ] as const)(
    "rejects invalid input %j before calling Garmin",
    async (input, mode) => {
      const { dependencies } = setup();
      expect(await connectGarmin(dependencies, mode, input)).toMatchObject({
        status: "error",
        failure: { state: "connection_failed" },
      });
      expect(dependencies.context).not.toHaveBeenCalled();
      expect(dependencies.start).not.toHaveBeenCalled();
      expect(dependencies.verify).not.toHaveBeenCalled();
    },
  );
  it("requires a verified session, an enabled rollout and an unlocked Garmin step", async () => {
    const expired = setup({ context: vi.fn(async () => null) });
    expect(
      await connectGarmin(expired.dependencies, "start", credentials),
    ).toMatchObject({ failure: { state: "session_expired" } });
    const disabled = setup({ enabled: () => false });
    expect(
      await connectGarmin(disabled.dependencies, "start", credentials),
    ).toMatchObject({ failure: { state: "connection_failed" } });
    const locked = setup({ progress: vi.fn(async () => progress(null)) });
    expect(
      await connectGarmin(locked.dependencies, "start", credentials),
    ).toMatchObject({ failure: { state: "connection_failed" } });
    for (const { dependencies } of [expired, disabled, locked])
      expect(dependencies.start).not.toHaveBeenCalled();
  });
  it("treats unexpected errors as a temporary Garmin outage", async () => {
    const { dependencies } = setup({
      start: vi.fn(async () => {
        throw new Error(credentials.password);
      }),
    });
    const result = await connectGarmin(dependencies, "start", credentials);
    expect(result).toEqual({
      status: "error",
      failure: { state: "garmin_unavailable", canRetryCode: false },
    });
    expect(JSON.stringify(result)).not.toContain(credentials.password);
  });
});

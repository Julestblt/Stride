import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  connectFailure,
  type GarminFailure,
} from "../../src/features/garmin/connection";
import {
  isSyncActive,
  syncPhase,
  type GarminSyncStatus,
} from "../../src/features/garmin/sync";
import { createGarminClient } from "../../src/server/garmin/client";
import { parseGarminApiUrl } from "../../src/server/garmin/environment";
import { createGarminService } from "../fixtures/garmin-service.mjs";

const context = { accessToken: "athlete-access-token" };
const challengeId = "7f9c2a4e-1b3d-4c5e-8f6a-0b1c2d3e4f5a";

function respond(status: number, body: unknown, headers = {}) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers,
      }),
  );
}

function client(send: typeof fetch) {
  return createGarminClient({ baseUrl: "http://garmin.test", fetch: send });
}

const pending = { state: "pending" };

describe("GARMIN_API_URL", () => {
  it("accepts internal and public origins", () => {
    expect(parseGarminApiUrl("http://garmin-mcp-api:8000")).toBe(
      "http://garmin-mcp-api:8000",
    );
    expect(parseGarminApiUrl("https://garmin.example.com/")).toBe(
      "https://garmin.example.com",
    );
  });

  it.each([
    undefined,
    "",
    "ftp://garmin.example.com",
    "https://user:secret@garmin.example.com",
    "https://garmin.example.com/v1",
    "https://garmin.example.com/?key=value",
    "https://garmin.example.com/#fragment",
  ])("rejects %s", (value) => {
    expect(() => parseGarminApiUrl(value)).toThrow();
  });
});

describe("Garmin client requests", () => {
  it("forwards the athlete token without caching", async () => {
    const send = respond(200, { status: "disconnected" });
    await client(send).getConnection(context);
    const [url, init] = send.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toBe("http://garmin.test/v1/connections/garmin");
    expect(headers.get("Authorization")).toBe("Bearer athlete-access-token");
    expect(headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("sends credentials in the documented shape", async () => {
    const send = respond(200, { status: "connected" });
    const result = await client(send).startConnection(context, {
      email: "athlete@example.com",
      password: "garmin-password",
      historyStartDate: "2018-01-01",
    });
    expect(result).toEqual({ ok: true, value: { status: "connected" } });
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({
      email: "athlete@example.com",
      password: "garmin-password",
      history_start_date: "2018-01-01",
    });
  });

  it("returns an MFA challenge and submits the code", async () => {
    const start = await client(
      respond(200, { status: "mfa_required", challenge_id: challengeId }),
    ).startConnection(context, { email: "a@example.com", password: "p" });
    expect(start).toEqual({
      ok: true,
      value: { status: "mfa_required", challengeId },
    });
    const send = respond(200, { status: "connected" });
    await client(send).continueMfa(context, { challengeId, otp: "123456" });
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({
      challenge_id: challengeId,
      otp: "123456",
    });
  });

  it("never exposes credentials, codes or tokens in failures", async () => {
    const log = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const results = [
      await client(
        respond(401, { error: { code: "invalid_credentials" } }),
      ).startConnection(context, {
        email: "athlete@example.com",
        password: "garmin-password",
      }),
      await client(
        respond(401, { error: { code: "invalid_mfa" } }),
      ).continueMfa(context, { challengeId, otp: "654321" }),
    ];
    const serialized = JSON.stringify(results);
    for (const secret of [
      "athlete@example.com",
      "garmin-password",
      "654321",
      challengeId,
      context.accessToken,
    ])
      expect(serialized).not.toContain(secret);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("Garmin client failures", () => {
  it.each([
    [401, "invalid_credentials", "invalid_credentials"],
    [401, "unauthorized", "session_expired"],
    [410, "challenge_expired", "expired_mfa"],
    [401, "invalid_mfa", "invalid_mfa"],
    [429, "rate_limited", "rate_limited"],
    [503, "provider_unavailable", "garmin_unavailable"],
    [503, "service_unavailable", "garmin_unavailable"],
    [503, "storage_unavailable", "garmin_unavailable"],
    [503, "dependency_unavailable", "garmin_unavailable"],
    [409, "connection_changed", "connection_failed"],
    [400, "invalid_request", "connection_failed"],
    [400, "something_new", "connection_failed"],
  ])("maps %i %s to %s", async (status, code, state) => {
    const result = await client(
      respond(status, { error: { code } }),
    ).startConnection(context, { email: "a@example.com", password: "p" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(connectFailure(result.failure).state).toBe(state);
  });

  it("treats timeouts, network errors and malformed bodies as unavailable", async () => {
    const timeout = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const network = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const results = await Promise.all([
      client(timeout).getConnection(context),
      client(network).getConnection(context),
      client(respond(502, "<html>Bad gateway</html>")).getConnection(context),
      client(respond(200, { status: "paused" })).getConnection(context),
      client(
        respond(200, { status: "mfa_required", challenge_id: "not-a-uuid" }),
      ).startConnection(context, { email: "a@example.com", password: "p" }),
    ]);
    expect(results.map((result) => !result.ok && result.failure.code)).toEqual([
      "timeout",
      "network",
      "malformed",
      "malformed",
      "malformed",
    ]);
    for (const result of results)
      if (!result.ok)
        expect(connectFailure(result.failure).state).toBe("garmin_unavailable");
  });

  it("uses retry timing only when the service returns it", async () => {
    const withoutTiming = await client(
      respond(429, { error: { code: "rate_limited" } }),
    ).getConnection(context);
    const fromHeader = await client(
      respond(
        429,
        { error: { code: "rate_limited" } },
        { "Retry-After": "90" },
      ),
    ).getConnection(context);
    const fromBody = await client(
      respond(429, {
        error: { code: "rate_limited", retry_after_seconds: 30 },
      }),
    ).getConnection(context);
    expect(!withoutTiming.ok && connectFailure(withoutTiming.failure)).toEqual({
      state: "rate_limited",
      canRetryCode: false,
    });
    expect(!fromHeader.ok && fromHeader.failure.retryAfterSeconds).toBe(90);
    expect(!fromBody.ok && connectFailure(fromBody.failure)).toMatchObject({
      retryAfterSeconds: 30,
    });
  });

  it("allows another code only when the challenge is explicitly still usable", () => {
    const failure = (extra: Partial<GarminFailure>) =>
      connectFailure({ code: "invalid_mfa", ...extra }).canRetryCode;
    expect(failure({})).toBe(false);
    expect(failure({ challengeConsumed: true, attemptsRemaining: 2 })).toBe(
      false,
    );
    expect(failure({ challengeConsumed: false, attemptsRemaining: 0 })).toBe(
      false,
    );
    expect(failure({ challengeConsumed: false, attemptsRemaining: 2 })).toBe(
      true,
    );
  });
});

describe("Garmin sync status", () => {
  it("reads a sync that has not started", async () => {
    const result = await client(
      respond(200, {
        state: "not_started",
        categories: {
          activities: pending,
          recovery: pending,
          fitness: pending,
          patterns: pending,
        },
      }),
    ).getSync(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.started).toBe(false);
    expect(syncPhase(result.value)).toBe("not_started");
    expect(isSyncActive(result.value)).toBe(false);
  });

  it("keeps real counts and dates without deriving progress", async () => {
    const result = await client(
      respond(200, {
        connection_id: "2b7d3c4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
        categories: {
          activities: {
            state: "running",
            oldest_synchronized_date: "2021-03-14",
            last_success_at: "2026-10-09T10:00:00+00:00",
            last_error_code: null,
            activity_count: 1486,
          },
          recovery: {
            state: "complete",
            oldest_synchronized_date: "2026-07-11",
            last_success_at: null,
            last_error_code: null,
          },
          fitness: {
            state: "partial",
            oldest_synchronized_date: null,
            last_success_at: null,
            last_error_code: null,
          },
          patterns: { state: "partial" },
        },
        last_sync_at: null,
        incremental: null,
        updated_at: "2026-10-09T10:00:00+00:00",
      }),
    ).getSync(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories.activities).toEqual({
      state: "running",
      oldestSynchronizedDate: "2021-03-14",
      lastSuccessAt: "2026-10-09T10:00:00+00:00",
      lastErrorCode: null,
      activityCount: 1486,
    });
    expect(result.value.categories.recovery.activityCount).toBeNull();
    expect(syncPhase(result.value)).toBe("importing");
    expect(isSyncActive(result.value)).toBe(true);
  });

  it("rejects a started sync without its connection", async () => {
    const result = await client(
      respond(200, {
        categories: {
          activities: pending,
          recovery: pending,
          fitness: pending,
          patterns: pending,
        },
      }),
    ).getSync(context);
    expect(!result.ok && result.failure.code).toBe("malformed");
  });

  it("flags failed categories for attention and stops polling when settled", () => {
    const category = (state: "complete" | "failed") => ({
      state,
      oldestSynchronizedDate: null,
      lastSuccessAt: null,
      lastErrorCode: null,
      activityCount: null,
    });
    const status: GarminSyncStatus = {
      started: true,
      categories: {
        activities: category("failed"),
        recovery: category("complete"),
        fitness: category("complete"),
        patterns: category("complete"),
      },
      lastSyncAt: null,
      updatedAt: null,
    };
    expect(syncPhase(status)).toBe("attention");
    expect(isSyncActive(status)).toBe(false);
    status.categories.activities = category("complete");
    expect(syncPhase(status)).toBe("complete");
  });
});

describe("Garmin client against the contract fixture", () => {
  const service = createGarminService();
  let garmin: ReturnType<typeof createGarminClient>;

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      service.listen(0, "127.0.0.1", resolve),
    );
    const { port } = service.address() as AddressInfo;
    garmin = createGarminClient({ baseUrl: `http://127.0.0.1:${port}` });
  });

  afterAll(() => new Promise((resolve) => service.close(resolve)));

  it("connects through MFA and reports a consumed challenge as expired", async () => {
    const athlete = { accessToken: "fixture-athlete-mfa" };
    const first = await garmin.startConnection(athlete, {
      email: "mfa@example.com",
      password: "correct-password",
    });
    if (!first.ok || first.value.status !== "mfa_required")
      throw new Error("expected an MFA challenge");
    const invalid = await garmin.continueMfa(athlete, {
      challengeId: first.value.challengeId,
      otp: "000000",
    });
    expect(!invalid.ok && connectFailure(invalid.failure).state).toBe(
      "invalid_mfa",
    );
    const reused = await garmin.continueMfa(athlete, {
      challengeId: first.value.challengeId,
      otp: "123456",
    });
    expect(!reused.ok && connectFailure(reused.failure).state).toBe(
      "expired_mfa",
    );
    const second = await garmin.startConnection(athlete, {
      email: "mfa@example.com",
      password: "correct-password",
    });
    if (!second.ok || second.value.status !== "mfa_required")
      throw new Error("expected an MFA challenge");
    expect(
      await garmin.continueMfa(athlete, {
        challengeId: second.value.challengeId,
        otp: "123456",
      }),
    ).toEqual({ ok: true, value: { status: "connected" } });
    const connection = await garmin.getConnection(athlete);
    expect(connection.ok && connection.value.status).toBe("connected");
  });

  it("follows a sync to completion with growing real counts", async () => {
    const athlete = { accessToken: "fixture-athlete-sync" };
    const before = await garmin.getSync(athlete);
    expect(before.ok && before.value.started).toBe(false);
    await garmin.startConnection(athlete, {
      email: "athlete@example.com",
      password: "correct-password",
    });
    const counts: number[] = [];
    for (let read = 0; read < 10; read += 1) {
      const sync = await garmin.getSync(athlete);
      if (!sync.ok) throw new Error(sync.failure.code);
      counts.push(sync.value.categories.activities.activityCount ?? 0);
      if (!isSyncActive(sync.value)) break;
    }
    expect(counts).toEqual([25, 50, 75, 100]);
  });

  it("keeps athletes isolated and rejects missing tokens", async () => {
    const other = await garmin.getConnection({ accessToken: "fixture-other" });
    expect(other.ok && other.value.status).toBe("disconnected");
    const anonymous = await garmin.getConnection({ accessToken: "invalid" });
    expect(!anonymous.ok && connectFailure(anonymous.failure).state).toBe(
      "session_expired",
    );
  });
});

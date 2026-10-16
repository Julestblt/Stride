import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const apply = vi.hoisted(() => ({
  applyAcceptedProposal: vi.fn(),
  resetPlan: vi.fn(),
}));
const getUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { getUser } })));

vi.mock("../../src/server/coaching/worker/apply", () => apply);
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { handleWorkerRequest } from "../../src/server/coaching/worker/handler";

const proposalId = "30000000-0000-4000-8000-000000000003";

describe("coach worker requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    getUser.mockResolvedValue({
      data: { user: { id: "a0000000-0000-4000-8000-00000000000a" } },
      error: null,
    });
    apply.applyAcceptedProposal.mockResolvedValue({ ok: true, version: 2 });
    apply.resetPlan.mockResolvedValue({ ok: true });
  });

  it("answers health checks without credentials", async () => {
    expect(
      await handleWorkerRequest({
        method: "GET",
        path: "/healthz",
        authorization: undefined,
      }),
    ).toEqual({ status: 200, body: { ok: true } });
  });

  it("refuses requests without a verified athlete token", async () => {
    const missing = await handleWorkerRequest({
      method: "POST",
      path: "/v1/plan/reset",
      authorization: undefined,
    });
    expect(missing.status).toBe(401);
    getUser.mockResolvedValue({ data: { user: null }, error: new Error() });
    const invalid = await handleWorkerRequest({
      method: "POST",
      path: "/v1/plan/reset",
      authorization: "Bearer forged.token.value",
    });
    expect(invalid.status).toBe(401);
    expect(apply.resetPlan).not.toHaveBeenCalled();
  });

  it("applies a proposal as the verified athlete", async () => {
    const response = await handleWorkerRequest({
      method: "POST",
      path: `/v1/proposals/${proposalId}/apply`,
      authorization: "Bearer athlete.token.value",
    });
    expect(response).toEqual({ status: 200, body: { ok: true, version: 2 } });
    expect(createClient).toHaveBeenCalledWith(
      "https://supabase.test",
      "sb_publishable_test",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer athlete.token.value" } },
      }),
    );
    expect(apply.applyAcceptedProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "a0000000-0000-4000-8000-00000000000a",
        accessToken: "athlete.token.value",
      }),
      proposalId,
    );
  });

  it("rejects unknown routes and malformed proposal ids", async () => {
    expect(
      (
        await handleWorkerRequest({
          method: "POST",
          path: "/v1/proposals/not-a-uuid/apply",
          authorization: "Bearer athlete.token.value",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await handleWorkerRequest({
          method: "POST",
          path: "/v1/sql",
          authorization: "Bearer athlete.token.value",
        })
      ).status,
    ).toBe(404);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("reports refused applies as conflicts", async () => {
    apply.applyAcceptedProposal.mockResolvedValue({
      ok: false,
      reason: "not_accepted",
    });
    expect(
      await handleWorkerRequest({
        method: "POST",
        path: `/v1/proposals/${proposalId}/apply`,
        authorization: "Bearer athlete.token.value",
      }),
    ).toEqual({ status: 409, body: { ok: false, reason: "not_accepted" } });
  });
});

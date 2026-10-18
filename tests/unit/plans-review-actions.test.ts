import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.hoisted(() => vi.fn());
const requestProposalApply = vi.hoisted(() => vi.fn());
const getOnboardingContext = vi.hoisted(() => vi.fn());
const syncWatchAfterResponse = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../src/server/coaching/worker-client", () => ({
  requestProposalApply,
}));
vi.mock("../../src/server/onboarding/context", () => ({
  getOnboardingContext,
}));
vi.mock("../../src/server/garmin/watch", () => ({ syncWatchAfterResponse }));

import {
  acceptProposal,
  rejectProposal,
  retryProposal,
} from "../../src/server/plans/actions";

const proposalId = "30000000-0000-4000-8000-000000000003";

describe("proposal actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
    getOnboardingContext.mockResolvedValue({
      client: { rpc },
      userId: "a0000000-0000-4000-8000-00000000000a",
    });
  });

  it("accepts then applies through the worker", async () => {
    requestProposalApply.mockResolvedValue({ ok: true, version: 5 });
    expect(await acceptProposal({ proposalId })).toEqual({
      status: "applied",
      version: 5,
    });
    expect(rpc).toHaveBeenCalledWith("accept_plan_proposal", {
      p_proposal_id: proposalId,
    });
    expect(requestProposalApply).toHaveBeenCalledOnce();
    expect(syncWatchAfterResponse).toHaveBeenCalledOnce();
  });

  it("reports a plan that moved between review and accept as stale", async () => {
    requestProposalApply.mockResolvedValue({
      ok: false,
      reason: "stale_version",
    });
    expect(await acceptProposal({ proposalId })).toEqual({
      status: "stale",
      reason: "stale_version",
    });
  });

  it("keeps the proposal pending when the worker is unavailable", async () => {
    requestProposalApply.mockResolvedValue({
      ok: false,
      reason: "worker_unavailable",
    });
    expect(await acceptProposal({ proposalId })).toEqual({ status: "pending" });
    expect(syncWatchAfterResponse).not.toHaveBeenCalled();
    requestProposalApply.mockResolvedValue({ ok: true, version: 5 });
    expect(await retryProposal({ proposalId })).toEqual({
      status: "applied",
      version: 5,
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("never applies when the accept call fails", async () => {
    rpc.mockResolvedValue({ error: { message: "invalid_state" } });
    expect(await acceptProposal({ proposalId })).toEqual({ status: "error" });
    expect(requestProposalApply).not.toHaveBeenCalled();
  });

  it("rejects without calling the worker", async () => {
    expect(await rejectProposal({ proposalId })).toEqual({
      status: "rejected",
    });
    expect(rpc).toHaveBeenCalledWith("reject_plan_proposal", {
      p_proposal_id: proposalId,
    });
    expect(requestProposalApply).not.toHaveBeenCalled();
  });

  it("refuses malformed input and expired sessions", async () => {
    expect(await acceptProposal({ proposalId: "nope" })).toEqual({
      status: "invalid-request",
    });
    getOnboardingContext.mockResolvedValue(null);
    expect(await rejectProposal({ proposalId })).toEqual({
      status: "session-expired",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

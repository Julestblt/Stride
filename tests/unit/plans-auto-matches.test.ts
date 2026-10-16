import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import type { Database } from "@/server/supabase/database.types";
import {
  matchesAreStale,
  readFreshSessionMatches,
  refreshSessionMatches,
} from "@/server/plans/auto-matches";
import type { StoredPlan } from "@/server/plans/stored";
import type { PlanSession } from "@/features/plans/model/plan";
import { easyRun } from "./plan-fixture";

const userId = "11111111-1111-4111-8111-111111111111";
const planId = "d1000000-0000-4000-8000-000000000001";
const activityId = "ac000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-16T10:00:00Z");
const plan = { activeVersion: 2, timeZone: "Europe/Paris" };

describe("match freshness", () => {
  const fresh = {
    computedAt: "2026-10-16T08:00:00Z",
    version: 2,
    activitiesThrough: "2026-10-16T07:00:00Z",
    latestChangeAt: "2026-10-16T07:00:00Z",
  };

  it("keeps matches computed today that include the latest activity change", () => {
    expect(matchesAreStale(fresh, plan, now)).toBe(false);
    expect(
      matchesAreStale(
        { ...fresh, activitiesThrough: null, latestChangeAt: null },
        plan,
        now,
      ),
    ).toBe(false);
  });

  it.each([
    ["never computed", { computedAt: null }],
    ["another plan version", { version: 1 }],
    ["a newer activity change", { latestChangeAt: "2026-10-16T09:00:00Z" }],
    [
      "an activity saved while matches were computed",
      { latestChangeAt: "2026-10-16T07:30:00Z" },
    ],
    ["a change after a run without activities", { activitiesThrough: null }],
    ["an earlier local day", { computedAt: "2026-10-15T21:00:00Z" }],
  ])("recomputes after %s", (_, change) => {
    expect(matchesAreStale({ ...fresh, ...change }, plan, now)).toBe(true);
  });

  it("uses the plan's local day", () => {
    expect(
      matchesAreStale(
        { ...fresh, computedAt: "2026-10-15T22:30:00Z" },
        plan,
        now,
      ),
    ).toBe(false);
  });
});

const yesterday: PlanSession = {
  ...easyRun(40),
  sessionKey: "run-yesterday",
  scheduledOn: "2026-10-15",
};

const stored: StoredPlan = {
  planId,
  status: "active",
  activeVersion: 2,
  version: 2,
  versionSummary: null,
  state: {
    plan: {
      title: "Plan",
      startsOn: "2026-10-01",
      endsOn: "2026-12-31",
      primaryRaceId: null,
      timeZone: "Europe/Paris",
    },
    sessions: [yesterday],
  } as unknown as StoredPlan["state"],
};

type Marker = {
  matches_computed_at: string | null;
  matches_version: number | null;
  matches_activities_through: string | null;
};

const staleMarker: Marker = {
  matches_computed_at: null,
  matches_version: null,
  matches_activities_through: null,
};

function fakeContext(tables: {
  marker: Marker;
  latestChange: string | null;
  athleteMatches?: unknown[];
  rpcError?: boolean;
}) {
  const rpc = vi.fn(async () =>
    tables.rpcError
      ? { data: null, error: { message: "stale_version" } }
      : { data: 1, error: null },
  );
  const from = vi.fn((table: string) => {
    const calls: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "not", "order", "limit"])
      chain[method] = (...args: unknown[]) => {
        calls.push(`${method}:${String(args[0])}`);
        return chain;
      };
    const result = () => {
      if (table === "training_plans")
        return { data: tables.marker, error: null };
      if (table === "session_activity_matches")
        return { data: tables.athleteMatches ?? [], error: null };
      if (calls.includes("select:updated_at"))
        return {
          data: tables.latestChange
            ? { updated_at: tables.latestChange }
            : null,
          error: null,
        };
      return {
        data: [
          {
            id: activityId,
            activity_type: "running",
            started_at: "2026-10-14T22:30:00Z",
            local_started_at: "2026-10-15 00:30:00",
            duration_seconds: 2400,
            distance_meters: "8000",
            average_heart_rate: 140,
            updated_at: "2026-10-16T06:00:00Z",
          },
        ],
        error: null,
      };
    };
    chain.maybeSingle = async () => result();
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve);
    return chain;
  });
  return {
    rpc,
    context: {
      userId,
      client: { from, rpc } as unknown as SupabaseClient<Database>,
    },
  };
}

describe("session match refresh", () => {
  it("records the matcher output on the local day of the activity", async () => {
    const { context, rpc } = fakeContext({
      marker: staleMarker,
      latestChange: "2026-10-16T06:00:00Z",
    });
    await expect(refreshSessionMatches(context, stored, now)).resolves.toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledWith("refresh_session_matches", {
      p_plan_id: planId,
      p_version: 2,
      p_matches: [
        expect.objectContaining({
          sessionKey: "run-yesterday",
          activityId,
          status: "completed",
        }),
      ],
      p_algorithm_version: "match-v1",
      p_activities_through: "2026-10-16T06:00:00Z",
    });
  });

  it("writes nothing when matches are fresh", async () => {
    const { context, rpc } = fakeContext({
      marker: {
        matches_computed_at: "2026-10-16T08:00:00Z",
        matches_version: 2,
        matches_activities_through: "2026-10-16T07:00:00Z",
      },
      latestChange: "2026-10-16T07:00:00Z",
    });
    await expect(refreshSessionMatches(context, stored, now)).resolves.toBe(
      false,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("leaves sessions the athlete matched to the athlete", async () => {
    const { context, rpc } = fakeContext({
      marker: staleMarker,
      latestChange: null,
      athleteMatches: [{ session_key: "run-yesterday", activity_id: null }],
    });
    await refreshSessionMatches(context, stored, now);
    expect(rpc).toHaveBeenCalledWith(
      "refresh_session_matches",
      expect.objectContaining({ p_matches: [] }),
    );
  });

  it("falls back to the stored matches when recording fails", async () => {
    const { context } = fakeContext({
      marker: staleMarker,
      latestChange: null,
      rpcError: true,
    });
    await expect(readFreshSessionMatches(context, stored)).resolves.toEqual([]);
  });
});

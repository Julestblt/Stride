import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../src/server/supabase/database.types";
import type { OnboardingContext } from "../../src/server/onboarding/context";
import { buildAthleteProfile } from "../../src/features/onboarding/athlete-profile";
import { emptyProfile } from "../../src/features/onboarding/profile";

vi.mock("server-only", () => ({}));
import { loadHistoryContext } from "../../src/server/ai/context/history";

const today = new Date("2026-10-10T12:00:00Z");
const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";

function setup(count: number, failedOffset?: number, failedRecovery = false) {
  const requests: URL[] = [];
  const rows = Array.from({ length: count }, (_, index) => ({
    started_at: index < 1000 ? "2026-01-01T06:00:00Z" : "2026-10-09T06:00:00Z",
    local_started_at: null,
    activity_type: index < 1000 ? "cycling" : "ultra_run",
    distance_meters: "10000",
    duration_seconds: "3600",
    elevation_gain_meters: null,
  }));
  const client = createClient<Database>("http://history.test", "session-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: vi.fn() as unknown as typeof WebSocket },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        const recovery = url.pathname.endsWith("provider_observations");
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const paginated = url.searchParams.has("offset");
        if (
          (paginated && offset === failedOffset) ||
          (recovery && failedRecovery)
        )
          return Response.json(
            { message: "Read failed", code: "XX000" },
            { status: 500 },
          );
        if (recovery)
          return Response.json([
            {
              metric: "resting_heart_rate_bpm",
              observed_on: "2026-10-09",
              value_numeric: "50",
            },
          ]);
        if (!paginated) return Response.json(null);
        const limit = Number(url.searchParams.get("limit"));
        return Response.json(
          rows.slice(offset, offset + Math.min(limit, 1000)),
        );
      },
    },
  });
  const context: OnboardingContext = {
    client,
    userId,
    email: "athlete@example.com",
    accessToken: "session-token",
  };
  return { context, requests };
}

function pages(requests: URL[]) {
  return requests.filter((url) => url.searchParams.has("offset"));
}

describe("authorized history pagination", () => {
  it("includes runs after the first thousand activities in the profile", async () => {
    const { context, requests } = setup(1001);
    const history = await loadHistoryContext(context, today);
    expect(history.activities).toHaveLength(1001);
    expect(history.activities.at(-1)).toMatchObject({
      type: "ultra_run",
      durationSeconds: 3600,
    });
    const view = buildAthleteProfile({
      today,
      profile: emptyProfile,
      goal: { focus: null },
      races: [],
      activityCount: 1001,
      firstActivityAt: "2026-01-01T06:00:00Z",
      activities: history.activities,
      observations: history.observations,
      vo2Max: null,
      maxHeartRate: null,
    });
    expect(view.weeks.at(-1)).toMatchObject({ hours: 1, activities: 1 });
    expect(view.activityCount).toBe(1001);
    expect(history.observations).toEqual([
      { metric: "resting_heart_rate_bpm", observedOn: "2026-10-09", value: 50 },
    ]);
    expect(
      pages(requests).map((url) => url.searchParams.get("offset")),
    ).toEqual(["0", "1000"]);
    for (const url of requests)
      expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
    for (const url of pages(requests)) {
      expect(url.searchParams.get("limit")).toBe("1000");
      expect(url.searchParams.get("order")).toBe("started_at.asc,id.asc");
      expect(url.searchParams.get("started_at")).toBe(
        "gte.2025-10-10T12:00:00.000Z",
      );
    }
  });

  it("reads an empty terminal page at exact page boundaries", async () => {
    const { context, requests } = setup(2000);
    expect((await loadHistoryContext(context, today)).activities).toHaveLength(
      2000,
    );
    expect(
      pages(requests).map((url) => url.searchParams.get("offset")),
    ).toEqual(["0", "1000", "2000"]);
  });

  it("returns empty history after a single empty page", async () => {
    const { context, requests } = setup(0);
    expect((await loadHistoryContext(context, today)).activities).toEqual([]);
    expect(pages(requests)).toHaveLength(1);
  });

  it("does not cap history at five thousand activities", async () => {
    const { context, requests } = setup(6001);
    expect((await loadHistoryContext(context, today)).activities).toHaveLength(
      6001,
    );
    expect(pages(requests)).toHaveLength(7);
  });

  it("rejects rather than returning partial history when a later page fails", async () => {
    const { context } = setup(1001, 1000);
    await expect(loadHistoryContext(context, today)).rejects.toThrow(
      "Unable to read imported history",
    );
  });

  it("retains failure handling for the recovery read", async () => {
    const { context } = setup(0, undefined, true);
    await expect(loadHistoryContext(context, today)).rejects.toThrow(
      "Unable to read imported history",
    );
  });
});

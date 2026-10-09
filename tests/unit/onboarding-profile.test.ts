import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/server/supabase/database.types";
vi.mock("server-only", () => ({}));
import {
  answeredCount,
  emptyProfile,
  missingRequiredFields,
  profileSaveSchema,
} from "../../src/features/onboarding/profile";
import { saveProfile } from "../../src/server/onboarding/profile";
import {
  buildKnownValues,
  buildSuggestions,
} from "../../src/features/onboarding/known-values";
import type { InsightActivity } from "../../src/features/insights/facts";

const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";
const row = (overrides: Record<string, unknown> = {}) => ({
  user_id: userId,
  first_name: "Ada",
  birth_date: "1991-06-14",
  sex: "female",
  height_cm: "168.0",
  weight_kg: 58,
  primary_terrain: "trail",
  available_weekdays: [2, 4, 6],
  long_run_day: "sunday",
  weekday_session_minutes: 60,
  training_access: ["hills"],
  value_sources: { weight_kg: { source: "athlete" } },
  revision: 4,
  updated_at: "2026-10-10T10:00:00Z",
  created_at: "2026-10-10T09:00:00Z",
  ...overrides,
});

describe("profile validation", () => {
  it("accepts partial saves with provenance and normalizes arrays", () => {
    const parsed = profileSaveSchema.parse({
      values: {
        available_weekdays: [6, 2, 2],
        training_access: ["track", "gym"],
      },
      sources: {
        available_weekdays: { source: "garmin", observed_on: "2026-10-10" },
      },
      revision: null,
    });
    expect(parsed.values).toEqual({
      available_weekdays: [2, 6],
      training_access: ["gym", "track"],
    });
  });
  it.each([
    [{ height_cm: 99 }],
    [{ weight_kg: 251 }],
    [{ weight_kg: 60.25 }],
    [{ weekday_session_minutes: 50 }],
    [{ available_weekdays: [0] }],
    [{ birth_date: "1899-12-31" }],
    [{ first_name: " " }],
    [{ revision: 2 }],
  ])("rejects %j", (values) => {
    expect(
      profileSaveSchema.safeParse({ values, sources: {}, revision: 1 }).success,
    ).toBe(false);
  });
  it("lists missing required fields and counts answers", () => {
    expect(missingRequiredFields(emptyProfile)).toHaveLength(9);
    const complete = {
      ...emptyProfile,
      first_name: "Ada",
      birth_date: "1991-06-14",
      sex: "female" as const,
      height_cm: 168,
      weight_kg: 58,
      primary_terrain: "trail" as const,
      available_weekdays: [2],
      long_run_day: "sunday" as const,
      weekday_session_minutes: 60,
    };
    expect(missingRequiredFields(complete)).toEqual([]);
    expect(answeredCount(complete)).toBe(9);
    expect(
      missingRequiredFields({ ...complete, available_weekdays: [] }),
    ).toEqual(["available_weekdays"]);
  });
});

function client(responses: {
  read: unknown[];
  write?: { data: unknown; error: { code: string } | null };
}) {
  const reads = [...responses.read];
  const calls: { kind: string; payload?: unknown; filters: unknown[] }[] = [];
  const filters: unknown[] = [];
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    }),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      const last = calls.at(-1);
      if (last && last.kind !== "read") return responses.write;
      return { data: reads.shift() ?? null, error: null };
    }),
  };
  const from = vi.fn(() => ({
    select: () => {
      calls.push({ kind: "read", filters });
      return chain;
    },
    insert: (payload: unknown) => {
      calls.push({ kind: "insert", payload, filters });
      return chain;
    },
    update: (payload: unknown) => {
      calls.push({ kind: "update", payload, filters });
      return chain;
    },
  }));
  return {
    context: async () => ({
      client: { from } as unknown as SupabaseClient<Database>,
      userId,
      email: null,
      accessToken: "token",
    }),
    calls,
    filters,
  };
}

describe("profile saves", () => {
  it("rejects invalid input and expired sessions before touching data", async () => {
    expect(
      await saveProfile({ context: async () => null }, { values: { x: 1 } }),
    ).toEqual({ status: "invalid" });
    expect(
      await saveProfile(
        { context: async () => null },
        { values: {}, sources: {}, revision: null },
      ),
    ).toEqual({ status: "session-expired" });
  });
  it("returns the current snapshot instead of writing on a stale revision", async () => {
    const fake = client({ read: [row({ revision: 5 })] });
    const result = await saveProfile(
      { context: fake.context },
      { values: { weight_kg: 60 }, sources: {}, revision: 4 },
    );
    expect(result).toMatchObject({
      status: "conflict",
      snapshot: { revision: 5, values: { weight_kg: 58, height_cm: 168 } },
    });
    expect(fake.calls.some((call) => call.kind === "update")).toBe(false);
  });
  it("inserts the first save and merges provenance", async () => {
    const fake = client({
      read: [null],
      write: { data: row({ revision: 1 }), error: null },
    });
    const result = await saveProfile(
      { context: fake.context },
      {
        values: { available_weekdays: [2, 4] },
        sources: {
          available_weekdays: { source: "garmin", observed_on: "2026-10-10" },
        },
        revision: null,
      },
    );
    expect(result.status).toBe("saved");
    expect(fake.calls.at(-1)).toMatchObject({
      kind: "insert",
      payload: {
        user_id: userId,
        available_weekdays: [2, 4],
        value_sources: {
          available_weekdays: { source: "garmin", observed_on: "2026-10-10" },
        },
      },
    });
  });
  it("updates conditionally on the expected revision", async () => {
    const fake = client({
      read: [row()],
      write: { data: row({ weight_kg: 60, revision: 5 }), error: null },
    });
    const result = await saveProfile(
      { context: fake.context },
      {
        values: { weight_kg: 60 },
        sources: { weight_kg: { source: "athlete" } },
        revision: 4,
      },
    );
    expect(result).toMatchObject({
      status: "saved",
      snapshot: { revision: 5, values: { weight_kg: 60 } },
    });
    expect(fake.filters).toContainEqual(["revision", 4]);
    expect(fake.filters).toContainEqual(["user_id", userId]);
  });
  it("treats a lost race as a conflict and database checks as invalid", async () => {
    const lost = client({
      read: [row(), row({ revision: 6 })],
      write: { data: null, error: null },
    });
    expect(
      await saveProfile(
        { context: lost.context },
        { values: { weight_kg: 60 }, sources: {}, revision: 4 },
      ),
    ).toMatchObject({ status: "conflict", snapshot: { revision: 6 } });
    const invalid = client({
      read: [row()],
      write: { data: null, error: { code: "23514" } },
    });
    expect(
      await saveProfile(
        { context: invalid.context },
        { values: { weight_kg: 60 }, sources: {}, revision: 4 },
      ),
    ).toEqual({ status: "invalid" });
  });
});

const today = new Date("2026-10-10T12:00:00Z");
function runs(type: string, weekdays: number[], weeks = 20): InsightActivity[] {
  return Array.from({ length: weeks }, (_, week) =>
    weekdays.map((weekday) => {
      const date = new Date(Date.UTC(2026, 4, 3 + week * 7 + weekday));
      return {
        startedAt: date.toISOString(),
        localStartedAt: date.toISOString().slice(0, 19),
        type,
        distanceMeters: 10_000,
        durationSeconds: 3_600,
        elevationGainMeters: 0,
      };
    }),
  ).flat();
}

describe("known values and suggestions", () => {
  const base = {
    today,
    activities: runs("running", [2, 4, 6]),
    observations: [],
    firstRunAt: "2025-06-13T07:00:00Z",
    vo2Max: { value: 52.4, observedOn: "2026-10-07" },
    maxHeartRate: {
      value: 188,
      startedAt: "2026-09-12T06:00:00Z",
      distanceMeters: 62_961,
    },
  };
  it("lists only values backed by imported data", () => {
    expect(buildKnownValues(base)).toEqual([
      {
        key: "max_hr",
        label: "FC max",
        value: "188",
        detail: "Observée · 63 km, sept. 2026",
      },
      {
        key: "vo2_max",
        label: "VO₂ max",
        value: "52",
        detail: "Garmin · il y a 3 jours",
      },
      {
        key: "running_since",
        label: "Course à pied depuis",
        value: "2025",
        detail: "Première activité",
      },
      {
        key: "usual_days",
        label: "Jours d’entraînement habituels",
        value: "Mar Jeu Sam",
        detail: "Habitude · 12 mois",
      },
    ]);
    expect(
      buildKnownValues({
        ...base,
        activities: [],
        firstRunAt: null,
        vo2Max: null,
        maxHeartRate: null,
      }),
    ).toEqual([]);
  });
  it("suggests usual days in ISO order and a terrain from running distance", () => {
    expect(buildSuggestions(base)).toEqual({
      observedOn: "2026-10-10",
      available_weekdays: [2, 4, 6],
      primary_terrain: {
        value: "road",
        note: "La route fait l’essentiel de ta course à pied sur 12 mois.",
      },
    });
    expect(
      buildSuggestions({
        ...base,
        activities: [...runs("trail_running", [6, 0]), ...runs("running", [2])],
      }).primary_terrain?.value,
    ).toBe("trail");
  });
});

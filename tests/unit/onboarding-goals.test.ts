import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/server/supabase/database.types";
vi.mock("server-only", () => ({}));
import {
  formatDuration,
  goalSaveSchema,
  missingRaceFields,
  parseDuration,
  raceSaveSchema,
  resolveRaceSnapshots,
  type RaceValues,
} from "../../src/features/onboarding/goals";
import {
  createRace,
  deleteRaces,
  saveGoal,
  saveRace,
} from "../../src/server/onboarding/goals";
import { readRaceCourses } from "../../src/server/races/courses";

const userId = "53d17ee9-4940-4be0-8bbe-6c35703a963d";
const raceId = "8e0d2b3c-7c1a-4e4b-9a55-0c1f0f8d3b21";
const at = "2026-10-10T10:00:00Z";
const raceRow = (overrides: Record<string, unknown> = {}) => ({
  id: raceId,
  user_id: userId,
  name: "EcoTrail Paris",
  race_kind: "trail",
  race_date: "2027-03-20",
  distance_km: "120.00",
  elevation_gain_m: 2000,
  priority: "A",
  target_duration_seconds: null,
  revision: 3,
  updated_at: at,
  created_at: at,
  ...overrides,
});

describe("goal and race validation", () => {
  it("parses and formats target times", () => {
    expect(parseDuration("18:30")).toBe(66_600);
    expect(parseDuration("3h45")).toBe(13_500);
    expect(parseDuration("2:05:30")).toBe(7_530);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("3:75")).toBeUndefined();
    expect(parseDuration("abc")).toBeUndefined();
    expect(parseDuration("400:00")).toBeUndefined();
    expect(formatDuration(13_500)).toBe("3:45");
    expect(formatDuration(7_530)).toBe("2:05:30");
    expect(formatDuration(null)).toBe("");
  });
  it("requires name, date and distance for a race to count", () => {
    expect(
      missingRaceFields({
        race_kind: "road",
        name: null,
        race_date: "2027-03-20",
        distance_km: null,
        elevation_gain_m: null,
        priority: "A",
        target_duration_seconds: null,
      }),
    ).toEqual(["name", "distance_km"]);
  });
  it.each([
    [{ distance_km: 0 }],
    [{ distance_km: 1001 }],
    [{ distance_km: 42.195 }],
    [{ elevation_gain_m: -1 }],
    [{ elevation_gain_m: 12.5 }],
    [{ priority: "D" }],
    [{ race_kind: "track" }],
    [{ target_duration_seconds: 0 }],
    [{ name: "x".repeat(121) }],
    [{ unknown: 1 }],
  ])("rejects race values %j", (values) => {
    expect(
      raceSaveSchema.safeParse({ id: raceId, values, revision: 1 }).success,
    ).toBe(false);
  });
  it("stores an explicit route or trail choice independently of distance", () => {
    expect(
      raceSaveSchema.safeParse({
        id: raceId,
        revision: 3,
        values: { race_kind: "road", distance_km: 60 },
      }).success,
    ).toBe(true);
  });
  it("accepts goal focuses only from the approved list", () => {
    expect(
      goalSaveSchema.safeParse({ values: { focus: "trail" }, revision: null })
        .success,
    ).toBe(true);
    expect(
      goalSaveSchema.safeParse({ values: { focus: "triathlon" }, revision: 1 })
        .success,
    ).toBe(false);
  });
});

function fakeClient(
  handlers: Record<
    string,
    (calls: { method: string; args: unknown[] }[]) => unknown
  >,
) {
  const log: { table: string; calls: { method: string; args: unknown[] }[] }[] =
    [];
  const from = vi.fn((table: string) => {
    const calls: { method: string; args: unknown[] }[] = [];
    log.push({ table, calls });
    const chain: Record<string, unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "in",
      "order",
    ])
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    const finish = async () => {
      const kind =
        calls.find((call) =>
          ["insert", "update", "delete"].includes(call.method),
        )?.method ?? "select";
      return (
        handlers[`${table}.${kind}`]?.(calls) ?? { data: null, error: null }
      );
    };
    chain.maybeSingle = finish;
    chain.single = finish;
    chain.then = (resolve: (value: unknown) => unknown) =>
      finish().then(resolve);
    return chain;
  });
  return {
    log,
    context: async () => ({
      client: { from } as unknown as SupabaseClient<Database>,
      userId,
      email: null,
      accessToken: "token",
    }),
  };
}

describe("goal saves", () => {
  it("inserts the first focus and updates later ones on the expected revision", async () => {
    const first = fakeClient({
      "athlete_goals.select": () => ({ data: null, error: null }),
      "athlete_goals.insert": () => ({
        data: { user_id: userId, focus: "trail", revision: 1, updated_at: at },
        error: null,
      }),
    });
    expect(
      await saveGoal(
        { context: first.context },
        { values: { focus: "trail" }, revision: null },
      ),
    ).toEqual({
      status: "saved",
      snapshot: { values: { focus: "trail" }, revision: 1 },
    });
    const stale = fakeClient({
      "athlete_goals.select": () => ({
        data: { user_id: userId, focus: "faster", revision: 4, updated_at: at },
        error: null,
      }),
    });
    expect(
      await saveGoal(
        { context: stale.context },
        { values: { focus: "trail" }, revision: 3 },
      ),
    ).toEqual({
      status: "conflict",
      snapshot: { values: { focus: "faster" }, revision: 4 },
    });
    expect(
      stale.log.some((entry) =>
        entry.calls.some((call) => call.method === "update"),
      ),
    ).toBe(false);
  });
});

describe("race saves", () => {
  it("updates only the athlete's race at the expected revision", async () => {
    const fake = fakeClient({
      "athlete_races.update": () => ({
        data: raceRow({ name: "UTMB", revision: 4 }),
        error: null,
      }),
    });
    const result = await saveRace(
      { context: fake.context },
      { id: raceId, values: { name: "UTMB" }, revision: 3 },
    );
    expect(result).toMatchObject({
      status: "saved",
      snapshot: { revision: 4, values: { name: "UTMB", distance_km: 120 } },
    });
    const filters = fake.log[0].calls.filter((call) => call.method === "eq");
    expect(filters.map((call) => call.args)).toEqual([
      ["user_id", userId],
      ["id", raceId],
      ["revision", 3],
    ]);
  });
  it("reports conflicts and races deleted on another device", async () => {
    const conflict = fakeClient({
      "athlete_races.update": () => ({ data: null, error: null }),
      "athlete_races.select": () => ({
        data: raceRow({ revision: 5 }),
        error: null,
      }),
    });
    expect(
      await saveRace(
        { context: conflict.context },
        { id: raceId, values: { name: "UTMB" }, revision: 3 },
      ),
    ).toMatchObject({ status: "conflict", snapshot: { revision: 5 } });
    const missing = fakeClient({
      "athlete_races.update": () => ({ data: null, error: null }),
    });
    expect(
      await saveRace(
        { context: missing.context },
        { id: raceId, values: { name: "UTMB" }, revision: 3 },
      ),
    ).toEqual({ status: "missing" });
  });
  it("creates races up to the limit and deletes only owned races", async () => {
    const full = fakeClient({
      "athlete_races.select": () => ({ count: 10, error: null }),
    });
    expect(await createRace({ context: full.context })).toEqual({
      status: "invalid",
    });
    const created = fakeClient({
      "athlete_races.select": () => ({ count: 1, error: null }),
      "athlete_races.insert": () => ({
        data: raceRow({ name: null, race_date: null, distance_km: null }),
        error: null,
      }),
    });
    expect(await createRace({ context: created.context })).toMatchObject({
      status: "created",
      race: { id: raceId, values: { priority: "A", name: null } },
    });
    const deleting = fakeClient({
      "athlete_races.delete": () => ({ error: null }),
    });
    expect(
      await deleteRaces({ context: deleting.context }, { ids: [raceId] }),
    ).toEqual({ status: "deleted" });
    expect(deleting.log[0].calls.map((call) => call.method)).toEqual([
      "delete",
      "eq",
      "in",
    ]);
    expect(
      await deleteRaces({ context: deleting.context }, { ids: ["nope"] }),
    ).toEqual({ status: "invalid" });
  });
});

describe("race course resolution", () => {
  const typed: RaceValues = {
    race_kind: "trail",
    name: "EcoTrail Paris",
    race_date: "2027-03-20",
    distance_km: 50,
    elevation_gain_m: 900,
    priority: "A",
    target_duration_seconds: null,
  };
  const race = { id: raceId, revision: 1, values: typed };

  it("prefers the imported course distance and elevation", () => {
    const [resolved] = resolveRaceSnapshots(
      [race],
      new Map([[raceId, { distanceM: 48_912, elevationGainM: 1_210 }]]),
    );
    expect(resolved).toEqual({
      ...race,
      values: { ...typed, distance_km: 48.91, elevation_gain_m: 1_210 },
    });
  });

  it("keeps the typed elevation when the course has none", () => {
    const [resolved] = resolveRaceSnapshots(
      [race],
      new Map([[raceId, { distanceM: 48_900, elevationGainM: null }]]),
    );
    expect(resolved.values).toMatchObject({
      distance_km: 48.9,
      elevation_gain_m: 900,
    });
  });

  it("keeps the typed values without a course", () => {
    expect(resolveRaceSnapshots([race], new Map())).toEqual([race]);
  });

  it("reads no course when the courses query fails", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;
    await expect(
      readRaceCourses({ client, userId, email: null, accessToken: "token" }),
    ).resolves.toEqual(new Map());
  });

  it("maps course rows by race", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                race_id: raceId,
                distance_m: "48900.0",
                elevation_gain_m: 1210,
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;
    await expect(
      readRaceCourses({ client, userId, email: null, accessToken: "token" }),
    ).resolves.toEqual(
      new Map([[raceId, { distanceM: 48_900, elevationGainM: 1_210 }]]),
    );
  });
});

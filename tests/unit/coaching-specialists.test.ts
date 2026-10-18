import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingContext } from "../../src/server/onboarding/context";
import { mondayOf } from "../../src/features/plans/model/dates";
import { planState } from "./plan-fixture";

vi.mock("server-only", () => ({}));

const sources = vi.hoisted(() => ({
  readActivePlan: vi.fn(),
  readWorkspace: vi.fn(),
  weatherFor: vi.fn(),
  readPlanningHealth: vi.fn(),
}));

vi.mock("../../src/server/plans/stored", () => ({
  readActivePlan: sources.readActivePlan,
}));
vi.mock("../../src/server/races/races", () => ({
  readWorkspace: sources.readWorkspace,
}));
vi.mock("../../src/server/races/views", () => ({
  weatherFor: sources.weatherFor,
}));
vi.mock("../../src/server/plans/health", () => ({
  readPlanningHealth: sources.readPlanningHealth,
}));

import { agentTools } from "../../src/server/coaching/tools/registry";
import { readSeasonCalendarTool } from "../../src/server/coaching/tools/season-calendar";
import { readRaceStrategyTool } from "../../src/server/coaching/tools/race-strategy";
import {
  healthFlagsOf,
  nutritionDays,
} from "../../src/server/nutrition/targets";
import { nutritionView } from "../../src/features/nutrition/view";
import type { PlanningHealth } from "../../src/features/plans/health/health";

const athlete = "a0000000-0000-4000-8000-00000000000a";

function racesClient(rows: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return { from: vi.fn(() => query) };
}

function contextWith(client: unknown) {
  return { userId: athlete, client } as unknown as OnboardingContext;
}

const noHealth: PlanningHealth = { conditions: [], readiness: [] };

beforeEach(() => {
  vi.clearAllMocks();
  sources.readActivePlan.mockResolvedValue(null);
});

describe("specialist tool access", () => {
  const writes = [
    "submit_plan",
    "create_plan_proposal",
    "extend_plan",
    "record_condition_report",
    "update_condition_report",
  ];

  it("gives each new specialist its own read tool and no write tool", () => {
    expect(agentTools.director).toContain("read_season_calendar");
    expect(agentTools.strategist).toContain("read_race_strategy");
    expect(agentTools.nutritionist).toContain("read_nutrition_targets");
    for (const agent of ["director", "strategist", "nutritionist"] as const) {
      expect(agentTools[agent]).toEqual(
        expect.arrayContaining(["ask_athlete", "message_athlete"]),
      );
      for (const name of writes) expect(agentTools[agent]).not.toContain(name);
    }
    expect(agentTools.coach).not.toContain("read_season_calendar");
  });
});

describe("read_season_calendar", () => {
  it("checks saved races with a candidate the athlete mentions", async () => {
    const client = racesClient([
      {
        id: "r-10k",
        name: "10 km Tour Eiffel",
        race_date: "2026-12-06",
        distance_km: 10,
        elevation_gain_m: 0,
        race_kind: "road",
        priority: "B",
      },
      {
        id: "r-120",
        name: "Ecotrail 120 km",
        race_date: "2027-03-20",
        distance_km: 120,
        elevation_gain_m: 1459,
        race_kind: "trail",
        priority: "A",
      },
    ]);
    const result = await readSeasonCalendarTool.run!(contextWith(client), {
      candidates: [
        {
          name: "Trail de préparation",
          date: "2027-03-06",
          distanceKm: 30,
          elevationGainM: 800,
          kind: "trail",
          role: "fun",
        },
      ],
    });
    expect(result.races.map((race) => race.id)).toEqual([
      "r-10k",
      "candidate-1",
      "r-120",
    ]);
    expect(result.races.at(-1)).toMatchObject({
      role: "primary",
      taperStartsOn: "2027-02-27",
    });
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: "inside_taper",
        firstRaceId: "candidate-1",
        secondRaceId: "r-120",
      }),
    ]);
    expect(readSeasonCalendarTool.output.safeParse(result).success).toBe(true);
  });

  it("ignores races more than 180 days old", async () => {
    const client = racesClient([
      {
        id: "old",
        name: "Ancienne course",
        race_date: "2020-01-01",
        distance_km: 21,
        elevation_gain_m: 0,
        race_kind: "road",
        priority: "B",
      },
    ]);
    const result = await readSeasonCalendarTool.run!(contextWith(client), {
      candidates: [],
    });
    expect(result.races).toEqual([]);
  });
});

describe("read_race_strategy", () => {
  it("refuses an id that is not one of the athlete's races", async () => {
    await expect(
      readRaceStrategyTool.run!(contextWith({}), { raceId: "nope" }),
    ).rejects.toMatchObject({ code: "not_found" });
    sources.readWorkspace.mockResolvedValue(null);
    await expect(
      readRaceStrategyTool.run!(contextWith({}), {
        raceId: "b0000000-0000-4000-8000-00000000000b",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("says when no course is imported instead of inventing scenarios", async () => {
    sources.readWorkspace.mockResolvedValue({
      race: {
        id: "b0000000-0000-4000-8000-00000000000b",
        name: "Ecotrail 120 km",
        kind: "trail",
        date: "2027-03-20",
        distanceKm: 120,
        elevationGainM: 1459,
        priority: "A",
        targetSeconds: 50_400,
        revision: 1,
      },
      plan: { startMinutes: null, startConfirmed: false, cutoffSeconds: null },
      course: null,
      waypoints: [],
      checklist: [],
    });
    const result = await readRaceStrategyTool.run!(contextWith({}), {
      raceId: "b0000000-0000-4000-8000-00000000000b",
    });
    expect(result).toMatchObject({
      hasCourse: false,
      scenarios: [],
      weather: null,
    });
    expect(sources.weatherFor).not.toHaveBeenCalled();
  });
});

describe("nutrition targets", () => {
  const profile = {
    birthDate: "1991-06-14",
    sex: "male",
    heightCm: 178,
    weightKg: 68.2,
  };

  it("turns open health reports and red readiness into deficit guards", () => {
    expect(healthFlagsOf(noHealth)).toEqual([]);
    expect(
      healthFlagsOf({
        conditions: [
          {
            kind: "pain",
            severity: 3,
            status: "active",
            worsening: false,
            systemicSymptoms: false,
            redFlag: false,
          },
          {
            kind: "pain",
            severity: 5,
            status: "monitoring",
            worsening: false,
            systemicSymptoms: false,
            redFlag: false,
          },
          {
            kind: "illness",
            severity: 6,
            status: "resolved",
            worsening: false,
            systemicSymptoms: false,
            redFlag: false,
          },
        ],
        readiness: [{ date: "2026-10-18", level: "red" }],
      }),
    ).toEqual(["injury", "poor_readiness"]);
  });

  it("follows the planned sessions and refuses a deficit in a taper week", () => {
    const state = planState();
    const session = state.sessions.find((item) => item.sport === "run")!;
    const week = state.weeks.find(
      (item) => item.weekStart === mondayOf(session.scheduledOn),
    )!;
    const plan = {
      ...state,
      weeks: state.weeks.map((item) =>
        item.weekKey === week.weekKey
          ? { ...item, weekType: "taper" as const }
          : item,
      ),
    };
    const [day] = nutritionDays(
      { profile, plan, races: [], health: noHealth },
      session.scheduledOn,
      1,
      true,
    );
    expect(day.ok).toBe(true);
    if (!day.ok) return;
    expect(day.energy.trainingKcal).toBeGreaterThan(0);
    expect(day.inputsUsed.weekType).toBe("taper");
    expect(day.deficit).toMatchObject({ status: "refused" });
  });

  it("formats a French view and reports missing profile fields", () => {
    const results = nutritionDays(
      { profile, plan: null, races: [], health: noHealth },
      "2026-10-18",
      7,
      false,
    );
    const view = nutritionView(results, [], "2026-10-18");
    expect(view.status).toBe("ready");
    if (view.status !== "ready") return;
    expect(view.today.headline).toMatch(
      /^Environ \d \d{3} kcal aujourd’hui\.$/,
    );
    expect(view.today.dateLabel).toBe("dim. 18/10");
    expect(view.days).toHaveLength(7);
    expect(view.days[0]).toMatchObject({
      today: true,
      session: "Repos",
      dayTypeLabel: "Repos",
    });
    expect(view.today.method[2]).toMatchObject({ estimated: true });

    const missing = nutritionView(
      nutritionDays(
        {
          profile: { ...profile, weightKg: null, heightCm: null },
          plan: null,
          races: [],
          health: noHealth,
        },
        "2026-10-18",
        1,
        false,
      ),
      [],
      "2026-10-18",
    );
    expect(missing).toEqual({
      status: "missing",
      missing: ["Taille", "Poids"],
    });
  });
});

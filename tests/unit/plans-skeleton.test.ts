import { describe, expect, it } from "vitest";
import type { PlanningConstraints } from "@/features/plans/constraints";
import { assessFeasibility } from "@/features/plans/feasibility/feasibility";
import {
  historyForValidation,
  summarizeHistory,
  type HistoryActivity,
} from "@/features/plans/history/summary";
import { addDays, isMonday } from "@/features/plans/model/dates";
import {
  resolveObjective,
  type ObjectiveRace,
} from "@/features/plans/skeleton/objective";
import {
  buildSkeleton,
  planStart,
  type Availability,
} from "@/features/plans/skeleton/skeleton";
import {
  allocatePhaseWeeks,
  matchTemplate,
  planTemplates,
  preRacePhases,
  resolveTemplateWeeks,
  templateIds,
} from "@/features/plans/templates/templates";
import { validatePlan } from "@/features/plans/validation/validate";

const today = "2026-10-14";

const history = (
  weeklyMinutes: number,
  weeks = 16,
  type = "running",
  gainPerWeek = 0,
): HistoryActivity[] =>
  Array.from({ length: weeks }, (_, week) =>
    [0, 2, 4, 6].map((day) => {
      const minutes = weeklyMinutes / 4;
      return {
        day: addDays("2026-10-12", -7 * (week + 1) + day),
        type,
        duration: minutes * 60,
        distance: ((minutes * 60) / 330) * 1000,
        gain: gainPerWeek / 4,
      };
    }),
  ).flat();

const race = (
  distanceKm: number,
  date: string,
  patch: Partial<ObjectiveRace> = {},
): ObjectiveRace => ({
  id: `race-${distanceKm}`,
  name: `Course ${distanceKm} km`,
  date,
  distanceKm,
  elevationGainM: null,
  kind: "road",
  priority: "A",
  targetSeconds: null,
  ...patch,
});

const constraints: PlanningConstraints = {
  timeZone: "Europe/Paris",
  maxWeeklyMinutes: null,
  unavailablePeriods: [],
};
const availability: Availability = {
  availableWeekdays: [2, 3, 4, 6, 7],
  weekdaySessionMinutes: 75,
  longRunDay: "sunday",
};

function build(
  races: ObjectiveRace[],
  activities: HistoryActivity[],
  patch: {
    constraints?: PlanningConstraints;
    availability?: Availability;
    declaredWeeklyMinutes?: number;
  } = {},
) {
  const summary = summarizeHistory(activities, today);
  const objective = resolveObjective({ races, today, history: summary });
  const skeleton = buildSkeleton({
    today,
    objective,
    summary,
    availability: patch.availability ?? availability,
    constraints: patch.constraints ?? constraints,
    declaredWeeklyMinutes: patch.declaredWeeklyMinutes,
  });
  return { summary, objective, skeleton, activities };
}

describe("templates", () => {
  it.each(templateIds.filter((id) => id !== "base_building"))(
    "%s is consistent for every block length",
    (id) => {
      const template = planTemplates[id];
      const phases = preRacePhases(template);
      expect(
        phases.reduce((total, phase) => total + phase.weeks.min, 0),
      ).toBeLessThanOrEqual(template.weeks.min);
      expect(
        phases.reduce((total, phase) => total + phase.weeks.max, 0),
      ).toBeGreaterThanOrEqual(template.weeks.max);
      for (const phase of template.phases) {
        const { easyPct, moderatePct, hardPct } = phase.intensity;
        expect(easyPct + moderatePct + hardPct).toBe(100);
        expect(easyPct).toBeGreaterThanOrEqual(75);
        expect(phase.longRun.sharePct).toBeLessThanOrEqual(35);
      }
      for (
        let weeks = template.weeks.min;
        weeks <= template.weeks.max;
        weeks += 1
      ) {
        const resolved = resolveTemplateWeeks(template, weeks)!;
        const preRace = resolved.filter((week) => week.kind !== "post_race");
        expect(preRace).toHaveLength(weeks);
        const taper = preRace.filter((week) => week.kind === "taper");
        const build = preRace.filter((week) => week.kind === "build");
        expect(Math.max(...build.map((week) => week.volumePct))).toBe(100);
        expect(preRace.at(-1)!.kind).toBe("taper");
        for (let index = 1; index < taper.length; index += 1)
          expect(taper[index].volumePct).toBeLessThan(
            taper[index - 1].volumePct,
          );
        expect(taper.at(-1)!.volumePct).toBeLessThanOrEqual(75);
        expect(preRace.at(-taper.length - 1)!.kind).not.toBe("lighter");
        if (weeks >= 8)
          expect(preRace.some((week) => week.kind === "lighter")).toBe(true);
      }
      expect(resolveTemplateWeeks(template, template.weeks.min - 1)).toBeNull();
      expect(resolveTemplateWeeks(template, template.weeks.max + 1)).toBeNull();
    },
  );

  it("chooses one template per distance band, lower bound included", () => {
    const pick = (distanceKm: number, kind: "road" | "trail") =>
      matchTemplate({ distanceKm, kind }).id;
    expect(pick(10, "road")).toBe("road_5_10k");
    expect(pick(14.9, "road")).toBe("road_5_10k");
    expect(pick(15, "road")).toBe("road_half");
    expect(pick(30, "road")).toBe("road_marathon");
    expect(pick(29.9, "trail")).toBe("trail_short");
    expect(pick(30, "trail")).toBe("trail_marathon");
    expect(pick(60, "trail")).toBe("trail_ultra_80_100");
    expect(pick(130, "trail")).toBe("trail_100_miles");
  });

  it("stretches phases in the reference order", () => {
    expect(allocatePhaseWeeks(planTemplates.trail_marathon, 14)).toEqual({
      base: 3,
      development: 5,
      specific: 4,
      taper: 2,
    });
  });
});

describe("summarizeHistory", () => {
  it("summarizes the last 16 weeks and the held volume", () => {
    const summary = summarizeHistory(history(300), today);
    expect(summary.weeks).toHaveLength(16);
    expect(summary.held.durationSeconds).toBe(18_000);
    expect(summary.heldPaceSecondsPerKm).toBeCloseTo(330);
    expect(summary.weeksWithRuns).toBe(16);
    expect(summary.runsLast30d).toBeGreaterThanOrEqual(3);
    expect(summary.sufficient).toBe(true);
  });

  it("marks short history as insufficient", () => {
    expect(summarizeHistory(history(300, 3), today).sufficient).toBe(false);
    expect(summarizeHistory(history(40), today).sufficient).toBe(false);
  });
});

describe("resolveObjective", () => {
  const summary = summarizeHistory(history(300), today);

  it("prefers the A race, then the nearest dated race", () => {
    const objective = resolveObjective({
      races: [
        race(10, "2026-11-15", { id: "b", priority: "B" }),
        race(42.2, "2027-03-21"),
      ],
      today,
      history: summary,
    });
    expect(objective.race?.distanceKm).toBe(42.2);
    expect(objective.template.id).toBe("road_marathon");
    expect(objective.otherRaces).toEqual([
      expect.objectContaining({ id: "b", role: "secondary" }),
    ]);
    expect(
      resolveObjective({
        races: [race(21.1, "2027-01-10", { priority: "B" })],
        today,
        history: summary,
      }).race?.distanceKm,
    ).toBe(21.1);
  });

  it("targets the next A race when the nearest one is too close", () => {
    const imminent = race(50, "2026-10-17", {
      id: "imminent",
      kind: "trail",
    });
    const next = race(120, "2027-03-20", { id: "next", kind: "trail" });
    const objective = resolveObjective({
      races: [imminent, race(10, "2026-12-06", { priority: "C" }), next],
      today,
      history: summary,
    });
    expect(objective.race?.id).toBe("next");
    expect(objective.otherRaces).toEqual([
      expect.objectContaining({ id: "imminent", role: "secondary" }),
      expect.objectContaining({ id: "race-10", role: "preparation" }),
    ]);
    expect(
      resolveObjective({ races: [imminent], today, history: summary }).race?.id,
    ).toBe("imminent");
  });

  it("labels long events and short history", () => {
    expect(
      resolveObjective({
        races: [race(80, "2027-04-01", { kind: "trail" })],
        today,
        history: summary,
      }).confidenceReasons,
    ).toHaveLength(1);
    const short = resolveObjective({
      races: [race(42.2, "2027-03-21")],
      today,
      history: { sufficient: false },
    });
    expect(short.template.id).toBe("base_building");
    expect(short.confidenceReasons[0]).toMatch(/Historique court/);
  });
});

describe("buildSkeleton", () => {
  const families = [
    { name: "road 10 km", race: race(10, "2026-12-20"), minutes: 180 },
    { name: "road half", race: race(21.1, "2027-01-17"), minutes: 240 },
    { name: "road marathon", race: race(42.2, "2027-03-07"), minutes: 330 },
    {
      name: "trail 25 km",
      race: race(25, "2027-01-24", { kind: "trail", elevationGainM: 1_200 }),
      minutes: 300,
      gain: 900,
    },
    {
      name: "trail 50 km",
      race: race(50, "2027-03-14", { kind: "trail", elevationGainM: 2_500 }),
      minutes: 420,
      gain: 1_600,
    },
    {
      name: "ultra 100 km",
      race: race(100, "2027-04-25", { kind: "trail", elevationGainM: 5_000 }),
      minutes: 540,
      gain: 2_500,
    },
    {
      name: "100 miles",
      race: race(165, "2027-05-30", { kind: "trail", elevationGainM: 9_000 }),
      minutes: 660,
      gain: 3_500,
    },
  ];

  it.each(families)(
    "$name builds a skeleton the validator never blocks",
    ({ race: target, minutes, gain = 0 }) => {
      const activities = history(
        minutes,
        16,
        target.kind === "trail" ? "trail_running" : "running",
        gain,
      );
      const { skeleton, summary } = build([target], activities);
      expect(skeleton.status).toBe("ready");
      if (skeleton.status !== "ready") return;
      const { state } = skeleton;
      const report = validatePlan({
        candidate: state,
        base: null,
        versions: null,
        today,
        matchedSessionKeys: new Set(),
        athlete: {
          availableWeekdays: availability.availableWeekdays,
          weekdaySessionMinutes: availability.weekdaySessionMinutes,
          maxWeeklyMinutes: null,
          unavailablePeriods: [],
        },
        races: [
          {
            id: target.id,
            date: target.date,
            priority: "A",
            distanceKm: target.distanceKm,
          },
        ],
        history: historyForValidation(activities, summary, today),
        health: null,
        load: null,
        demands: null,
        specialistConstraints: [],
      });
      expect(
        report.results.filter(
          (result) => result.outcome === "fail" && result.severity === "block",
        ),
      ).toEqual([]);
      expect(state.plan.startsOn).toBe(planStart(today));
      state.weeks.forEach((week, index) => {
        expect(isMonday(week.weekStart)).toBe(true);
        expect(week.weekStart).toBe(addDays(state.plan.startsOn, 7 * index));
      });
      const raceWeek = state.weeks.find((week) => week.weekType === "race")!;
      expect(raceWeek.weekStart <= target.date).toBe(true);
      expect(addDays(raceWeek.weekStart, 6) >= target.date).toBe(true);
      expect(
        state.sessions.filter((session) => session.kind === "race"),
      ).toHaveLength(1);
      const peak = Math.max(
        ...state.weeks
          .filter((week) => week.weekType === "build")
          .map((week) => week.targets.durationSeconds),
      );
      const taper = state.weeks.filter((week) =>
        ["taper", "race"].includes(week.weekType),
      );
      for (const week of taper)
        expect(week.targets.durationSeconds).toBeLessThan(peak);
      expect(
        state.weeks
          .filter((week) => week.weekStart > raceWeek.weekStart)
          .every((week) => week.weekType === "post_race"),
      ).toBe(true);
      expect(state.plan.confidence.level).toBe(
        target.distanceKm > 60 ? "low" : "normal",
      );
    },
  );

  it("places lighter weeks and keeps peak derived from the held volume", () => {
    const { skeleton } = build([race(42.2, "2027-03-07")], history(330));
    if (skeleton.status !== "ready") throw new Error("not ready");
    expect(skeleton.peak.durationSeconds).toBe(
      Math.round(330 * 60 * (100 / 88)),
    );
    expect(
      skeleton.state.weeks.some((week) => week.weekType === "recovery"),
    ).toBe(true);
  });

  it("ramps a lead-in when the race is further than the template maximum", () => {
    const { skeleton } = build([race(21.1, "2027-06-27")], history(240));
    if (skeleton.status !== "ready") throw new Error("not ready");
    expect(skeleton.leadInWeeks).toBeGreaterThan(0);
    const leadIn = skeleton.state.weeks.slice(0, skeleton.leadInWeeks);
    let previous = 240 * 60;
    for (const week of leadIn) {
      if (week.weekType === "lead_in") {
        expect(week.targets.durationSeconds).toBeLessThanOrEqual(
          Math.round(previous * 1.04) + 1,
        );
        previous = week.targets.durationSeconds;
      }
    }
    expect(previous).toBeGreaterThan(240 * 60);
  });

  it("refuses to compress a timeline shorter than the template minimum", () => {
    const result = build([race(42.2, "2026-12-06")], history(330));
    expect(result.skeleton).toMatchObject({
      status: "too_short",
      minimumWeeks: 12,
    });
    const feasibility = assessFeasibility({ ...result, today });
    expect(feasibility.verdict).toBe("too_short");
    expect(feasibility.options).toEqual([
      {
        kind: "shorter_format",
        templateId: "road_half",
        label: "Semi-marathon",
      },
      expect.objectContaining({ kind: "later_race" }),
      { kind: "base_first" },
    ]);
  });

  it("builds a cautious base with short history and asks without any", () => {
    const short = build([race(42.2, "2027-03-07")], history(240, 3));
    expect(short.objective.template.id).toBe("base_building");
    if (short.skeleton.status !== "ready") throw new Error("not ready");
    expect(short.skeleton.state.plan.confidence.level).toBe("low");
    expect(
      short.skeleton.state.sessions.some((session) => session.kind === "race"),
    ).toBe(true);
    const none = build([race(42.2, "2027-03-07")], []);
    expect(none.skeleton.status).toBe("no_history");
    expect(assessFeasibility({ ...none, today }).verdict).toBe("no_history");
    expect(
      build([race(42.2, "2027-03-07")], [], { declaredWeeklyMinutes: 180 })
        .skeleton.status,
    ).toBe("ready");
  });

  it("caps weeks with the weekly ceiling and the athlete's availability", () => {
    const capped = build([race(42.2, "2027-03-07")], history(330), {
      constraints: { ...constraints, maxWeeklyMinutes: 300 },
    });
    if (capped.skeleton.status !== "ready") throw new Error("not ready");
    expect(
      Math.max(
        ...capped.skeleton.state.weeks.map(
          (week) => week.targets.durationSeconds,
        ),
      ),
    ).toBeLessThanOrEqual(18_000);
    expect(capped.skeleton.warnings).toContainEqual(
      expect.objectContaining({ code: "peak_capped_by_ceiling" }),
    );
    const tight = build([race(42.2, "2027-03-07")], history(330), {
      availability: {
        availableWeekdays: [3, 7],
        weekdaySessionMinutes: 45,
        longRunDay: "sunday",
      },
    });
    if (tight.skeleton.status !== "ready") throw new Error("not ready");
    expect(tight.skeleton.warnings).toContainEqual(
      expect.objectContaining({ code: "availability_cap" }),
    );
  });

  it("clears weeks the athlete is fully unavailable", () => {
    const away = build([race(42.2, "2027-03-07")], history(330), {
      constraints: {
        ...constraints,
        unavailablePeriods: [
          {
            id: "away",
            startsOn: "2026-11-02",
            endsOn: "2026-11-08",
            kind: "travel",
            reason: null,
            revision: 1,
          },
        ],
      },
    });
    if (away.skeleton.status !== "ready") throw new Error("not ready");
    expect(
      away.skeleton.state.weeks.find((week) => week.weekStart === "2026-11-02")
        ?.targets.durationSeconds,
    ).toBe(0);
  });
});

describe("assessFeasibility", () => {
  it("is realistic when the held volume fits the format", () => {
    const result = build([race(21.1, "2027-01-17")], history(300));
    expect(assessFeasibility({ ...result, today })).toMatchObject({
      verdict: "realistic",
      options: [],
    });
  });

  it("is ambitious when the peak stays below the format's range", () => {
    const result = build([race(42.2, "2027-03-07")], history(150));
    const feasibility = assessFeasibility({ ...result, today });
    expect(feasibility.verdict).toBe("ambitious");
    expect(feasibility.reasons.join(" ")).toMatch(/sous le repère/);
  });

  it("flags a short long run against the race demands", () => {
    const result = build(
      [race(100, "2027-04-25", { kind: "trail", elevationGainM: 5_000 })],
      history(300, 16, "trail_running", 800),
    );
    const feasibility = assessFeasibility({ ...result, today });
    expect(feasibility.demands).toContainEqual(
      expect.objectContaining({ key: "longest_run", status: "short" }),
    );
    expect(feasibility.verdict).toBe("ambitious");
  });

  it("flags a target faster than Stride's optimistic estimate", () => {
    const result = build(
      [race(21.1, "2027-01-17", { targetSeconds: 5_400 })],
      history(300),
    );
    expect(
      assessFeasibility({ ...result, today, optimisticSeconds: 5_700 }).reasons,
    ).toContain(
      "Ton temps visé est plus rapide que l’estimation la plus optimiste de Stride.",
    );
  });
});

import { describe, expect, it } from "vitest";
import type { PlanningConstraints } from "@/features/plans/constraints";
import { buildDeterministicPlan } from "@/features/plans/detailing/build";
import type { DetailingAvailability } from "@/features/plans/detailing/detailing";
import type { HistoryActivity } from "@/features/plans/history/summary";
import {
  easyRun,
  fitQualitySession,
  longRun,
  maxLevel,
  qualitySession,
  type QualityKind,
} from "@/features/plans/library/library";
import {
  addDays,
  daysBetween,
  isoWeekday,
  mondayOf,
} from "@/features/plans/model/dates";
import {
  sessionContentSchema,
  sessionSchema,
  type PlanSession,
} from "@/features/plans/model/plan";
import type { StructureStep } from "@/features/plans/model/structure";
import type { ObjectiveRace } from "@/features/plans/skeleton/objective";
import {
  trainingTargets,
  type TargetsInput,
} from "@/features/plans/targets/targets";

const today = "2026-10-14";

const zones = {
  asOf: "2026-10-10",
  zones: [
    { zone: 1, lower: 95, upper: 113 },
    { zone: 2, lower: 114, upper: 132 },
    { zone: 3, lower: 133, upper: 151 },
    { zone: 4, lower: 152, upper: 170 },
    { zone: 5, lower: 171, upper: 190 },
  ],
};
const targetsInput: Omit<TargetsInput, "today"> = {
  flatLapThresholdPace: { secondsPerKm: 270, asOf: "2026-10-01" },
  garminLactateThreshold: null,
  bestEfforts: [],
  vo2Max: null,
  garminZones: null,
  strideZones: zones,
};
const targets = trainingTargets({ ...targetsInput, today });
const noTargets = trainingTargets({
  ...targetsInput,
  flatLapThresholdPace: null,
  strideZones: null,
  today,
});

const history = (
  weeklyMinutes: number,
  type = "running",
  gainPerWeek = 0,
): HistoryActivity[] =>
  Array.from({ length: 16 }, (_, week) =>
    [0, 2, 4, 6].map((day) => ({
      day: addDays("2026-10-12", -7 * (week + 1) + day),
      type,
      duration: (weeklyMinutes / 4) * 60,
      distance: (((weeklyMinutes / 4) * 60) / 330) * 1000,
      gain: gainPerWeek / 4,
    })),
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

const availability: DetailingAvailability = {
  availableWeekdays: [2, 3, 4, 6, 7],
  weekdaySessionMinutes: 75,
  longRunDay: "sunday",
  trainingAccess: ["hills"],
};
const constraints: PlanningConstraints = {
  timeZone: "Europe/Paris",
  maxWeeklyMinutes: null,
  unavailablePeriods: [],
};

const build = (
  races: ObjectiveRace[],
  activities: HistoryActivity[],
  patch: { constraints?: PlanningConstraints } = {},
) =>
  buildDeterministicPlan({
    today,
    races,
    activities,
    availability,
    constraints: patch.constraints ?? constraints,
    targets: targetsInput,
  });

const steps = (structure: StructureStep[]) =>
  structure.flatMap((step) => (step.type === "repeat" ? step.steps : [step]));

const workSeconds = (session: PlanSession) =>
  steps(session.structure)
    .filter((step) => step.type === "work")
    .reduce((total, step) => {
      const repeat = session.structure.find(
        (item) => item.type === "repeat" && item.steps.includes(step),
      );
      const count = repeat?.type === "repeat" ? repeat.count : 1;
      return total + count * (step.end.kind === "time" ? step.end.seconds : 0);
    }, 0);

const qualityKinds = new Set([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
]);
const isQuality = (session: PlanSession) => qualityKinds.has(session.kind);

describe("session library", () => {
  const kinds = Object.keys(maxLevel) as QualityKind[];

  it.each(kinds)("%s is valid and progresses with its level", (kind) => {
    let previous = 0;
    for (let level = 0; level <= maxLevel[kind]; level += 1) {
      const session = qualitySession({ targets, terrain: "road" }, kind, level);
      expect(sessionContentSchema.safeParse(session).success).toBe(true);
      expect(session.isKey).toBe(true);
      expect(session.contingencies.length).toBeGreaterThan(0);
      const work = workSeconds({
        ...session,
        sessionKey: "s",
        scheduledOn: today,
      });
      expect(work).toBeGreaterThan(previous);
      previous = work;
    }
    expect(
      qualitySession({ targets, terrain: "road" }, kind, maxLevel[kind] + 5),
    ).toEqual(
      qualitySession({ targets, terrain: "road" }, kind, maxLevel[kind]),
    );
  });

  it("targets pace on road, heart rate on trail and effort without data", () => {
    const road = easyRun({ targets, terrain: "road" }, 2_400);
    expect(road.structure[0]).toMatchObject({
      target: { kind: "pace_range" },
      cue: "FC 114–132",
    });
    const trail = longRun({ targets, terrain: "trail" }, 7_200);
    expect(trail).toMatchObject({
      sport: "trail",
      kind: "long",
      terrain: "trail",
    });
    expect(trail.structure[0]).toMatchObject({
      target: { kind: "heart_rate_range", minBpm: 114, maxBpm: 132 },
      cue: "Marche active dans les fortes pentes",
    });
    const blind = easyRun({ targets: noTargets, terrain: "road" }, 2_400);
    expect(blind.structure[0]).toMatchObject({
      target: { kind: "rpe", min: 3, max: 4 },
      cue: "Tu peux parler en phrases complètes",
    });
  });

  it("fits quality sessions to the weekday limit", () => {
    const context = { targets, terrain: "road" as const };
    const fitted = fitQualitySession(context, "threshold", 3, 2_700)!;
    expect(fitted.targets.durationSeconds).toBeLessThanOrEqual(2_700);
    expect(fitted.title).toBe("Seuil · 4 × 6’");
    expect(fitQualitySession(context, "threshold", 3, 600)).toBeNull();
    expect(fitQualitySession(context, "threshold", 3, null)?.title).toBe(
      "Seuil · 6 × 6’",
    );
  });

  it("adds strides only to runs of at least 30 minutes", () => {
    expect(easyRun({ targets, terrain: "road" }, 2_400, true).title).toBe(
      "Footing + lignes droites",
    );
    expect(easyRun({ targets, terrain: "road" }, 1_500, true).title).toBe(
      "Footing",
    );
  });
});

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

describe("buildDeterministicPlan", () => {
  it.each(families)("$name is complete, valid and placed", (family) => {
    const trail = family.race.kind === "trail";
    const plan = build(
      [family.race],
      history(family.minutes, trail ? "trail_running" : "running", family.gain),
    );
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    const { state, report } = plan;
    expect(
      report.results.filter(
        (result) => result.outcome === "fail" && result.severity === "block",
      ),
    ).toEqual([]);
    expect(report.valid).toBe(true);

    const training = state.sessions.filter(
      (session) => session.kind !== "race",
    );
    expect(training.length).toBeGreaterThan(state.weeks.length * 2);
    for (const session of state.sessions) {
      expect(sessionSchema.safeParse(session).success).toBe(true);
      for (const step of steps(session.structure))
        expect(step.target.kind).not.toBe("none");
    }
    for (const session of training) {
      expect(availability.availableWeekdays).toContain(
        isoWeekday(session.scheduledOn),
      );
      if (isoWeekday(session.scheduledOn) <= 5 && session.kind !== "long")
        expect(session.targets.durationSeconds).toBeLessThanOrEqual(75 * 60);
    }
    for (const week of state.weeks) {
      const inWeek = training.filter(
        (session) => mondayOf(session.scheduledOn) === week.weekStart,
      );
      expect(
        inWeek.reduce(
          (total, session) => total + session.targets.durationSeconds,
          0,
        ),
      ).toBeLessThanOrEqual(week.targets.durationSeconds);
    }

    const quality = training.filter(isQuality);
    const longs = training.filter((session) => session.kind === "long");
    for (const session of quality) {
      expect(
        quality.some(
          (other) =>
            other !== session &&
            Math.abs(daysBetween(other.scheduledOn, session.scheduledOn)) <= 1,
        ),
      ).toBe(false);
      expect(
        longs.some(
          (long) => addDays(long.scheduledOn, 1) === session.scheduledOn,
        ),
      ).toBe(false);
    }

    const raceWeek = mondayOf(family.race.date);
    const raceWeekQuality = quality.filter(
      (session) => mondayOf(session.scheduledOn) === raceWeek,
    );
    expect(raceWeekQuality.length).toBeLessThanOrEqual(1);
    for (const session of training) {
      const fromRace = daysBetween(family.race.date, session.scheduledOn);
      expect(fromRace === -1).toBe(false);
      if (family.race.distanceKm > 42.2)
        expect(fromRace >= 1 && fromRace <= 3).toBe(false);
      if (isQuality(session))
        expect(fromRace >= -2 && fromRace < 0).toBe(false);
    }
    expect(
      training
        .filter((session) => session.scheduledOn > family.race.date)
        .every((session) => !isQuality(session) && session.terrain !== "trail"),
    ).toBe(true);

    const hills = training.filter((session) => session.kind === "hills");
    const trailLongs = longs.filter((session) => session.sport === "trail");
    if (trail) {
      expect(hills.length).toBeGreaterThan(0);
      expect(trailLongs.length).toBeGreaterThan(0);
      expect(
        trailLongs.some(
          (session) => (session.targets.elevationGainMeters ?? 0) > 0,
        ),
      ).toBe(true);
      for (const session of hills)
        expect(session.targets.elevationGainMeters ?? 0).toBeLessThanOrEqual(
          workSeconds(session) * 0.25 + 1,
        );
    } else {
      expect(hills).toEqual([]);
      expect(
        training.every(
          (session) => session.targets.elevationGainMeters === null,
        ),
      ).toBe(true);
    }
  });

  it("progresses key sessions within a block and steps back in lighter weeks", () => {
    const plan = build([race(42.2, "2027-03-07")], history(330));
    if (plan.status !== "ready") throw new Error("not ready");
    const { state } = plan;
    for (const block of state.blocks) {
      if (block.kind === "taper") continue;
      const weeks = state.weeks.filter(
        (week) => week.blockKey === block.blockKey,
      );
      const byTitle = new Map<string, number>();
      for (const week of weeks) {
        const sessions = state.sessions.filter(
          (session) =>
            isQuality(session) &&
            mondayOf(session.scheduledOn) === week.weekStart,
        );
        for (const session of sessions) {
          const kind = session.title.split(" · ")[0];
          const previous = byTitle.get(kind);
          const work = workSeconds(session);
          if (week.weekType === "recovery") {
            if (previous !== undefined)
              expect(work).toBeLessThanOrEqual(previous);
          } else {
            if (previous !== undefined)
              expect(work).toBeGreaterThanOrEqual(previous);
            byTitle.set(kind, work);
          }
        }
      }
    }
  });

  it("leaves a fully unavailable week empty", () => {
    const plan = build([race(42.2, "2027-03-07")], history(330), {
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
    if (plan.status !== "ready") throw new Error("not ready");
    expect(
      plan.state.sessions.filter(
        (session) => mondayOf(session.scheduledOn) === "2026-11-02",
      ),
    ).toEqual([]);
    expect(plan.report.valid).toBe(true);
  });

  it("returns the feasibility without a plan when the timeline is too short", () => {
    const plan = build([race(42.2, "2026-12-06")], history(330));
    expect(plan).toMatchObject({
      status: "too_short",
      feasibility: { verdict: "too_short" },
    });
    expect(build([race(42.2, "2027-03-07")], []).status).toBe("no_history");
  });
});

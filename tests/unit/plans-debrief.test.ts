import { describe, expect, it } from "vitest";
import {
  alignSteps,
  buildDebrief,
  buildVerdict,
  normalizeFeeling,
  rateStep,
  type DebriefInput,
  type DebriefLap,
  type StepResult,
} from "@/features/plans/debrief/debrief";
import type { PlanSession, SessionContent } from "@/features/plans/model/plan";
import type { SimpleStep } from "@/features/plans/model/structure";
import { easyRun, supportSession, thresholdSession } from "./plan-fixture";

const session = (content: SessionContent): PlanSession => ({
  ...content,
  sessionKey: "s-2026-10-22-1",
  scheduledOn: "2026-10-22",
});

const lap = (
  index: number,
  durationSeconds: number | null,
  distanceMeters: number | null = null,
  averageHeartRate: number | null = null,
): DebriefLap => ({ index, durationSeconds, distanceMeters, averageHeartRate });

const work = (overrides: Partial<SimpleStep> = {}): SimpleStep => ({
  type: "work",
  end: { kind: "time", seconds: 360 },
  target: { kind: "pace_range", fastSecondsPerKm: 270, slowSecondsPerKm: 280 },
  intensity: "threshold",
  ...overrides,
});

const metersAt = (seconds: number, pace: number) => (seconds / pace) * 1000;

function thresholdLaps(paces: number[], lastWorkSeconds = 360) {
  const laps: DebriefLap[] = [lap(0, 900, 2900)];
  paces.forEach((pace, index) => {
    const seconds = index === paces.length - 1 ? lastWorkSeconds : 360;
    laps.push(lap(laps.length, seconds, metersAt(seconds, pace), 168));
    laps.push(lap(laps.length, 90, 250));
  });
  laps.push(lap(laps.length, 600, 1900));
  return laps;
}

function input(overrides: Partial<DebriefInput> = {}): DebriefInput {
  return {
    session: session(thresholdSession()),
    laps: [],
    paceRanges: null,
    match: {
      status: "completed",
      compliance: { duration: 0.98, intensity: 1 },
    },
    garmin: { rpe: null, feel: null },
    athlete: null,
    ...overrides,
  };
}

describe("alignSteps", () => {
  const steps = [work(), work(), work()];

  it("pairs one lap with each step", () => {
    const laps = [lap(2, 360), lap(0, 360), lap(1, 360)];
    expect(alignSteps(steps, laps)?.map((item) => item.index)).toEqual([
      0, 1, 2,
    ]);
  });

  it("ignores a short trailing auto-lap", () => {
    const laps = [lap(0, 360), lap(1, 360), lap(2, 360), lap(3, 60)];
    expect(alignSteps(steps, laps)).toHaveLength(3);
  });

  it("keeps a long trailing lap misaligned", () => {
    const laps = [lap(0, 360), lap(1, 360), lap(2, 360), lap(3, 61)];
    expect(alignSteps(steps, laps)).toBeNull();
  });

  it("rejects any other count and missing laps", () => {
    expect(alignSteps(steps, [lap(0, 360), lap(1, 360)])).toBeNull();
    expect(alignSteps(steps, [])).toBeNull();
    expect(alignSteps([], [lap(0, 360)])).toBeNull();
  });
});

describe("rateStep", () => {
  const paceTarget = {
    kind: "pace" as const,
    fastSecondsPerKm: 270,
    slowSecondsPerKm: 280,
  };

  it("rates pace with a three second tolerance", () => {
    const at = (pace: number) => lap(0, 360, metersAt(360, pace));
    expect(rateStep(work(), at(267), paceTarget)).toBe("in_range");
    expect(rateStep(work(), at(283), paceTarget)).toBe("in_range");
    expect(rateStep(work(), at(265), paceTarget)).toBe("too_fast");
    expect(rateStep(work(), at(285), paceTarget)).toBe("too_slow");
  });

  it("leaves a lap without distance unrated", () => {
    expect(rateStep(work(), lap(0, 360, 0), paceTarget)).toBe("unrated");
    expect(rateStep(work(), lap(0, 360, null), paceTarget)).toBe("unrated");
  });

  it("rates average heart rate against a heart rate target", () => {
    const target = { kind: "heart_rate" as const, minBpm: 160, maxBpm: 170 };
    const step = work({
      target: { kind: "heart_rate_range", minBpm: 160, maxBpm: 170 },
    });
    expect(rateStep(step, lap(0, 360, 1300, 165), target)).toBe("in_range");
    expect(rateStep(step, lap(0, 360, 1300, 175), target)).toBe("too_fast");
    expect(rateStep(step, lap(0, 360, 1300, 150), target)).toBe("too_slow");
    expect(rateStep(step, lap(0, 360, 1300, null), target)).toBe("unrated");
  });

  it("rates duration only without a target", () => {
    const step = work({ target: { kind: "rpe", min: 7, max: 8 } });
    expect(rateStep(step, lap(0, 360, 1300), null)).toBe("unrated");
  });

  it("marks a step under 90 % of its duration as cut short", () => {
    const fast = lap(0, 323, metersAt(323, 240));
    expect(rateStep(work(), fast, paceTarget)).toBe("cut_short");
    expect(rateStep(work(), lap(0, 324, metersAt(324, 275)), paceTarget)).toBe(
      "in_range",
    );
  });

  it("measures distance steps against their distance", () => {
    const step = work({ end: { kind: "distance", meters: 1000 } });
    expect(rateStep(step, lap(0, 200, 890), paceTarget)).toBe("cut_short");
    expect(rateStep(step, lap(0, 275, 1000), paceTarget)).toBe("in_range");
  });

  it("never cuts a lap-button step short", () => {
    const step = work({ end: { kind: "lap_button", estimatedSeconds: 600 } });
    expect(rateStep(step, lap(0, 120, metersAt(120, 275)), paceTarget)).toBe(
      "in_range",
    );
  });

  it("does not rate warm-up, recovery or cool-down", () => {
    expect(rateStep(work({ type: "warmup" }), lap(0, 10), paceTarget)).toBe(
      null,
    );
  });
});

describe("buildDebrief", () => {
  it("rates each repeat of an aligned structured run", () => {
    const debrief = buildDebrief(
      input({ laps: thresholdLaps([262, 264, 276, 278]) }),
    )!;
    expect(debrief.aligned).toBe(true);
    expect(debrief.steps).toHaveLength(10);
    expect(
      debrief.steps.map((step) => [step.type, step.workIndex, step.rating]),
    ).toEqual([
      ["warmup", null, null],
      ["work", 1, "too_fast"],
      ["recovery", null, null],
      ["work", 2, "too_fast"],
      ["recovery", null, null],
      ["work", 3, "in_range"],
      ["recovery", null, null],
      ["work", 4, "in_range"],
      ["recovery", null, null],
      ["cooldown", null, null],
    ]);
    expect(debrief.verdict).toEqual({
      tone: "warning",
      title: "Fractions trop rapides",
      body: "2 fractions sur 4 plus vite que la cible.",
    });
  });

  it("resolves the zone pace for a step without its own pace", () => {
    const debrief = buildDebrief(
      input({
        session: session(easyRun(50)),
        laps: [lap(0, 3000, metersAt(3000, 340))],
        paceRanges: { easy: { fastSecondsPerKm: 300, slowSecondsPerKm: 330 } },
      }),
    )!;
    expect(debrief.steps[0]).toMatchObject({
      target: { kind: "pace", fastSecondsPerKm: 300, slowSecondsPerKm: 330 },
      rating: "too_slow",
    });
    expect(debrief.verdict.title).toBe("Allure trop lente");
  });

  it("falls back to the session totals when laps do not align", () => {
    const debrief = buildDebrief(input({ laps: [lap(0, 3000, 10000)] }))!;
    expect(debrief).toMatchObject({
      aligned: false,
      steps: [],
      verdict: { tone: "success", title: "Séance réussie" },
    });
  });

  it("reads the intensity ratio as pace when a heart rate run has no heart rate", () => {
    const content = thresholdSession();
    const heartRateSession = session({
      ...content,
      structure: [
        work({
          end: { kind: "time", seconds: 1_800 },
          target: { kind: "heart_rate_range", minBpm: 160, maxBpm: 170 },
        }),
      ],
    });
    const match = {
      status: "completed" as const,
      compliance: { duration: 1, intensity: 0.9 },
    };
    expect(
      buildDebrief(
        input({ session: heartRateSession, match, averageHeartRate: null }),
      )!.verdict.title,
    ).toBe("Allure trop rapide");
    expect(
      buildDebrief(
        input({ session: heartRateSession, match, averageHeartRate: 150 }),
      )!.verdict.title,
    ).toBe("Effort trop facile");
  });

  it("does not debrief mobility or strength sessions", () => {
    expect(
      buildDebrief(input({ session: session(supportSession("mobility", 20)) })),
    ).toBeNull();
    expect(
      buildDebrief(input({ session: session(supportSession("strength", 30)) })),
    ).toBeNull();
  });

  it("leaves free fartlek blocks unrated", () => {
    const fartlek = { ...thresholdSession(), kind: "fartlek" as const };
    const debrief = buildDebrief(
      input({
        session: session(fartlek),
        laps: thresholdLaps([240, 240, 240, 240]),
      }),
    )!;
    expect(
      debrief.steps
        .filter((step) => step.type === "work")
        .map((step) => step.rating),
    ).toEqual(["unrated", "unrated", "unrated", "unrated"]);
    expect(debrief.verdict.title).toBe("Séance réussie");
  });
});

describe("buildVerdict", () => {
  const result = (rating: StepResult["rating"], index: number): StepResult => ({
    key: `${index}`,
    type: "work",
    intensity: "threshold",
    workIndex: index,
    workCount: 4,
    free: false,
    end: "time",
    target: null,
    plannedSeconds: 360,
    plannedMeters: null,
    actualSeconds: rating === "cut_short" ? 310 : 360,
    actualMeters: 1300,
    actualPace: 275,
    averageHeartRate: 170,
    rating,
  });
  const steps = (...ratings: StepResult["rating"][]) =>
    ratings.map((rating, index) => result(rating, index + 1));
  const match = {
    status: "completed" as const,
    compliance: { duration: 1, intensity: 1 },
  };

  it("puts a cut-short step first", () => {
    expect(
      buildVerdict(
        steps("too_fast", "too_fast", "too_fast", "cut_short"),
        match,
      ),
    ).toEqual({
      tone: "warning",
      title: "Séance écourtée",
      body: "La fraction 4 s’est arrêtée à 5:10 sur 6:00. 3 fractions sur 3 plus vite que la cible.",
    });
  });

  it("calls fast steps before slow ones when half are fast", () => {
    expect(
      buildVerdict(steps("too_fast", "too_fast", "too_slow", "too_slow"), match)
        .title,
    ).toBe("Fractions trop rapides");
    expect(
      buildVerdict(steps("too_slow", "too_slow", "in_range", "too_fast"), match)
        .title,
    ).toBe("Fractions trop lentes");
  });

  it("succeeds when most steps are in range", () => {
    expect(
      buildVerdict(
        steps("in_range", "in_range", "in_range", "too_fast"),
        match,
      ),
    ).toEqual({
      tone: "success",
      title: "Séance réussie",
      body: "3 fractions sur 4 dans la cible.",
    });
    expect(buildVerdict(steps("unrated", "unrated"), match).body).toBe(
      "Toutes les étapes faites comme prévu.",
    );
  });

  it("uses the match when steps are not aligned", () => {
    expect(
      buildVerdict(null, {
        status: "partial",
        compliance: { duration: 0.72, intensity: 1 },
      }),
    ).toEqual({
      tone: "warning",
      title: "Séance écourtée",
      body: "72 % de la durée prévue.",
    });
    expect(
      buildVerdict(null, {
        status: "completed",
        compliance: { duration: 1, intensity: 0.94 },
      }).title,
    ).toBe("Allure trop rapide");
    expect(
      buildVerdict(null, {
        status: "completed",
        compliance: { duration: 1, intensity: 1.06 },
      }).title,
    ).toBe("Allure trop lente");
    expect(
      buildVerdict(null, {
        status: "completed",
        compliance: { duration: 1, intensity: null },
      }).title,
    ).toBe("Séance réussie");
  });

  it("reads the match intensity as heart rate for heart rate sessions", () => {
    expect(
      buildVerdict(
        null,
        { status: "completed", compliance: { duration: 1, intensity: 1.08 } },
        true,
      ).title,
    ).toBe("Effort trop intense");
    expect(
      buildVerdict(
        null,
        { status: "completed", compliance: { duration: 1, intensity: 0.9 } },
        true,
      ).title,
    ).toBe("Effort trop facile");
  });
});

describe("normalizeFeeling", () => {
  it("prefers Garmin and scales a 100-point effort", () => {
    expect(
      normalizeFeeling({ rpe: 80, feel: 30 }, { effort: 5, feel: 100 }),
    ).toEqual({ source: "garmin", effort: 8, feel: 25 });
    expect(normalizeFeeling({ rpe: 7, feel: null }, null)).toEqual({
      source: "garmin",
      effort: 7,
      feel: null,
    });
  });

  it("uses the athlete entry without a Garmin feeling", () => {
    expect(
      normalizeFeeling({ rpe: null, feel: null }, { effort: 6, feel: 75 }),
    ).toEqual({ source: "athlete", effort: 6, feel: 75 });
  });

  it("is empty when nobody recorded a feeling", () => {
    expect(normalizeFeeling({ rpe: null, feel: null }, null)).toBeNull();
    expect(normalizeFeeling({ rpe: 0, feel: 140 }, null)).toBeNull();
  });
});

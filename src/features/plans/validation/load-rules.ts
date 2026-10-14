import { addDays, mondayOf } from "../model/dates";
import type { PlanSession } from "../model/plan";
import type { RuleId, RuleOutcome } from "./report";
import { thresholds } from "./thresholds";
import {
  daysBetween,
  hardSeconds,
  isQuality,
  isRunning,
  plannedWeeks,
  sessionDistance,
  weekLoads,
  type ValidationInput,
} from "./input";

type Rules = Partial<Record<RuleId, RuleOutcome>>;

const deloadWeekTypes = new Set(["recovery", "taper", "race", "post_race"]);

function futureRuns(input: ValidationInput) {
  return input.candidate.sessions.filter(
    (session) =>
      session.scheduledOn >= input.today &&
      isRunning(session) &&
      session.kind !== "race" &&
      session.targets.durationSeconds > 0,
  );
}

function spikeRules(input: ValidationInput): Rules {
  const planned = futureRuns(input);
  const runs = [
    ...input.history.runs.filter((run) => run.date < input.today),
    ...planned.map((session) => ({
      date: session.scheduledOn,
      durationSeconds: session.targets.durationSeconds,
      distanceMeters: sessionDistance(session),
    })),
  ];
  const strong: string[] = [];
  const mild: string[] = [];
  let evaluated = 0;
  let observed = 0;
  for (const session of planned) {
    const from = addDays(session.scheduledOn, -thresholds.spikeWindowDays);
    const window = runs.filter(
      (run) => run.date >= from && run.date < session.scheduledOn,
    );
    if (window.length < thresholds.spikeMinimumRuns) continue;
    const distance = sessionDistance(session);
    const distances = window
      .map((run) => run.distanceMeters)
      .filter((value): value is number => value !== null && value > 0);
    const ratio =
      distance !== null && distances.length > 0
        ? distance / Math.max(...distances)
        : session.targets.durationSeconds /
          Math.max(...window.map((run) => run.durationSeconds));
    evaluated += 1;
    observed = Math.max(observed, ratio);
    if (ratio > thresholds.spikeStrongRatio) strong.push(session.sessionKey);
    else if (ratio > thresholds.spikeRatio) mild.push(session.sessionKey);
  }
  if (evaluated === 0) {
    const skipped: RuleOutcome = {
      outcome: "skipped",
      reason: "fewer_than_three_runs_in_30_days",
    };
    return { E1: skipped, E2: skipped };
  }
  const result = (keys: string[], threshold: number): RuleOutcome =>
    keys.length > 0
      ? { outcome: "fail", keys, observed, threshold }
      : { outcome: "pass", observed, threshold };
  return {
    E1: result(strong, thresholds.spikeStrongRatio),
    E2: result(mild, thresholds.spikeRatio),
  };
}

function weekType(input: ValidationInput, weekStart: string) {
  return input.candidate.weeks.find((week) => week.weekStart === weekStart)
    ?.weekType;
}

function progressionRule(
  input: ValidationInput,
  value: (load: ReturnType<typeof weekLoads>[number]) => number | null,
  ratioLimit: number,
  strongLimit: number | null,
  skipReason: string,
): RuleOutcome {
  const loads = weekLoads(input);
  const byWeek = new Map(loads.map((load) => [load.weekStart, load]));
  const issues: string[] = [];
  let strong = false;
  let evaluated = 0;
  let observed = 0;
  for (const load of loads) {
    if (!load.planned) continue;
    const type = weekType(input, load.weekStart);
    if (type && deloadWeekTypes.has(type)) continue;
    const current = value(load);
    const previous = Array.from(
      { length: thresholds.weeklyReferenceWeeks },
      (_, index) => byWeek.get(addDays(load.weekStart, -7 * (index + 1))),
    ).map((week) => (week ? value(week) : null));
    if (current === null || previous.some((item) => item === null)) continue;
    const mean =
      (previous as number[]).reduce((total, item) => total + item, 0) /
      previous.length;
    if (mean <= 0) continue;
    const ratio = current / mean;
    evaluated += 1;
    observed = Math.max(observed, ratio);
    if (ratio > ratioLimit) issues.push(load.weekStart);
    if (strongLimit !== null && ratio > strongLimit) strong = true;
  }
  if (evaluated === 0) return { outcome: "skipped", reason: skipReason };
  return issues.length > 0
    ? { outcome: "fail", issues, observed, threshold: ratioLimit, strong }
    : { outcome: "pass", observed, threshold: ratioLimit };
}

function weekRules(input: ValidationInput): Rules {
  const weeks = [...plannedWeeks(input.candidate)].filter(
    ([weekStart]) => weekStart >= mondayOf(input.today),
  );
  const raceWeeks = new Set(
    input.candidate.sessions
      .filter((session) => session.kind === "race")
      .map((session) => mondayOf(session.scheduledOn)),
  );
  const longKeys: string[] = [];
  let longEvaluated = 0;
  let longObserved = 0;
  const hardWeeks: string[] = [];
  let hardEvaluated = 0;
  let hardObserved = 0;
  for (const [weekStart, sessions] of weeks) {
    const running = sessions.filter(
      (session) => isRunning(session) && session.kind !== "race",
    );
    const total = running.reduce(
      (sum, session) => sum + session.targets.durationSeconds,
      0,
    );
    if (total === 0) continue;
    if (
      running.length >= thresholds.longRunShareMinimumRuns &&
      !raceWeeks.has(weekStart)
    ) {
      const longest = running.reduce((best, session) =>
        session.targets.durationSeconds > best.targets.durationSeconds
          ? session
          : best,
      );
      const share = longest.targets.durationSeconds / total;
      longEvaluated += 1;
      longObserved = Math.max(longObserved, share);
      if (share > thresholds.longRunShare) longKeys.push(longest.sessionKey);
    }
    const hard =
      running.reduce((sum, session) => sum + hardSeconds(session), 0) / total;
    hardEvaluated += 1;
    hardObserved = Math.max(hardObserved, hard);
    if (hard > thresholds.hardShare) hardWeeks.push(weekStart);
  }

  const quality = futureRuns(input).filter(isQuality);
  const longRuns = futureRuns(input).filter(
    (session) => session.kind === "long",
  );
  const p4Keys = quality.filter(
    (session) =>
      quality.some(
        (other) =>
          other !== session &&
          Math.abs(daysBetween(other.scheduledOn, session.scheduledOn)) <= 1,
      ) ||
      longRuns.some(
        (long) => addDays(long.scheduledOn, 1) === session.scheduledOn,
      ),
  );

  return {
    P3:
      longEvaluated === 0
        ? { outcome: "skipped", reason: "fewer_than_four_runs" }
        : longKeys.length > 0
          ? {
              outcome: "fail",
              keys: longKeys,
              observed: longObserved,
              threshold: thresholds.longRunShare,
            }
          : {
              outcome: "pass",
              observed: longObserved,
              threshold: thresholds.longRunShare,
            },
    P4:
      p4Keys.length > 0
        ? { outcome: "fail", keys: p4Keys.map((session) => session.sessionKey) }
        : { outcome: "pass" },
    P5:
      hardEvaluated === 0
        ? { outcome: "skipped", reason: "no_planned_running" }
        : hardWeeks.length > 0
          ? {
              outcome: "fail",
              issues: hardWeeks,
              observed: hardObserved,
              threshold: thresholds.hardShare,
            }
          : {
              outcome: "pass",
              observed: hardObserved,
              threshold: thresholds.hardShare,
            },
  };
}

function raceRules(input: ValidationInput): Rules {
  const { candidate } = input;
  const primary = input.races.find(
    (race) => race.id === candidate.plan.primaryRaceId,
  );
  let p6: RuleOutcome;
  if (
    !primary ||
    primary.date < input.today ||
    primary.date > candidate.plan.endsOn
  )
    p6 = { outcome: "skipped", reason: "no_upcoming_primary_race" };
  else if ((primary.distanceKm ?? 0) < thresholds.taperMinimumRaceKm)
    p6 = { outcome: "skipped", reason: "race_under_10_km" };
  else {
    const raceWeek = mondayOf(primary.date);
    const taperStarts = Array.from(
      { length: thresholds.taperWeeks },
      (_, index) => addDays(raceWeek, -7 * (thresholds.taperWeeks - index)),
    );
    const loads = new Map(
      weekLoads(input).map((load) => [load.weekStart, load.durationSeconds]),
    );
    const peak = Math.max(
      0,
      ...[...loads]
        .filter(([weekStart]) => weekStart < taperStarts[0])
        .map(([, duration]) => duration),
    );
    const taper = taperStarts.map((weekStart) => loads.get(weekStart));
    if (peak === 0 || taper.some((value) => value === undefined))
      p6 = { outcome: "skipped", reason: "no_peak_or_taper_weeks" };
    else {
      const mean =
        (taper as number[]).reduce((total, value) => total + value, 0) /
        taper.length;
      const reduction = 1 - mean / peak;
      const keepsIntensity = candidate.sessions.some(
        (session) =>
          isQuality(session) &&
          taperStarts.includes(mondayOf(session.scheduledOn)),
      );
      const issues = [
        ...(reduction < thresholds.taperReductionMin
          ? ["reduction_too_small"]
          : []),
        ...(reduction > thresholds.taperReductionMax
          ? ["reduction_too_large"]
          : []),
        ...(keepsIntensity ? [] : ["no_intensity_kept"]),
      ];
      p6 =
        issues.length > 0
          ? {
              outcome: "fail",
              issues,
              observed: reduction,
              threshold: thresholds.taperReductionMin,
            }
          : {
              outcome: "pass",
              observed: reduction,
              threshold: thresholds.taperReductionMin,
            };
    }
  }

  const upcoming = input.races.filter(
    (race) => race.date >= input.today && race.date <= candidate.plan.endsOn,
  );
  const sessions = futureRuns(input);
  const p7Keys = upcoming.flatMap((race) => [
    ...(race.priority === "A"
      ? sessions
          .filter(
            (session) =>
              isQuality(session) &&
              session.scheduledOn < race.date &&
              session.scheduledOn >=
                addDays(race.date, -thresholds.preRaceQualityFreeDays),
          )
          .map((session) => session.sessionKey)
      : []),
    ...((race.distanceKm ?? 0) > thresholds.ultraKm
      ? sessions
          .filter(
            (session) =>
              session.scheduledOn > race.date &&
              session.scheduledOn <=
                addDays(race.date, thresholds.postUltraRestDays),
          )
          .map((session) => session.sessionKey)
      : []),
  ]);
  return {
    P6: p6,
    P7:
      upcoming.length === 0
        ? { outcome: "skipped", reason: "no_upcoming_race" }
        : p7Keys.length > 0
          ? { outcome: "fail", keys: p7Keys }
          : { outcome: "pass" },
  };
}

function longestPlanned(sessions: PlanSession[]) {
  const distances = sessions
    .map(sessionDistance)
    .filter((value): value is number => value !== null);
  return distances.length > 0 ? Math.max(...distances) : null;
}

function informationRules(input: ValidationInput): Rules {
  const load = input.load;
  const p8: RuleOutcome =
    !load ||
    load.acuteChronicRatio === null ||
    load.days < thresholds.loadMinimumDays
      ? { outcome: "skipped", reason: "fewer_than_28_days_of_load" }
      : load.acuteChronicRatio < thresholds.loadRatioMin ||
          load.acuteChronicRatio > thresholds.loadRatioMax
        ? {
            outcome: "fail",
            observed: load.acuteChronicRatio,
            threshold: thresholds.loadRatioMax,
          }
        : { outcome: "pass", observed: load.acuteChronicRatio };

  const demands = input.demands;
  let d1: RuleOutcome;
  if (!demands) d1 = { outcome: "skipped", reason: "no_race_demands" };
  else {
    const planned = futureRuns(input);
    const loads = weekLoads(input).filter((item) => item.planned);
    const peaks = {
      longest_run: longestPlanned(planned),
      weekly_elevation: Math.max(
        0,
        ...loads.map((item) => item.elevationGainMeters ?? 0),
      ),
      weekly_volume: Math.max(0, ...loads.map((item) => item.durationSeconds)),
    };
    const targets = {
      longest_run: demands.longestRunMeters,
      weekly_elevation: demands.weeklyElevationMeters,
      weekly_volume: demands.weeklyDurationSeconds,
    };
    const issues = (Object.keys(targets) as (keyof typeof targets)[]).filter(
      (name) => {
        const target = targets[name];
        const peak = peaks[name];
        return (
          target !== null &&
          target > 0 &&
          (peak ?? 0) < target * thresholds.demandShare
        );
      },
    );
    d1 =
      issues.length > 0
        ? { outcome: "fail", issues, threshold: thresholds.demandShare }
        : { outcome: "pass", threshold: thresholds.demandShare };
  }
  return { P8: p8, D1: d1 };
}

export function evaluateLoadRules(input: ValidationInput): Rules {
  const hasTrail = input.candidate.sessions.some(
    (session) =>
      session.sport === "trail" || session.targets.elevationGainMeters !== null,
  );
  return {
    ...spikeRules(input),
    P1: progressionRule(
      input,
      (load) => load.durationSeconds,
      thresholds.weeklyIncreaseRatio,
      thresholds.weeklyStrongIncreaseRatio,
      "fewer_than_four_weeks_of_history",
    ),
    P2: hasTrail
      ? progressionRule(
          input,
          (load) => load.elevationGainMeters,
          thresholds.elevationIncreaseRatio,
          null,
          "fewer_than_four_weeks_of_elevation",
        )
      : { outcome: "skipped", reason: "road_plan" },
    ...weekRules(input),
    ...raceRules(input),
    ...informationRules(input),
  };
}

import { addDays, isoWeekday, mondayOf } from "../model/dates";
import { planStateSchema, type PlanSession } from "../model/plan";
import { computeChangeset, isFrozenSession } from "../operations/apply";
import type { RuleId, RuleOutcome } from "./report";
import { thresholds } from "./thresholds";
import {
  isQuality,
  isRunning,
  plannedWeeks,
  type ValidationInput,
} from "./input";

type Rules = Partial<Record<RuleId, RuleOutcome>>;

const fail = (keys: string[], issues: string[] = []): RuleOutcome =>
  keys.length > 0 || issues.length > 0
    ? { outcome: "fail", keys, issues }
    : { outcome: "pass" };

function frozenChanges(input: ValidationInput) {
  const context = {
    today: input.today,
    matchedSessionKeys: input.matchedSessionKeys,
  };
  if (!input.base)
    return input.candidate.sessions
      .filter((session) => session.scheduledOn < input.today)
      .map((session) => session.sessionKey);
  const changes = computeChangeset(input.base, input.candidate).sessions;
  const before = new Map(
    input.base.sessions.map((session) => [session.sessionKey, session]),
  );
  return [
    ...changes.closed.filter((key) => {
      const session = before.get(key);
      return session !== undefined && isFrozenSession(session, context);
    }),
    ...changes.added
      .filter((session) => session.scheduledOn < input.today)
      .map((session) => session.sessionKey),
  ];
}

function raceSessionsOn(sessions: PlanSession[], date: string) {
  return sessions.filter(
    (session) => session.kind === "race" && session.scheduledOn === date,
  );
}

function integrityRules(input: ValidationInput): Rules {
  const parsed = planStateSchema.safeParse(input.candidate);
  const { startsOn, endsOn } = input.candidate.plan;
  const protectedRaces = input.races.filter(
    (race) =>
      race.date >= startsOn &&
      race.date <= endsOn &&
      race.date >= input.today &&
      (race.priority === "A" ||
        (input.base !== null &&
          raceSessionsOn(input.base.sessions, race.date).length > 0)),
  );
  return {
    I1: fail(frozenChanges(input)),
    I2: input.versions
      ? input.versions.expected === input.versions.current
        ? { outcome: "pass" }
        : {
            outcome: "fail",
            observed: input.versions.current,
            threshold: input.versions.expected,
            issues: ["stale_base_version"],
          }
      : { outcome: "skipped", reason: "new_plan" },
    I3: parsed.success
      ? { outcome: "pass" }
      : fail(
          [],
          parsed.error.issues.map((issue) =>
            [issue.path.join("."), issue.message].filter(Boolean).join(": "),
          ),
        ),
    I4: fail(
      protectedRaces
        .filter(
          (race) =>
            raceSessionsOn(input.candidate.sessions, race.date).length === 0,
        )
        .map((race) => race.id),
    ),
  };
}

function inPeriod(
  date: string,
  periods: { startsOn: string; endsOn: string }[],
) {
  return periods.some(
    (period) => period.startsOn <= date && date <= period.endsOn,
  );
}

function constraintRules(input: ValidationInput): Rules {
  const future = input.candidate.sessions.filter(
    (session) =>
      session.scheduledOn >= input.today &&
      isRunning(session) &&
      session.kind !== "race",
  );
  const { availableWeekdays, weekdaySessionMinutes, maxWeeklyMinutes } =
    input.athlete;

  let c1: RuleOutcome;
  if (
    !availableWeekdays?.length &&
    input.athlete.unavailablePeriods.length === 0
  )
    c1 = { outcome: "skipped", reason: "no_declared_availability" };
  else {
    const keys = future
      .filter(
        (session) =>
          (availableWeekdays?.length &&
            !availableWeekdays.includes(isoWeekday(session.scheduledOn))) ||
          inPeriod(session.scheduledOn, input.athlete.unavailablePeriods),
      )
      .map((session) => session.sessionKey);
    const issues: string[] = [];
    if (availableWeekdays?.length)
      for (const [weekStart, sessions] of plannedWeeks(input.candidate)) {
        const days = new Set(
          sessions
            .filter((session) => future.includes(session))
            .map((session) => session.scheduledOn),
        );
        if (days.size > availableWeekdays.length)
          issues.push(`too_many_running_days:${weekStart}`);
      }
    c1 = fail(keys, issues);
  }

  let c2: RuleOutcome;
  const sessionCap =
    weekdaySessionMinutes !== null && weekdaySessionMinutes < 90
      ? weekdaySessionMinutes * 60
      : null;
  if (sessionCap === null && maxWeeklyMinutes === null)
    c2 = { outcome: "skipped", reason: "no_declared_maximum" };
  else {
    const keys =
      sessionCap === null
        ? []
        : future
            .filter(
              (session) =>
                isoWeekday(session.scheduledOn) <= 5 &&
                session.kind !== "long" &&
                session.targets.durationSeconds >
                  sessionCap * (1 + thresholds.durationTolerance),
            )
            .map((session) => session.sessionKey);
    const issues: string[] = [];
    let observed: number | null = null;
    if (maxWeeklyMinutes !== null)
      for (const [weekStart, sessions] of plannedWeeks(input.candidate)) {
        if (weekStart < mondayOf(input.today)) continue;
        const minutes =
          sessions
            .filter(
              (session) => session.kind !== "race" && session.sport !== "rest",
            )
            .reduce(
              (total, session) => total + session.targets.durationSeconds,
              0,
            ) / 60;
        observed = Math.max(observed ?? 0, minutes);
        if (minutes > maxWeeklyMinutes)
          issues.push(`weekly_ceiling:${weekStart}`);
      }
    const result = fail(keys, issues);
    c2 =
      result.outcome === "fail"
        ? { ...result, observed, threshold: maxWeeklyMinutes }
        : result;
  }

  const c3Keys = input.specialistConstraints.flatMap((constraint) =>
    future
      .filter(
        (session) =>
          session.scheduledOn >= constraint.from &&
          session.scheduledOn <= constraint.to &&
          (constraint.kind === "no_running" ||
            (constraint.kind === "no_quality" && isQuality(session)) ||
            (constraint.kind === "max_session_minutes" &&
              session.targets.durationSeconds > constraint.minutes * 60)),
      )
      .map((session) => session.sessionKey),
  );
  return {
    C1: c1,
    C2: c2,
    C3:
      input.specialistConstraints.length === 0
        ? { outcome: "skipped", reason: "no_specialist_constraints" }
        : fail(c3Keys),
  };
}

function healthRules(input: ValidationInput): Rules {
  if (!input.health)
    return {
      H1: { outcome: "skipped", reason: "no_health_input" },
      H2: { outcome: "skipped", reason: "no_health_input" },
      H3: { outcome: "skipped", reason: "no_health_input" },
    };
  const active = input.health.conditions.filter(
    (condition) => condition.status === "active",
  );
  const stop = active.some(
    (condition) =>
      condition.severity >= thresholds.painStopSeverity ||
      condition.worsening ||
      condition.redFlag ||
      (condition.kind === "illness" && condition.systemicSymptoms),
  );
  const caution =
    !stop &&
    active.some(
      (condition) =>
        condition.kind === "pain" &&
        condition.severity >= thresholds.painCautionSeverity,
    );
  const within = (session: PlanSession, days: number) =>
    session.scheduledOn >= input.today &&
    session.scheduledOn < addDays(input.today, days);

  const h1Keys = stop
    ? input.candidate.sessions
        .filter(
          (session) =>
            isRunning(session) &&
            within(session, thresholds.painStopHorizonDays),
        )
        .map((session) => session.sessionKey)
    : [];
  const h2Keys = caution
    ? input.candidate.sessions
        .filter(
          (session) =>
            isQuality(session) &&
            within(session, thresholds.painCautionHorizonDays),
        )
        .map((session) => session.sessionKey)
    : [];

  const quality = input.candidate.sessions.filter(isQuality);
  const red = input.health.readiness.filter((day) => day.level === "red");
  const unknown = input.health.readiness.filter(
    (day) => day.level === "unknown",
  );
  const affected = (days: typeof red) =>
    quality
      .filter((session) =>
        days.some(
          (day) =>
            session.scheduledOn === day.date ||
            session.scheduledOn === addDays(day.date, 1),
        ),
      )
      .map((session) => session.sessionKey);
  const h3Red = affected(red);
  const h3Unknown = affected(unknown);
  return {
    H1: fail(h1Keys, stop && h1Keys.length > 0 ? ["referral"] : []),
    H2: fail(h2Keys),
    H3:
      h3Red.length > 0
        ? { outcome: "fail", keys: h3Red }
        : h3Unknown.length > 0
          ? {
              outcome: "fail",
              keys: h3Unknown,
              severity: "warn",
              issues: ["readiness_unknown"],
            }
          : input.health.readiness.length === 0
            ? { outcome: "skipped", reason: "no_readiness" }
            : { outcome: "pass" },
  };
}

export function evaluateConstraintRules(input: ValidationInput): Rules {
  return {
    ...integrityRules(input),
    ...constraintRules(input),
    ...healthRules(input),
  };
}

import { isRunning } from "@/features/progress/history";
import { mondayOf } from "../model/dates";
import type { PlanSession } from "../model/plan";
import { flatten, stepSeconds } from "../model/structure";

export const matchingAlgorithmVersion = "match-v1";

export const matchConfidence = {
  sameDay: 0.9,
  moved: 0.6,
  substituted: 0.5,
} as const;

export const completedDurationRatio = 0.8;

export type SportFamily = "run" | "strength" | "cross";
export type AutoMatchStatus = "completed" | "partial" | "substituted";

export type MatchActivity = {
  id: string;
  type: string;
  startedAt: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averageHeartRate: number | null;
};

export type MatchOverride = { sessionKey: string; activityId: string | null };

export type MatchCompliance = {
  duration: number | null;
  distance: number | null;
  intensity: number | null;
};

export type AutoMatch = {
  sessionKey: string;
  activityId: string;
  status: AutoMatchStatus;
  confidence: number;
  compliance: MatchCompliance;
};

export type MatchResult = {
  algorithmVersion: string;
  matches: AutoMatch[];
};

const strengthTypes = new Set(["strength_training", "yoga", "pilates"]);

export function activityFamily(type: string): SportFamily {
  if (isRunning(type)) return "run";
  if (strengthTypes.has(type)) return "strength";
  return "cross";
}

export function sessionFamily(session: PlanSession): SportFamily | null {
  if (session.sport === "rest" || session.kind === "rest") return null;
  if (session.sport === "run" || session.sport === "trail") return "run";
  return session.sport;
}

function day(activity: MatchActivity) {
  return activity.startedAt.slice(0, 10);
}

function ratio(actual: number | null, planned: number | null) {
  if (actual === null || planned === null || planned <= 0) return null;
  return Math.round((actual / planned) * 100) / 100;
}

function sum(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null);
  return present.length === values.length && present.length > 0
    ? present.reduce((total, value) => total + value, 0)
    : null;
}

function weightedTarget(
  session: PlanSession,
  kind: "heart_rate_range" | "pace_range",
) {
  let seconds = 0;
  let weighted = 0;
  for (const step of flatten(session.structure)) {
    const duration = stepSeconds(step);
    if (duration === null || step.target.kind !== kind) continue;
    const mid =
      step.target.kind === "heart_rate_range"
        ? (step.target.minBpm + step.target.maxBpm) / 2
        : step.target.kind === "pace_range"
          ? (step.target.fastSecondsPerKm + step.target.slowSecondsPerKm) / 2
          : 0;
    seconds += duration;
    weighted += duration * mid;
  }
  return seconds > 0 ? weighted / seconds : null;
}

function averageHeartRate(activities: MatchActivity[]) {
  let seconds = 0;
  let weighted = 0;
  for (const activity of activities) {
    if (!activity.durationSeconds || !activity.averageHeartRate) continue;
    seconds += activity.durationSeconds;
    weighted += activity.durationSeconds * activity.averageHeartRate;
  }
  return seconds > 0 ? weighted / seconds : null;
}

function intensityRatio(
  session: PlanSession,
  activities: MatchActivity[],
  duration: number | null,
  distance: number | null,
) {
  const plannedHeartRate = weightedTarget(session, "heart_rate_range");
  const actualHeartRate = averageHeartRate(activities);
  if (plannedHeartRate !== null && actualHeartRate !== null)
    return ratio(actualHeartRate, plannedHeartRate);
  if (session.sport !== "run" || !duration || !distance) return null;
  const plannedPace = weightedTarget(session, "pace_range");
  return plannedPace === null
    ? null
    : ratio(duration / (distance / 1000), plannedPace);
}

function toMatches(
  session: PlanSession,
  activities: MatchActivity[],
  confidence: number,
  substituted: boolean,
): AutoMatch[] {
  const duration = sum(activities.map((item) => item.durationSeconds));
  const distance = sum(activities.map((item) => item.distanceMeters));
  const compliance: MatchCompliance = {
    duration: ratio(duration, session.targets.durationSeconds),
    distance: substituted
      ? null
      : ratio(distance, session.targets.distanceMeters),
    intensity: substituted
      ? null
      : intensityRatio(session, activities, duration, distance),
  };
  const status: AutoMatchStatus = substituted
    ? "substituted"
    : compliance.duration !== null &&
        compliance.duration < completedDurationRatio
      ? "partial"
      : "completed";
  return activities.map((activity) => ({
    sessionKey: session.sessionKey,
    activityId: activity.id,
    status,
    confidence,
    compliance: { ...compliance },
  }));
}

function byStart(first: MatchActivity, second: MatchActivity) {
  return (
    first.startedAt.localeCompare(second.startedAt) ||
    first.id.localeCompare(second.id)
  );
}

function bySchedule(first: PlanSession, second: PlanSession) {
  return (
    first.scheduledOn.localeCompare(second.scheduledOn) ||
    first.sessionKey.localeCompare(second.sessionKey)
  );
}

export function matchSessions({
  sessions,
  activities,
  overrides,
  today,
}: {
  sessions: PlanSession[];
  activities: MatchActivity[];
  overrides: MatchOverride[];
  today: string;
}): MatchResult {
  const coveredSessions = new Set(overrides.map((item) => item.sessionKey));
  const coveredActivities = new Set(
    overrides.flatMap((item) => (item.activityId ? [item.activityId] : [])),
  );
  const open = sessions
    .filter(
      (session) =>
        sessionFamily(session) !== null &&
        session.scheduledOn <= today &&
        !coveredSessions.has(session.sessionKey),
    )
    .sort(bySchedule);
  const free = activities
    .filter(
      (activity) =>
        !coveredActivities.has(activity.id) && day(activity) <= today,
    )
    .sort(byStart);
  const claimed = new Set<string>();
  const matched = new Set<string>();
  const matches: AutoMatch[] = [];
  const available = () => free.filter((activity) => !claimed.has(activity.id));
  const assign = (
    session: PlanSession,
    picked: MatchActivity[],
    confidence: number,
    substituted: boolean,
  ) => {
    if (picked.length === 0) return;
    for (const activity of picked) claimed.add(activity.id);
    matched.add(session.sessionKey);
    matches.push(...toMatches(session, picked, confidence, substituted));
  };

  const days = [...new Set(open.map((session) => session.scheduledOn))];
  for (const date of days) {
    for (const family of ["run", "strength", "cross"] as const) {
      const planned = open.filter(
        (session) =>
          session.scheduledOn === date && sessionFamily(session) === family,
      );
      const done = available().filter(
        (activity) =>
          day(activity) === date && activityFamily(activity.type) === family,
      );
      if (planned.length === 1)
        assign(planned[0], done, matchConfidence.sameDay, false);
      else
        planned.forEach((session, index) => {
          if (done[index])
            assign(session, [done[index]], matchConfidence.sameDay, false);
        });
    }
  }

  for (const session of open) {
    if (matched.has(session.sessionKey)) continue;
    const week = mondayOf(session.scheduledOn);
    const candidates = available().filter(
      (activity) =>
        mondayOf(day(activity)) === week &&
        day(activity) !== session.scheduledOn &&
        activityFamily(activity.type) === sessionFamily(session),
    );
    const distance = (activity: MatchActivity) =>
      Math.abs(Date.parse(day(activity)) - Date.parse(session.scheduledOn));
    const closest = [...candidates].sort(
      (first, second) =>
        distance(first) - distance(second) || byStart(first, second),
    )[0];
    if (closest) assign(session, [closest], matchConfidence.moved, false);
  }

  for (const session of open) {
    if (matched.has(session.sessionKey)) continue;
    const substitutes = available().filter(
      (activity) =>
        day(activity) === session.scheduledOn &&
        activityFamily(activity.type) !== sessionFamily(session),
    );
    assign(session, substitutes, matchConfidence.substituted, true);
  }

  return {
    algorithmVersion: matchingAlgorithmVersion,
    matches: matches.sort(
      (first, second) =>
        first.sessionKey.localeCompare(second.sessionKey) ||
        first.activityId.localeCompare(second.activityId),
    ),
  };
}

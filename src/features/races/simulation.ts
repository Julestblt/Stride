import { elevationBetween, pointDistance, type Course } from "./course";
import { walkDistanceBetween, type WalkPortion } from "./grade";
import {
  cutoffElapsedMinutes,
  isSegmentBoundary,
  isStation,
  type Waypoint,
} from "./waypoints";

export type SimulationSettings = {
  targetSeconds: number;
  walkPaceSecondsPerKm: number;
  aidStopSeconds: number;
  waterStopSeconds: number;
  startMinutes: number;
};

export type Passage = {
  waypointId: string;
  distanceM: number;
  elapsedSeconds: number;
  clockMinutes: number;
  cutoffSeconds: number | null;
  marginSeconds: number | null;
};

export type Segment = {
  fromId: string;
  toId: string;
  fromM: number;
  toM: number;
  gainM: number | null;
  lossM: number | null;
  walkM: number;
  movingSeconds: number;
  paceSecondsPerKm: number;
  arrival: Passage;
};

export type Simulation = {
  feasible: boolean;
  fade: number;
  movingElapsed: number[];
  stops: { distanceM: number; seconds: number }[];
  passages: Passage[];
  segments: Segment[];
  finishSeconds: number;
};

const minimumRunPaceSecondsPerKm = 150;

export function minettiCost(gradePercent: number) {
  const i = Math.max(-0.45, Math.min(0.45, gradePercent / 100));
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  );
}

export function runningFactor(gradePercent: number) {
  return Math.max(0.85, minettiCost(gradePercent) / 3.6);
}

export function fadeFor(distanceM: number) {
  const km = distanceM / 1000;
  return Math.max(0, Math.min(1, (km - 10) / 90)) * 0.25;
}

type StopSettings = Pick<
  SimulationSettings,
  "aidStopSeconds" | "waterStopSeconds"
>;

function stopSeconds(waypoint: Waypoint, settings: StopSettings) {
  if (waypoint.kind === "water") return settings.waterStopSeconds;
  return isStation(waypoint.kind) ? settings.aidStopSeconds : 0;
}

function stopsOf(
  waypoints: Waypoint[],
  distanceM: number,
  settings: StopSettings,
) {
  return waypoints
    .filter(
      (waypoint) =>
        isStation(waypoint.kind) &&
        waypoint.distanceM > 0 &&
        waypoint.distanceM < distanceM,
    )
    .map((waypoint) => ({
      distanceM: waypoint.distanceM,
      seconds: stopSeconds(waypoint, settings),
    }));
}

export function stopTotalSeconds(
  waypoints: Waypoint[],
  distanceM: number,
  settings: StopSettings,
) {
  return stopsOf(waypoints, distanceM, settings).reduce(
    (sum, stop) => sum + stop.seconds,
    0,
  );
}

export function targetPace({
  targetSeconds,
  distanceM,
  stopSeconds,
}: {
  targetSeconds: number | null;
  distanceM: number | null;
  stopSeconds: number;
}) {
  if (!targetSeconds || targetSeconds <= 0 || !distanceM || distanceM <= 0)
    return null;
  const km = distanceM / 1000;
  const moving = targetSeconds - Math.max(0, stopSeconds);
  return {
    overall: targetSeconds / km,
    moving: moving > 0 ? moving / km : null,
  };
}

export function simulate(
  course: Course,
  grades: number[],
  portions: WalkPortion[],
  waypoints: Waypoint[],
  settings: SimulationSettings,
): Simulation {
  const last = course.points.length - 1;
  const fade = fadeFor(course.distanceM);
  const walking: boolean[] = [];
  const lengths: number[] = [];
  let walkSeconds = 0;
  let cost = 0;
  const costs: number[] = [];
  let portionIndex = 0;
  for (let index = 0; index < last; index += 1) {
    const from = pointDistance(course, index);
    const length = pointDistance(course, index + 1) - from;
    const middle = from + length / 2;
    while (
      portionIndex < portions.length &&
      portions[portionIndex].toM < middle
    )
      portionIndex += 1;
    const walk =
      portionIndex < portions.length &&
      portions[portionIndex].fromM <= middle &&
      middle <= portions[portionIndex].toM;
    walking.push(walk);
    lengths.push(length);
    if (walk) {
      walkSeconds += (length / 1000) * settings.walkPaceSecondsPerKm;
      costs.push(0);
    } else {
      const segmentCost =
        length *
        runningFactor(grades[index]) *
        (1 + (fade * middle) / course.distanceM);
      costs.push(segmentCost);
      cost += segmentCost;
    }
  }
  const stops = stopsOf(waypoints, course.distanceM, settings);
  const stopTotal = stops.reduce((sum, stop) => sum + stop.seconds, 0);
  const runSeconds = settings.targetSeconds - walkSeconds - stopTotal;
  const secondsPerCost = cost > 0 ? Math.max(0, runSeconds) / cost : 0;
  const feasible =
    runSeconds > 0 &&
    (cost === 0 || secondsPerCost * 1000 >= minimumRunPaceSecondsPerKm);
  const movingElapsed = [0];
  for (let index = 0; index < last; index += 1)
    movingElapsed.push(
      movingElapsed[index] +
        (walking[index]
          ? (lengths[index] / 1000) * settings.walkPaceSecondsPerKm
          : costs[index] * secondsPerCost),
    );
  const movingAt = (distanceM: number) =>
    movingTime(course, movingElapsed, distanceM);
  const stopsBefore = (distanceM: number) =>
    stops.reduce(
      (sum, stop) => (stop.distanceM < distanceM ? sum + stop.seconds : sum),
      0,
    );
  const cutoffs = cutoffElapsedMinutes(waypoints, settings.startMinutes);
  const passages = waypoints.map((waypoint, index): Passage => {
    const elapsedSeconds = Math.round(
      movingAt(waypoint.distanceM) + stopsBefore(waypoint.distanceM),
    );
    const cutoffMinutes = cutoffs[index];
    const cutoffSeconds = cutoffMinutes === null ? null : cutoffMinutes * 60;
    return {
      waypointId: waypoint.id,
      distanceM: waypoint.distanceM,
      elapsedSeconds,
      clockMinutes: settings.startMinutes + elapsedSeconds / 60,
      cutoffSeconds,
      marginSeconds:
        cutoffSeconds === null ? null : cutoffSeconds - elapsedSeconds,
    };
  });
  const boundaries = waypoints
    .map((waypoint, index) => ({ waypoint, passage: passages[index] }))
    .filter(({ waypoint }) => isSegmentBoundary(waypoint.kind));
  const segments = boundaries
    .slice(1)
    .map(({ waypoint, passage }, index): Segment => {
      const from = boundaries[index];
      const totals = elevationBetween(
        course,
        from.waypoint.distanceM,
        waypoint.distanceM,
      );
      const movingSeconds =
        movingAt(waypoint.distanceM) - movingAt(from.waypoint.distanceM);
      const distance = waypoint.distanceM - from.waypoint.distanceM;
      return {
        fromId: from.waypoint.id,
        toId: waypoint.id,
        fromM: from.waypoint.distanceM,
        toM: waypoint.distanceM,
        gainM: totals.gain,
        lossM: totals.loss,
        walkM: walkDistanceBetween(
          portions,
          from.waypoint.distanceM,
          waypoint.distanceM,
        ),
        movingSeconds,
        paceSecondsPerKm: distance > 0 ? movingSeconds / (distance / 1000) : 0,
        arrival: passage,
      };
    });
  return {
    feasible,
    fade,
    movingElapsed,
    stops,
    passages,
    segments,
    finishSeconds: Math.round(movingAt(course.distanceM) + stopTotal),
  };
}

function movingTime(
  course: Course,
  movingElapsed: number[],
  distanceM: number,
) {
  const last = course.points.length - 1;
  const position = Math.max(0, Math.min(course.distanceM, distanceM));
  const index = Math.min(last - 1, Math.floor(position / course.stepM));
  const from = pointDistance(course, index);
  const span = pointDistance(course, index + 1) - from;
  const ratio = span > 0 ? Math.min(1, (position - from) / span) : 0;
  return (
    movingElapsed[index] +
    (movingElapsed[index + 1] - movingElapsed[index]) * ratio
  );
}

export function elapsedAt(
  course: Course,
  simulation: Simulation,
  distanceM: number,
) {
  return (
    movingTime(course, simulation.movingElapsed, distanceM) +
    simulation.stops.reduce(
      (sum, stop) => (stop.distanceM < distanceM ? sum + stop.seconds : sum),
      0,
    )
  );
}

export function distanceAtElapsed(
  course: Course,
  simulation: Simulation,
  seconds: number,
) {
  let low = 0;
  let high = course.distanceM;
  if (seconds <= 0) return 0;
  if (seconds >= simulation.finishSeconds) return course.distanceM;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (low + high) / 2;
    if (elapsedAt(course, simulation, middle) < seconds) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

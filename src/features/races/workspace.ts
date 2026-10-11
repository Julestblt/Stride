import { positionAt, type Course } from "./course";
import { gradesOf, walkPortions, walkSummary, type WalkPortion } from "./grade";
import { nightOverlap, nightPlan, type NightPlan } from "./night";
import {
  nutritionSegment,
  nutritionTotals,
  type NutritionSegment,
} from "./nutrition";
import {
  daysUntil,
  defaultStartMinutes,
  type RacePlan,
  type RaceSummary,
  type StoredCourse,
} from "./race";
import { distanceAtElapsed, simulate, type Simulation } from "./simulation";
import { localMinutes, zonedEpoch } from "./sun";
import {
  sortWaypoints,
  waypointMarks,
  type Waypoint,
  type WaypointMark,
} from "./waypoints";

export type ScenarioKey = "ambitious" | "target" | "cautious";
export type Scenario = { key: ScenarioKey; seconds: number; label: string };

export const scenarioLabels: Record<ScenarioKey, string> = {
  ambitious: "ambitieux",
  target: "objectif",
  cautious: "prudent",
};

export const walkThresholds = [8, 10, 12] as const;

export function courseFromStored(stored: StoredCourse): Course {
  return {
    stepM: stored.stepM,
    distanceM: stored.distanceM,
    points: stored.points,
    elevationGainM: stored.elevationGainM,
    elevationLossM: stored.elevationLossM,
  };
}

export function scenariosOf(race: RaceSummary, plan: RacePlan): Scenario[] {
  const list: Scenario[] = [];
  if (plan.ambitiousSeconds)
    list.push({
      key: "ambitious",
      seconds: plan.ambitiousSeconds,
      label: scenarioLabels.ambitious,
    });
  if (race.targetSeconds)
    list.push({
      key: "target",
      seconds: race.targetSeconds,
      label: scenarioLabels.target,
    });
  if (plan.cautiousSeconds)
    list.push({
      key: "cautious",
      seconds: plan.cautiousSeconds,
      label: scenarioLabels.cautious,
    });
  return list.sort((a, b) => a.seconds - b.seconds);
}

function virtualWaypoint(
  kind: "start" | "finish",
  distanceM: number,
): Waypoint {
  return {
    id: `virtual-${kind}`,
    kind,
    name: kind === "start" ? "Départ" : "Arrivée",
    distanceM,
    cutoffMinutes: null,
    services: [],
    watchLabel: null,
    alertDistanceM: 0,
    voiceNote: null,
    todo: null,
    nutritionNote: null,
    source: "course",
    needsReview: false,
    revision: 1,
  };
}

export function completeWaypoints(waypoints: Waypoint[], course: Course) {
  const inside = waypoints.filter(
    (waypoint) => waypoint.distanceM <= course.distanceM + 50,
  );
  const withStart = inside.some((waypoint) => waypoint.kind === "start")
    ? inside
    : [virtualWaypoint("start", 0), ...inside];
  const complete = withStart.some((waypoint) => waypoint.kind === "finish")
    ? withStart
    : [...withStart, virtualWaypoint("finish", course.distanceM)];
  return sortWaypoints(complete);
}

export type CourseModel = {
  course: Course;
  waypoints: Waypoint[];
  marks: WaypointMark[];
  grades: number[];
  portions: WalkPortion[];
  walkByThreshold: { threshold: number; count: number; distanceM: number }[];
};

export function courseModel(
  stored: StoredCourse,
  waypoints: Waypoint[],
  plan: RacePlan,
): CourseModel {
  const course = courseFromStored(stored);
  const grades = gradesOf(course);
  const complete = completeWaypoints(waypoints, course);
  const thresholds = [
    ...new Set([...walkThresholds, plan.walkGradePercent]),
  ].sort((a, b) => a - b);
  return {
    course,
    waypoints: complete,
    marks: waypointMarks(complete),
    grades,
    portions: walkPortions(course, plan.walkGradePercent, grades),
    walkByThreshold: thresholds.map((threshold) => ({
      threshold,
      ...walkSummary(walkPortions(course, threshold, grades)),
    })),
  };
}

export type RacePlanModel = {
  scenario: Scenario;
  simulation: Simulation;
  night: NightPlan | null;
  nightKm: { fromM: number; toM: number }[];
  nutrition: NutritionSegment[];
  nutritionTotals: ReturnType<typeof nutritionTotals>;
  startEpochMs: number | null;
  finishMarginSeconds: number | null;
};

export function planModel({
  model,
  race,
  plan,
  scenario,
  timeZone,
}: {
  model: CourseModel;
  race: RaceSummary;
  plan: RacePlan;
  scenario: Scenario;
  timeZone: string;
}): RacePlanModel {
  const startMinutes = plan.startMinutes ?? defaultStartMinutes;
  const simulation = simulate(
    model.course,
    model.grades,
    model.portions,
    model.waypoints,
    {
      targetSeconds: scenario.seconds,
      walkPaceSecondsPerKm: plan.walkPaceSecondsPerKm,
      aidStopSeconds: plan.aidStopSeconds,
      waterStopSeconds: plan.waterStopSeconds,
      startMinutes,
    },
  );
  const start = positionAt(model.course, 0);
  const night = race.date
    ? nightPlan({
        date: race.date,
        startMinutes,
        durationSeconds: simulation.finishSeconds,
        latitude: start.lat,
        longitude: start.lon,
        timeZone,
      })
    : null;
  const nightKm = (night?.windows ?? []).map((window) => ({
    fromM: distanceAtElapsed(model.course, simulation, window.fromSeconds),
    toM: distanceAtElapsed(model.course, simulation, window.toSeconds),
  }));
  const settings = {
    carbsPerHourG: plan.carbsPerHourG,
    waterMlPerHour: plan.waterMlPerHour,
    sodiumMgPerHour: plan.sodiumMgPerHour,
    alarmMinutes: plan.alarmMinutes,
    nightCaffeine: plan.nightCaffeine,
  };
  const nutrition = simulation.segments.map((segment) => {
    const end = segment.arrival.elapsedSeconds;
    const begin = end - segment.movingSeconds;
    const fraction =
      night && segment.movingSeconds > 0
        ? nightOverlap(night, begin, end) / segment.movingSeconds
        : 0;
    return nutritionSegment(segment.movingSeconds, fraction, settings);
  });
  const finish = simulation.passages[simulation.passages.length - 1];
  const finishCutoff = finish.cutoffSeconds ?? plan.cutoffSeconds;
  return {
    scenario,
    simulation,
    night,
    nightKm,
    nutrition,
    nutritionTotals: nutritionTotals(nutrition, settings),
    startEpochMs: race.date
      ? zonedEpoch(race.date, startMinutes, timeZone)
      : null,
    finishMarginSeconds: finishCutoff
      ? finishCutoff - simulation.finishSeconds
      : null,
  };
}

export function countdown(race: RaceSummary, today: string) {
  return race.date ? daysUntil(race.date, today) : null;
}

export function clockOfEpoch(epochMs: number, timeZone: string) {
  return localMinutes(epochMs, timeZone);
}

export function segmentNight(planned: RacePlanModel, index: number) {
  const segment = planned.simulation.segments[index];
  if (!planned.night) return false;
  const end = segment.arrival.elapsedSeconds;
  const begin = end - segment.movingSeconds;
  return nightOverlap(planned.night, begin, end) >= segment.movingSeconds / 2;
}

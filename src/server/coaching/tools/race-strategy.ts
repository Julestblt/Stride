import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { daysUntil } from "@/features/races/race";
import {
  courseModel,
  planModel,
  scenariosOf,
  type RacePlanModel,
} from "@/features/races/workspace";
import { readWorkspace } from "@/server/races/races";
import { weatherFor } from "@/server/races/views";
import { defineTool } from "./define";
import { toolError } from "./errors";

const weatherHorizonDays = 14;

function km(meters: number) {
  return Math.round(meters / 100) / 10;
}

function clock(minutes: number) {
  const total = Math.round(minutes) % (24 * 60);
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function scenarioView(
  planned: RacePlanModel,
  names: ReadonlyMap<string, string>,
) {
  const { simulation } = planned;
  return {
    key: planned.scenario.key,
    label: planned.scenario.label,
    targetSeconds: planned.scenario.seconds,
    finishSeconds: Math.round(simulation.finishSeconds),
    feasible: simulation.feasible,
    finishMarginSeconds: planned.finishMarginSeconds,
    passages: simulation.passages.map((passage) => ({
      name: names.get(passage.waypointId) ?? passage.waypointId,
      km: km(passage.distanceM),
      elapsedSeconds: Math.round(passage.elapsedSeconds),
      clock: clock(passage.clockMinutes),
      cutoffSeconds: passage.cutoffSeconds,
      marginSeconds:
        passage.marginSeconds === null
          ? null
          : Math.round(passage.marginSeconds),
    })),
    segments: simulation.segments.map((segment) => ({
      from: names.get(segment.fromId) ?? segment.fromId,
      to: names.get(segment.toId) ?? segment.toId,
      km: km(segment.toM - segment.fromM),
      gainM: segment.gainM,
      lossM: segment.lossM,
      walkKm: km(segment.walkM),
      paceSecondsPerKm: Math.round(segment.paceSecondsPerKm),
    })),
    nightKm: planned.nightKm.map((window) => ({
      fromKm: km(window.fromM),
      toKm: km(window.toM),
    })),
    fueling: planned.nutritionTotals,
  };
}

export const readRaceStrategyTool = defineTool({
  name: "read_race_strategy",
  description:
    "Read Stride's race workspace analysis for one of the athlete's races, by race id from read_athlete_context: the course (distance, elevation, walking sections), waypoints with services and cutoffs, the athlete's race settings (start time, walk grade, stops, carbs, water and sodium per hour), and the three scenarios (ambitious, target, cautious) simulated on this course with passage times, margins before each cutoff, segment paces, night sections and fueling totals. Weather is included when the race is at most 14 days away. Returns hasCourse false when no GPX or activity course is imported. Never compute paces, times or margins yourself: quote this result.",
  class: "compute",
  dataClasses: ["training"],
  input: z.strictObject({
    raceId: z.string().min(1).max(64).describe("Race id."),
  }),
  output: z.strictObject({
    today: z.iso.date(),
    race: z.unknown(),
    hasCourse: z.boolean(),
    daysToRace: z.number().nullable(),
    course: z.unknown().nullable(),
    settings: z.unknown(),
    waypoints: z.array(z.unknown()),
    scenarios: z.array(z.unknown()),
    weather: z.unknown().nullable(),
  }),
  run: async (context, { raceId }) => {
    if (!z.uuid().safeParse(raceId).success) throw toolError("not_found");
    const data = await readWorkspace(context, raceId);
    if (!data) throw toolError("not_found");
    const today = localToday(data.course?.timeZone ?? "Europe/Paris");
    const daysToRace = data.race.date ? daysUntil(data.race.date, today) : null;
    const { plan, race } = data;
    const settings = {
      startMinutes: plan.startMinutes,
      startConfirmed: plan.startConfirmed,
      walkGradePercent: plan.walkGradePercent,
      walkPaceSecondsPerKm: plan.walkPaceSecondsPerKm,
      aidStopSeconds: plan.aidStopSeconds,
      waterStopSeconds: plan.waterStopSeconds,
      carbsPerHourG: plan.carbsPerHourG,
      waterMlPerHour: plan.waterMlPerHour,
      sodiumMgPerHour: plan.sodiumMgPerHour,
      nightCaffeine: plan.nightCaffeine,
      cutoffSeconds: plan.cutoffSeconds,
    };
    if (!data.course)
      return {
        today,
        race,
        hasCourse: false,
        daysToRace,
        course: null,
        settings,
        waypoints: [],
        scenarios: [],
        weather: null,
      };
    const model = courseModel(data.course, data.waypoints, plan, race.kind);
    const names = new Map(
      model.waypoints.map((waypoint) => [waypoint.id, waypoint.name]),
    );
    const planned = scenariosOf(race, plan).map((scenario) =>
      planModel({
        model,
        race,
        plan,
        scenario,
        timeZone: data.course!.timeZone,
      }),
    );
    const target =
      planned.find((item) => item.scenario.key === "target") ?? planned[0];
    const weather =
      target && daysToRace !== null && daysToRace <= weatherHorizonDays
        ? await weatherFor(data, model, target)
        : null;
    const walk = model.walkByThreshold.find(
      (item) => item.threshold === plan.walkGradePercent,
    );
    return {
      today,
      race,
      hasCourse: true,
      daysToRace,
      course: {
        distanceKm: km(model.course.distanceM),
        elevationGainM: model.course.elevationGainM,
        elevationLossM: model.course.elevationLossM,
        walkSections: walk?.count ?? 0,
        walkKm: walk ? km(walk.distanceM) : 0,
        timeZone: data.course.timeZone,
      },
      settings,
      waypoints: model.waypoints.map((waypoint) => ({
        name: waypoint.name,
        kind: waypoint.kind,
        km: km(waypoint.distanceM),
        cutoffMinutes: waypoint.cutoffMinutes,
        services: waypoint.services,
        nutritionNote: waypoint.nutritionNote,
      })),
      scenarios: planned.map((item) => scenarioView(item, names)),
      weather,
    };
  },
});

import "server-only";
import { positionAt } from "@/features/races/course";
import { isNightAt } from "@/features/races/night";
import { mapData } from "@/features/races/map";
import { profileData } from "@/features/races/profile";
import type { RaceWorkspaceData } from "./races";
import { distanceAtElapsed } from "@/features/races/simulation";
import {
  slotTimes,
  type RaceWeather,
  type SlotRequest,
} from "@/features/races/weather";
import {
  courseModel,
  planModel,
  scenariosOf,
  type CourseModel,
  type RacePlanModel,
  type ScenarioKey,
} from "@/features/races/workspace";
import { raceWeather } from "./weather";

export type CourseViews = {
  model: CourseModel;
  planned: RacePlanModel | null;
  weather: RaceWeather | null;
};

export function planFor(
  data: RaceWorkspaceData,
  scenarioKey: ScenarioKey | null = null,
) {
  if (!data.course) return null;
  const model = courseModel(
    data.course,
    data.waypoints,
    data.plan,
    data.race.kind,
  );
  const scenarios = scenariosOf(data.race, data.plan);
  const scenario =
    scenarios.find((item) => item.key === scenarioKey) ??
    scenarios.find((item) => item.key === "target") ??
    scenarios[0] ??
    null;
  const planned = scenario
    ? planModel({
        model,
        race: data.race,
        plan: data.plan,
        scenario,
        timeZone: data.course.timeZone,
      })
    : null;
  return { model, planned, scenarios };
}

export async function weatherFor(
  data: RaceWorkspaceData,
  model: CourseModel,
  planned: RacePlanModel | null,
) {
  if (
    !planned ||
    !data.race.date ||
    !data.course ||
    planned.startEpochMs === null
  )
    return null;
  const start = planned.startEpochMs;
  const slots: SlotRequest[] = slotTimes(
    planned.simulation.passages[0].clockMinutes,
    planned.simulation.finishSeconds,
  ).map((elapsedSeconds) => {
    const distanceM = distanceAtElapsed(
      model.course,
      planned.simulation,
      elapsedSeconds,
    );
    const position = positionAt(model.course, distanceM);
    return {
      elapsedSeconds,
      epochMs: start + elapsedSeconds * 1000,
      clockMinutes:
        planned.simulation.passages[0].clockMinutes + elapsedSeconds / 60,
      distanceM,
      lat: position.lat,
      lon: position.lon,
      night: planned.night ? isNightAt(planned.night, elapsedSeconds) : false,
    };
  });
  return raceWeather({
    slots,
    date: data.race.date,
    timeZone: data.course.timeZone,
    now: new Date(),
  }).catch(() => null);
}

export function chartViews(
  model: CourseModel,
  planned: RacePlanModel | null,
  weather: RaceWeather | null,
) {
  const profile = profileData({
    course: model.course,
    waypoints: model.waypoints,
    marks: model.marks,
    portions: model.portions,
    planned,
    weather,
  });
  return { profile, map: mapData(model.course, profile) };
}

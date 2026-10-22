import { z } from "zod";
import { walkPortions, walkSummary } from "@/features/races/grade";
import {
  courseReading,
  raceStrategy,
  roadReading,
} from "@/features/races/reading";
import { MapCard } from "@/features/races/components/map-card";
import {
  NightCard,
  OtherRaces,
  ProfileCard,
  ReadingCard,
  SimulationCard,
  StrategyCard,
  WeatherCard,
} from "@/features/races/components/course-cards";
import { CourseImport } from "@/features/races/components/course-import";
import { TargetMissing } from "@/features/races/components/target-missing";
import { WalkCard } from "@/features/races/components/walk-card";
import { listRaces } from "@/server/races/races";
import { loadRace } from "@/server/races/load";
import { chartViews, planFor, weatherFor } from "@/server/races/views";
import { listCourseActivities } from "@/server/races/activities";

const scenarioSchema = z
  .enum(["ambitious", "target", "cautious"])
  .catch("target");

export default async function RaceCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { context, data } = await loadRace(id);
  const races = await listRaces(context);
  if (!data.course) {
    const activities = await listCourseActivities(context);
    return (
      <>
        <CourseImport
          race={data.race}
          activities={activities}
          replacing={false}
        />
        <OtherRaces races={races} currentId={data.race.id} />
      </>
    );
  }
  const views = planFor(data, scenarioSchema.parse(query.scenario))!;
  const { model, planned, scenarios } = views;
  const weather = await weatherFor(data, model, planned);
  const { profile, map } = chartViews(model, planned, weather);
  const road = data.race.kind === "road";
  const roadProfile = road
    ? {
        ...profile,
        walk: [],
        night: [],
        rain: [],
        weather: null,
        segments: [],
        markers: profile.markers.filter(
          (marker) =>
            marker.mark.shape === "circle" &&
            (marker.mark.tone === "start" || marker.mark.tone === "finish"),
        ),
      }
    : profile;
  const walk = model.walkByThreshold.find(
    (item) => item.threshold === data.plan.walkGradePercent,
  )!;
  const walkRows = Array.from({ length: 16 }, (_, index) => index + 5).map(
    (threshold) => ({
      threshold,
      ...walkSummary(walkPortions(model.course, threshold, model.grades)),
    }),
  );
  return (
    <>
      {planned ? (
        <ReadingCard
          reading={
            road
              ? roadReading({ model, planned, weather, date: data.race.date })
              : courseReading({
                  model,
                  planned,
                  weather,
                  walkGrade: data.plan.walkGradePercent,
                  date: data.race.date,
                })
          }
          road={road}
          strategy={!road}
        />
      ) : (
        <TargetMissing race={data.race} plan={data.plan} />
      )}
      <MapCard
        key={data.race.kind}
        data={map}
        fileName={data.course.fileName ?? "parcours.gpx"}
        rainLabel={weather?.mode === "forecast" ? "Averses" : "Météo"}
        hasWeather={profile.rain.length > 0}
        walkThreshold={data.plan.walkGradePercent}
        kind={data.race.kind}
      />
      <ProfileCard
        profile={roadProfile}
        planned={planned}
        weather={weather}
        walkThreshold={data.plan.walkGradePercent}
        walkCount={walk.count}
        walkDistanceM={walk.distanceM}
        race={data.race}
      />
      {weather && planned && (
        <WeatherCard weather={weather} planned={planned} race={data.race} />
      )}
      {!road && (
        <div className="grid items-start gap-5 md:grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          <WalkCard
            raceId={data.race.id}
            revision={data.plan.revision}
            threshold={data.plan.walkGradePercent}
            paceSecondsPerKm={data.plan.walkPaceSecondsPerKm}
            rows={walkRows}
            applied={planned !== null}
          />
          {planned?.night && planned.night.totalSeconds > 0 && (
            <NightCard planned={planned} model={model} raceId={data.race.id} />
          )}
        </div>
      )}
      {!road && planned && (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <SimulationCard
            model={model}
            planned={planned}
            scenarios={scenarios}
            raceId={data.race.id}
            walkThreshold={data.plan.walkGradePercent}
            walkPace={data.plan.walkPaceSecondsPerKm}
            aidStop={data.plan.aidStopSeconds}
            waterStop={data.plan.waterStopSeconds}
          />
          <StrategyCard
            items={raceStrategy({
              model,
              planned,
              walkGrade: data.plan.walkGradePercent,
              walkPaceSecondsPerKm: data.plan.walkPaceSecondsPerKm,
            })}
          />
        </div>
      )}
      <OtherRaces races={races} currentId={data.race.id} />
    </>
  );
}

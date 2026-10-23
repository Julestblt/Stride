import { Suspense } from "react";
import { z } from "zod";
import type { RaceWeather } from "@/features/races/weather";
import { walkPortions, walkSummary } from "@/features/races/grade";
import {
  courseReading,
  raceStrategy,
  roadReading,
  type Reading,
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
  WeatherCardLoading,
} from "@/features/races/components/course-cards";
import { CourseImport } from "@/features/races/components/course-import";
import { TargetMissing } from "@/features/races/components/target-missing";
import { WalkCard } from "@/features/races/components/walk-card";
import { requireAthlete } from "@/server/app/session";
import { listRaces, type RaceWorkspaceData } from "@/server/races/races";
import { loadRace } from "@/server/races/load";
import { chartViews, planFor, weatherFor } from "@/server/races/views";
import { listCourseActivities } from "@/server/races/activities";

const scenarioSchema = z
  .enum(["ambitious", "target", "cautious"])
  .catch("target");

type Workspace = {
  data: RaceWorkspaceData;
  views: NonNullable<ReturnType<typeof planFor>>;
  races: Awaited<ReturnType<typeof listRaces>>;
};

function readingFor(
  { data, views: { model, planned } }: Workspace,
  weather: RaceWeather | null,
): Reading | null {
  if (!planned) return null;
  return data.race.kind === "road"
    ? roadReading({ model, planned, weather, date: data.race.date })
    : courseReading({
        model,
        planned,
        weather,
        walkGrade: data.plan.walkGradePercent,
        date: data.race.date,
      });
}

function CourseReading({
  pending,
  ...props
}: Workspace & { pending?: Promise<RaceWeather | null> }) {
  const reading = readingFor(props, null);
  if (!reading)
    return <TargetMissing race={props.data.race} plan={props.data.plan} />;
  const road = props.data.race.kind === "road";
  return (
    <ReadingCard
      reading={reading}
      pending={pending?.then((weather) => readingFor(props, weather)!)}
      road={road}
      strategy={!road}
    />
  );
}

async function CourseWithWeather({
  weather,
  ...props
}: Workspace & { weather: Promise<RaceWeather | null> }) {
  return <CourseWorkspace {...props} weather={await weather} />;
}

function CourseWorkspace({
  data,
  views,
  races,
  weather,
  pendingWeather = null,
}: Workspace & {
  weather: RaceWeather | null;
  pendingWeather?: React.ReactNode;
}) {
  const course = data.course!;
  const { model, planned, scenarios } = views;
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
      <MapCard
        key={data.race.kind}
        data={map}
        fileName={course.fileName ?? "parcours.gpx"}
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
      {pendingWeather}
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

export default async function RaceCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [{ context, data }, races] = await Promise.all([
    loadRace(id),
    requireAthlete().then((context) => listRaces(context)),
  ]);
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
  const props = { data, views, races };
  const { planned } = views;
  if (!planned || !data.race.date || planned.startEpochMs === null)
    return (
      <>
        <CourseReading {...props} />
        <CourseWorkspace {...props} weather={null} />
      </>
    );
  const weather = weatherFor(data, views.model, planned);
  return (
    <>
      <CourseReading {...props} pending={weather} />
      <Suspense
        fallback={
          <CourseWorkspace
            {...props}
            weather={null}
            pendingWeather={
              <WeatherCardLoading planned={planned} race={data.race} />
            }
          />
        }
      >
        <CourseWithWeather {...props} weather={weather} />
      </Suspense>
    </>
  );
}

import { CourseImport } from "@/features/races/components/course-import";
import { requireAthlete } from "@/server/app/session";
import { listCourseActivities } from "@/server/races/activities";
import { loadRace } from "@/server/races/load";

export default async function RaceCourseImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ data }, activities] = await Promise.all([
    loadRace(id),
    requireAthlete().then((context) => listCourseActivities(context)),
  ]);
  return (
    <CourseImport
      race={data.race}
      activities={activities}
      replacing={data.course !== null}
    />
  );
}

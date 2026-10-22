import { CourseImport } from "@/features/races/components/course-import";
import { listCourseActivities } from "@/server/races/activities";
import { loadRace } from "@/server/races/load";

export default async function RaceCourseImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { context, data } = await loadRace(id);
  const activities = await listCourseActivities(context);
  return (
    <CourseImport
      race={data.race}
      activities={activities}
      replacing={data.course !== null}
    />
  );
}

import { ActivitiesView } from "@/features/activities/components/activities-view";
import { parseActivityFilter } from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { listActivities } from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import { getShell } from "@/server/app/shell";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseActivityFilter((await searchParams).filter);
  const [activities, shell] = await Promise.all([
    listActivities(await requireAthlete(), filter),
    getShell(),
  ]);
  return (
    <ActivitiesView
      activities={activities}
      filter={filter}
      selected={activities[0] ?? null}
      current={false}
      sync={shell.sync}
      today={localToday(new Date())}
    />
  );
}

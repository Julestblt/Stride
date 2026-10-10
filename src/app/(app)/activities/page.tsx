import { ActivitiesView } from "@/features/activities/components/activities-view";
import {
  parseActivityFilter,
  parseActivityLimit,
} from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { listActivities } from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import { getShell } from "@/server/app/shell";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filter = parseActivityFilter(query.filter);
  const limit = parseActivityLimit(query.limit);
  const [{ activities, total }, shell] = await Promise.all([
    listActivities(await requireAthlete(), filter, limit),
    getShell(),
  ]);
  return (
    <ActivitiesView
      activities={activities}
      total={total}
      filter={filter}
      limit={limit}
      selected={activities[0] ?? null}
      current={false}
      sync={shell.sync}
      today={localToday(new Date())}
    />
  );
}

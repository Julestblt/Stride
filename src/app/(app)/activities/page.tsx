import { ActivitiesView } from "@/features/activities/components/activities-view";
import {
  parseActivityFilter,
  parseActivityLimit,
  parseActivitySearch,
} from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { buildActivityView } from "@/features/activities/activity-view";
import {
  listActivities,
  readActivityDetail,
  loadHeartRateZones,
} from "@/server/activities/activities";
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
  const context = await requireAthlete();
  const now = new Date();
  const search = parseActivitySearch(query.q);
  const [{ activities, total }, shell] = await Promise.all([
    listActivities(context, filter, limit, search),
    getShell(),
  ]);
  const [detail, calibration] = activities[0]
    ? await Promise.all([
        readActivityDetail(context, activities[0].id),
        loadHeartRateZones(context, now),
      ])
    : [null, null];
  return (
    <ActivitiesView
      activities={activities}
      total={total}
      filter={filter}
      limit={limit}
      selected={detail?.activity ?? null}
      view={
        detail
          ? buildActivityView({ ...detail, zones: calibration?.zones ?? null })
          : null
      }
      search={search}
      current={false}
      sync={shell.sync}
      today={localToday(now)}
    />
  );
}

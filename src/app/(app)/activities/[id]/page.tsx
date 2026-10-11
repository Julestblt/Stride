import { notFound } from "next/navigation";
import { z } from "zod";
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

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const filter = parseActivityFilter(query.filter);
  const limit = parseActivityLimit(query.limit);
  const context = await requireAthlete();
  const now = new Date();
  const search = parseActivitySearch(query.q);
  const [detail, { activities, total }, shell, calibration] = await Promise.all(
    [
      readActivityDetail(context, id),
      listActivities(context, filter, limit, search),
      getShell(),
      loadHeartRateZones(context, now),
    ],
  );
  if (!detail) notFound();
  return (
    <ActivitiesView
      activities={activities}
      total={total}
      filter={filter}
      limit={limit}
      selected={detail.activity}
      view={buildActivityView({ ...detail, zones: calibration?.zones ?? null })}
      search={search}
      current
      sync={shell.sync}
      today={localToday(now)}
    />
  );
}

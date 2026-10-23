import { Suspense } from "react";
import { ActivitiesView } from "@/features/activities/components/activities-view";
import { ActivityDetail } from "@/features/activities/components/activity-detail";
import {
  activitiesQuery,
  parseActivityFilter,
  parseActivityLimit,
  parseActivitySearch,
} from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { buildActivityView } from "@/features/activities/activity-view";
import { ActivityDetailLoading } from "@/features/data-activity/components/loading";
import {
  listActivities,
  readActivityDetail,
  loadHeartRateZones,
} from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import type { OnboardingContext } from "@/server/onboarding/context";

async function FirstActivityDetail({
  context,
  id,
  now,
  detailHref,
}: {
  context: OnboardingContext;
  id: string;
  now: Date;
  detailHref: string;
}) {
  const [detail, calibration] = await Promise.all([
    readActivityDetail(context, id),
    loadHeartRateZones(context, now),
  ]);
  if (!detail) return null;
  return (
    <ActivityDetail
      activity={detail.activity}
      view={buildActivityView({ ...detail, zones: calibration?.zones ?? null })}
      current={false}
      detailHref={detailHref}
    />
  );
}

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
  const { activities, total } = await listActivities(
    context,
    filter,
    limit,
    search,
  );
  const first = activities[0] ?? null;
  return (
    <ActivitiesView
      activities={activities}
      total={total}
      filter={filter}
      limit={limit}
      selected={first}
      search={search}
      current={false}
      today={localToday(now)}
    >
      {first && (
        <Suspense fallback={<ActivityDetailLoading />}>
          <FirstActivityDetail
            context={context}
            id={first.id}
            now={now}
            detailHref={`/activities/${first.id}/details${activitiesQuery(filter, limit, search)}`}
          />
        </Suspense>
      )}
    </ActivitiesView>
  );
}

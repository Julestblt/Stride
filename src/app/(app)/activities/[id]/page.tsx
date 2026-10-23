import { notFound } from "next/navigation";
import { z } from "zod";
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
import {
  listActivities,
  readActivityDetail,
  loadHeartRateZones,
} from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import {
  ActivityPairBlock,
  PairQuestionCard,
} from "@/features/gear/components/activity-pair";
import { activityPairView, pairQuestion } from "@/features/gear/check-view";
import { loadPairChecks } from "@/server/gear/checks";
import { reconcileGearNotificationsAfterResponse } from "@/server/notifications/garmin";
import { ActivityDebrief } from "@/features/activities/components/activity-debrief";
import { loadSessionDebrief } from "@/server/plans/debrief";

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
  const [detail, { activities, total }, calibration, checks, debrief] =
    await Promise.all([
      readActivityDetail(context, id),
      listActivities(context, filter, limit, search),
      loadHeartRateZones(context, now),
      loadPairChecks(context, id),
      loadSessionDebrief(context, { activityId: id }).catch(() => null),
    ]);
  if (!detail) notFound();
  reconcileGearNotificationsAfterResponse(context, checks);
  const check = checks?.checks.get(id) ?? null;
  const question = check && checks ? pairQuestion(check, checks.shoes) : null;
  return (
    <ActivitiesView
      activities={activities}
      total={total}
      filter={filter}
      limit={limit}
      selected={detail.activity}
      search={search}
      current
      today={localToday(now)}
    >
      <ActivityDetail
        activity={detail.activity}
        view={buildActivityView({
          ...detail,
          zones: calibration?.zones ?? null,
        })}
        current
        detailHref={`/activities/${id}/details${activitiesQuery(filter, limit, search)}`}
        debrief={debrief && <ActivityDebrief debrief={debrief} />}
        pair={
          check &&
          checks && (
            <div className="flex flex-col gap-2.5">
              <ActivityPairBlock view={activityPairView(check, checks.shoes)} />
              {question && <PairQuestionCard question={question} />}
            </div>
          )
        }
      />
    </ActivitiesView>
  );
}

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
import {
  ActivityPairBlock,
  PairQuestionCard,
} from "@/features/gear/components/activity-pair";
import { activityPairView, pairQuestion } from "@/features/gear/check-view";
import { loadPairChecks } from "@/server/gear/checks";

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
  const [detail, { activities, total }, shell, calibration, checks] =
    await Promise.all([
      readActivityDetail(context, id),
      listActivities(context, filter, limit, search),
      getShell(),
      loadHeartRateZones(context, now),
      loadPairChecks(context, id),
    ]);
  if (!detail) notFound();
  const check = checks?.checks.get(id) ?? null;
  const question = check && checks ? pairQuestion(check, checks.shoes) : null;
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
  );
}

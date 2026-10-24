import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityFullDetail } from "@/features/activities/components/activity-full-detail";
import {
  parseActivityFilter,
  parseActivityLimit,
  parseActivitySearch,
} from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { buildActivityView } from "@/features/activities/activity-view";
import {
  loadHeartRateZones,
  readActivityDetail,
} from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";

export const metadata: Metadata = { title: "Détails · Activités" };

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const context = await requireAthlete();
  const now = new Date();
  const [detail, calibration] = await Promise.all([
    readActivityDetail(context, id),
    loadHeartRateZones(context, now),
  ]);
  if (!detail) notFound();
  return (
    <ActivityFullDetail
      activity={detail.activity}
      segments={detail.segments}
      view={buildActivityView({ ...detail, zones: calibration?.zones ?? null })}
      zoneMethod={calibration?.method ?? null}
      filter={parseActivityFilter(query.filter)}
      limit={parseActivityLimit(query.limit)}
      search={parseActivitySearch(query.q)}
      today={localToday(now)}
    />
  );
}

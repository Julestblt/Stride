import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityFullDetail } from "@/features/activities/components/activity-full-detail";
import {
  parseActivityFilter,
  parseActivityLimit,
} from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { readActivityDetail } from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import { getShell } from "@/server/app/shell";

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
  const [detail, shell] = await Promise.all([
    readActivityDetail(context, id),
    getShell(),
  ]);
  if (!detail) notFound();
  return (
    <ActivityFullDetail
      activity={detail.activity}
      segments={detail.segments}
      filter={parseActivityFilter(query.filter)}
      limit={parseActivityLimit(query.limit)}
      sync={shell.sync}
      today={localToday(new Date())}
    />
  );
}

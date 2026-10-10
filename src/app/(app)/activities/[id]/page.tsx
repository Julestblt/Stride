import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivitiesView } from "@/features/activities/components/activities-view";
import { parseActivityFilter } from "@/features/activities/activities";
import { localToday } from "@/features/app-shell/shell";
import { listActivities, readActivity } from "@/server/activities/activities";
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
  const context = await requireAthlete();
  const [selected, activities, shell] = await Promise.all([
    readActivity(context, id),
    listActivities(context, filter),
    getShell(),
  ]);
  if (!selected) notFound();
  return (
    <ActivitiesView
      activities={activities}
      filter={filter}
      selected={selected}
      current
      sync={shell.sync}
      today={localToday(new Date())}
    />
  );
}

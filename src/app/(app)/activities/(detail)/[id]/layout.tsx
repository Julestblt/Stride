import { notFound } from "next/navigation";
import { z } from "zod";
import { readActivity } from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";

export default async function ActivityLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const context = await requireAthlete();
  if (!(await readActivity(context, id))) notFound();
  return children;
}

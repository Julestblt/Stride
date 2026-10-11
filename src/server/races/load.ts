import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { localToday } from "@/features/app-shell/shell";
import { requireAthlete } from "@/server/app/session";
import { readWorkspace } from "./races";

export const loadRace = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const context = await requireAthlete();
  const data = await readWorkspace(context, id);
  if (!data) notFound();
  return { context, data, today: localToday(new Date()) };
});

import { z } from "zod";
import {
  enrichedGpx,
  exportFileName,
  fitCourse,
} from "@/features/races/export";
import { defaultStartMinutes } from "@/features/races/race";
import { zonedEpoch } from "@/features/races/sun";
import {
  courseModel,
  planModel,
  scenariosOf,
} from "@/features/races/workspace";
import { getOnboardingContext } from "@/server/onboarding/context";
import { readWorkspace } from "@/server/races/races";
import { json } from "@/server/races/request";

const formatSchema = z.enum(["fit", "gpx"]);

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/races/[id]/export">,
) {
  const id = z.uuid().safeParse((await params).id);
  const format = formatSchema.safeParse(
    new URL(request.url).searchParams.get("format"),
  );
  if (!id.success || !format.success) return json({ status: "missing" }, 404);
  const context = await getOnboardingContext().catch(() => null);
  if (!context) return json({ status: "session-expired" }, 401);
  const data = await readWorkspace(context, id.data).catch(() => null);
  if (!data?.course) return json({ status: "missing" }, 404);
  const model = courseModel(
    data.course,
    data.waypoints,
    data.plan,
    data.race.kind,
  );
  const scenario = scenariosOf(data.race, data.plan).find(
    (item) => item.key === "target",
  );
  const planned = scenario
    ? planModel({
        model,
        race: data.race,
        plan: data.plan,
        scenario,
        timeZone: data.course.timeZone,
      })
    : null;
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${exportFileName(data.race.name, format.data)}"`,
  };
  if (format.data === "gpx")
    return new Response(enrichedGpx(data.race.name, model), {
      headers: {
        ...headers,
        "Content-Type": "application/gpx+xml; charset=utf-8",
      },
    });
  const fallbackStart = zonedEpoch(
    data.race.date ?? new Date().toISOString().slice(0, 10),
    data.plan.startMinutes ?? defaultStartMinutes,
    data.course.timeZone,
  );
  const bytes = fitCourse(data.race.name, model, planned, fallbackStart);
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { ...headers, "Content-Type": "application/vnd.ant.fit" },
  });
}

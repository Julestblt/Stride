import { getGarminRequestContext } from "@/server/garmin/session";
import { readDataActivity } from "@/server/app/data-activity";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const context = await getGarminRequestContext();
  if (!context)
    return Response.json({ code: "session-expired" }, { status: 401, headers });
  const result = await readDataActivity(context);
  if (!result.ok)
    return Response.json(
      { code: result.unauthorized ? "session-expired" : "unavailable" },
      { status: result.unauthorized ? 401 : 503, headers },
    );
  return Response.json(result.value, { headers });
}

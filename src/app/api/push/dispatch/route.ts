import { pushDispatchSchema } from "@/features/notifications/push";
import { pushEnvironment } from "@/server/push/environment";
import { authorizedDispatch, dispatchPushes } from "@/server/push/send";

const jsonHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const environment = pushEnvironment();
  if (!environment)
    return Response.json(
      { code: "unavailable" },
      { status: 503, headers: jsonHeaders },
    );
  if (!authorizedDispatch(request.headers.get("authorization"), environment))
    return Response.json(
      { code: "unauthorized" },
      { status: 401, headers: jsonHeaders },
    );
  const parsed = pushDispatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { code: "invalid-request" },
      { status: 400, headers: jsonHeaders },
    );
  const result = await dispatchPushes(environment, parsed.data.deliveries);
  return Response.json(result, { headers: jsonHeaders });
}

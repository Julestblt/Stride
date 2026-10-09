import { getOnboardingContext } from "@/server/onboarding/context";
import { onboardingEnabled } from "@/server/onboarding/environment";
import { getGarminClient } from "@/server/garmin/session";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!onboardingEnabled())
    return Response.json({ code: "disabled" }, { status: 404, headers });
  try {
    const context = await getOnboardingContext();
    if (!context)
      return Response.json(
        { code: "session-expired" },
        { status: 401, headers },
      );
    const result = await getGarminClient().getSync({
      accessToken: context.accessToken,
    });
    if (!result.ok)
      return Response.json(
        {
          code:
            result.failure.code === "unauthorized"
              ? "session-expired"
              : "unavailable",
        },
        { status: result.failure.code === "unauthorized" ? 401 : 503, headers },
      );
    return Response.json(result.value, { headers });
  } catch {
    return Response.json({ code: "unavailable" }, { status: 503, headers });
  }
}

import { buildInsightFacts } from "@/features/insights/facts";
import { loadHistoryContext } from "@/server/ai/context/history";
import { phraseHistoryInsights } from "@/server/ai/skills/history-insights";
import { getGarminClient } from "@/server/garmin/session";
import { getOnboardingContext } from "@/server/onboarding/context";
import { onboardingEnabled } from "@/server/onboarding/environment";
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
    const today = new Date();
    const [sync, history] = await Promise.all([
      getGarminClient().getSync({ accessToken: context.accessToken }),
      loadHistoryContext(context, today),
    ]);
    const final =
      sync.ok && sync.value.categories.activities.state === "complete";
    const items = await phraseHistoryInsights({
      athlete: context.userId,
      facts: buildInsightFacts({ ...history, today }),
      allowAi: final,
    });
    return Response.json({ items, final }, { headers });
  } catch {
    return Response.json({ code: "unavailable" }, { status: 503, headers });
  }
}

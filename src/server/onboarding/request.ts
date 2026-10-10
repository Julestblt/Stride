import "server-only";
import { notFound, redirect } from "next/navigation";
import { getGarminClient } from "@/server/garmin/session";
import type { OnboardingConnection } from "@/features/onboarding/progress";
import {
  initialSyncPollingState,
  observeSync,
} from "@/features/onboarding/sync-polling";
import {
  connectionNotice,
  isStepComplete,
} from "@/features/onboarding/progress";
import { getOnboardingContext } from "./context";
import { ensureProgress } from "./progress";
import { onboardingEnabled } from "./environment";
export async function getOnboardingRequest() {
  if (!onboardingEnabled()) notFound();
  const context = await getOnboardingContext();
  if (!context) redirect("/sign-in");
  const progress = await ensureProgress(context);
  let connection: OnboardingConnection;
  try {
    connection = await getGarminClient().getConnection({
      accessToken: context.accessToken,
    });
  } catch {
    connection = { ok: false, failure: { code: "network" } };
  }
  if (connectionNotice(connection) === "session-expired") redirect("/sign-in");
  let initialSync = initialSyncPollingState;
  let sessionExpired = false;
  if (
    connectionNotice(connection) === "connected" ||
    isStepComplete(progress, "garmin")
  ) {
    try {
      const [result, first] = await Promise.all([
        getGarminClient().getSync({ accessToken: context.accessToken }),
        context.client
          .from("provider_activities")
          .select("started_at")
          .eq("user_id", context.userId)
          .order("started_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      sessionExpired = !result.ok && result.failure.code === "unauthorized";
      initialSync = observeSync(
        initialSync,
        result.ok
          ? {
              ...result.value,
              firstActivityDate: first.data?.started_at?.slice(0, 10) ?? null,
            }
          : null,
      );
    } catch {
      initialSync = observeSync(initialSync, null);
    }
  }
  if (sessionExpired) redirect("/sign-in");
  return { progress, connection, email: context.email, context, initialSync };
}

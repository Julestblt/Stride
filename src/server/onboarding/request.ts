import "server-only";
import { notFound, redirect } from "next/navigation";
import { getGarminClient } from "@/server/garmin/session";
import type { OnboardingConnection } from "@/features/onboarding/progress";
import { connectionNotice } from "@/features/onboarding/progress";
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
  return { progress, connection, email: context.email, context };
}

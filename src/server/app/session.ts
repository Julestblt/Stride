import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { onboardingPath, resumeStep } from "@/features/onboarding/progress";
import { getOnboardingContext } from "@/server/onboarding/context";
import { onboardingEnabled } from "@/server/onboarding/environment";
import { ensureProgress } from "@/server/onboarding/progress";

export const requireAthlete = cache(async () => {
  const context = await getOnboardingContext();
  if (!context) redirect("/sign-in");
  if (onboardingEnabled()) {
    const progress = await ensureProgress(context).catch(() => null);
    if (!progress) redirect("/onboarding");
    if (!progress.completed_at) redirect(onboardingPath(resumeStep(progress)));
  }
  return context;
});

import { redirect } from "next/navigation";
import { onboardingPath, resumeStep } from "@/features/onboarding/progress";
import { getOnboardingRequest } from "@/server/onboarding/request";
export default async function OnboardingPage() {
  const { progress } = await getOnboardingRequest();
  redirect(progress.completed_at ? "/" : onboardingPath(resumeStep(progress)));
}

import { notFound, redirect } from "next/navigation";
import { guardOnboarding } from "@/features/onboarding/progress";
import { OnboardingShell } from "@/features/onboarding/components/onboarding-shell";
import { WelcomeStep } from "@/features/onboarding/components/welcome-step";
import { getOnboardingRequest } from "@/server/onboarding/request";
export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { progress, connection, email } = await getOnboardingRequest();
  const guard = guardOnboarding(progress, (await params).step);
  if (guard.kind === "not-found") notFound();
  if (guard.kind === "redirect") redirect(guard.href);
  return (
    <OnboardingShell
      progress={progress}
      connection={connection}
      email={email}
      step={guard.step}
    >
      {guard.step === "welcome" && <WelcomeStep revision={progress.revision} />}
    </OnboardingShell>
  );
}

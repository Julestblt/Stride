import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  connectionNotice,
  guardOnboarding,
  isOnboardingStep,
  stepLabels,
} from "@/features/onboarding/progress";
import { OnboardingShell } from "@/features/onboarding/components/onboarding-shell";
import { WelcomeStep } from "@/features/onboarding/components/welcome-step";
import { GarminStep } from "@/features/onboarding/components/garmin-step";
import { HistoryStep } from "@/features/onboarding/components/history-step";
import { AboutStep } from "@/features/onboarding/components/about-step";
import { GoalsStep } from "@/features/onboarding/components/goals-step";
import { ProfileStep } from "@/features/onboarding/components/profile-step";
import { loadAthleteProfile } from "@/server/onboarding/athlete-profile";
import { readGoals } from "@/server/onboarding/goals";
import { readProfile } from "@/server/onboarding/profile";
import { loadKnownValues } from "@/server/onboarding/known-values";
import { initialGarminScreen } from "@/features/onboarding/garmin-flow";
import { getOnboardingRequest } from "@/server/onboarding/request";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  return { title: isOnboardingStep(step) ? stepLabels[step] : "Bienvenue" };
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { progress, connection, email, context, initialSync } =
    await getOnboardingRequest();
  const guard = guardOnboarding(progress, (await params).step);
  if (guard.kind === "not-found") notFound();
  if (guard.kind === "redirect") redirect(guard.href);
  const about =
    guard.step === "about"
      ? await Promise.all([
          readProfile(context),
          loadKnownValues(context, new Date()).catch(() => ({
            known: [],
            suggestions: {
              observedOn: new Date().toISOString().slice(0, 10),
            },
          })),
        ])
      : null;
  const goals = guard.step === "goals" ? await readGoals(context) : null;
  const athlete =
    guard.step === "profile"
      ? await loadAthleteProfile(context, new Date())
      : null;
  return (
    <OnboardingShell
      initialSync={initialSync}
      progress={progress}
      connection={connection}
      email={email}
      step={guard.step}
    >
      {guard.step === "welcome" && <WelcomeStep revision={progress.revision} />}
      {guard.step === "garmin" && (
        <GarminStep
          revision={progress.revision}
          initialScreen={initialGarminScreen(connection)}
        />
      )}
      {guard.step === "history" && (
        <HistoryStep
          revision={progress.revision}
          reconnect={connectionNotice(connection) === "reconnect"}
        />
      )}
      {about && (
        <AboutStep
          userId={context.userId}
          revision={progress.revision}
          profile={{ values: about[0].values, revision: about[0].revision }}
          updatedAt={about[0].updatedAt}
          known={about[1].known}
          suggestions={about[1].suggestions}
        />
      )}
      {goals && (
        <GoalsStep
          userId={context.userId}
          revision={progress.revision}
          goals={goals}
        />
      )}
      {athlete && (
        <ProfileStep profile={athlete} revision={progress.revision} />
      )}
    </OnboardingShell>
  );
}

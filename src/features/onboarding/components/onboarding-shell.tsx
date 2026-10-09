import {
  isStepComplete,
  type OnboardingConnection,
  type OnboardingStep,
} from "@/features/onboarding/progress";
import type { ProgressSnapshot } from "@/features/onboarding/schemas";
import { StepNavigation } from "./step-navigation";
import { LiveSyncStatus } from "./live-sync-status";
export function OnboardingShell({
  progress,
  connection,
  email,
  step,
  children,
}: {
  progress: ProgressSnapshot;
  connection: OnboardingConnection;
  email: string | null;
  step: OnboardingStep;
  children?: React.ReactNode;
}) {
  return (
    <StepNavigation progress={progress} step={step} email={email}>
      {isStepComplete(progress, "garmin") && (
        <div className="w-full max-w-160">
          <LiveSyncStatus connection={connection} />
        </div>
      )}
      <section
        aria-label="Contenu de l’étape"
        className="flex min-w-0 flex-1 flex-col"
      >
        {children}
      </section>
    </StepNavigation>
  );
}

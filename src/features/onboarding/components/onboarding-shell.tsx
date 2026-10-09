import {
  connectionNotice,
  isStepComplete,
  type OnboardingConnection,
  type OnboardingStep,
} from "@/features/onboarding/progress";
import type { ProgressSnapshot } from "@/features/onboarding/schemas";
import { OnboardingStatusProvider } from "./onboarding-status";
import { StepNavigation } from "./step-navigation";
import { SyncNotice } from "./sync-notice";
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
    <OnboardingStatusProvider
      connected={connectionNotice(connection) === "connected"}
    >
      <StepNavigation
        progress={progress}
        step={step}
        email={email}
        connection={connection}
      >
        {isStepComplete(progress, "garmin") && (
          <div className="w-full max-w-160 empty:hidden">
            <SyncNotice connection={connection} />
          </div>
        )}
        <section
          aria-label="Contenu de l’étape"
          className="flex min-w-0 flex-1 flex-col"
        >
          {children}
        </section>
      </StepNavigation>
    </OnboardingStatusProvider>
  );
}

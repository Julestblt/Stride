import type {
  OnboardingConnection,
  OnboardingStep,
} from "@/features/onboarding/progress";
import type { ProgressSnapshot } from "@/features/onboarding/schemas";
import { StepNavigation } from "./step-navigation";
import { LiveSyncStatus } from "./live-sync-status";
export function OnboardingShell({
  progress,
  connection,
  step,
  children,
}: {
  progress: ProgressSnapshot;
  connection: OnboardingConnection;
  step: OnboardingStep;
  children?: React.ReactNode;
}) {
  return (
    <StepNavigation progress={progress} step={step}>
      <div className="w-full max-w-160">
        <LiveSyncStatus connection={connection} />
      </div>
      <section aria-label="Contenu de l’étape" className="min-w-0 flex-1">
        {children}
      </section>
    </StepNavigation>
  );
}

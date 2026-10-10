"use client";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Stepper,
  StepperItem,
  StepperSegments,
} from "@/components/stride/stepper";
import { StrideMark } from "@/components/stride/stride-mark";
import type { StepStatus } from "@/components/stride/steps";
import {
  connectionNotice,
  isStepAllowed,
  onboardingSteps,
  stepLabels,
  type OnboardingConnection,
  type OnboardingStep,
} from "@/features/onboarding/progress";
import {
  isGarminLive,
  mobileStatus,
  remainingTime,
  showsConnectedBadge,
  stepLine,
  stepStatuses,
  summarizeImport,
  type LineTone,
  type ShellState,
} from "@/features/onboarding/shell-status";
import { cn } from "@/lib/utils";
import type { ProgressSnapshot } from "@/features/onboarding/schemas";
import { navigateOnboarding } from "@/server/onboarding/actions";
import { ImportCard } from "./import-card";
import { useOnboardingStatus } from "./onboarding-status";
import { useOnboardingTransition } from "./use-onboarding-transition";
const statusLabels: Record<StepStatus, string> = {
  done: "Terminée",
  current: "Étape actuelle",
  background: "En cours",
  upcoming: "À venir",
};
const toneClasses: Record<LineTone | "accent", string> = {
  muted: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  accent: "text-accent",
};
export function StepNavigation({
  progress,
  step,
  email,
  connection,
  children,
}: {
  progress: ProgressSnapshot;
  step: OnboardingStep;
  email: string | null;
  connection: OnboardingConnection;
  children: React.ReactNode;
}) {
  const { pending, message, run } = useOnboardingTransition();
  const { garminPhase, sync } = useOnboardingStatus();
  const notice = connectionNotice(connection);
  const live = notice === "connected" || garminPhase === "connected";
  const shell: ShellState = {
    progress,
    step,
    garminPhase,
    connected: notice === "connected",
    reconnect: notice === "reconnect" && garminPhase !== "connected",
    sync: live ? summarizeImport(sync.observation, sync.unavailable) : null,
  };
  const position = onboardingSteps.indexOf(step);
  const statuses = stepStatuses(shell);
  const segments = statuses.map((status, index) =>
    index === position ? "current" : status,
  );
  const status = mobileStatus(shell);
  const previous = onboardingSteps
    .slice(0, position)
    .reverse()
    .find((target) => isStepAllowed(progress, target));
  function navigate(target: OnboardingStep) {
    run(
      () => navigateOnboarding({ step: target, revision: progress.revision }),
      "La navigation a échoué. Réessaie dans un instant.",
    );
  }
  return (
    <div lang="fr" className="flex min-h-svh bg-background">
      <aside
        aria-label="Configuration de ton coach"
        className="sticky top-0 hidden h-svh w-66 shrink-0 flex-col gap-8 overflow-y-auto px-4.5 py-5 lg:flex"
      >
        <span className="flex items-center gap-2.5 font-metric text-title font-semibold uppercase">
          <StrideMark /> Stride
        </span>
        <p className="-mt-1 flex flex-col gap-1.5">
          <span className="font-mono text-micro tracking-wide text-muted-foreground uppercase">
            Configuration de ton coach
          </span>
          <span className="text-meta text-muted-foreground">
            {remainingTime(shell)}
          </span>
        </p>
        <nav aria-label="Étapes du parcours" aria-busy={pending}>
          <Stepper>
            {onboardingSteps.map((target, index) => {
              const line = stepLine(shell, target);
              return (
                <StepperItem
                  key={target}
                  index={index + 1}
                  status={statuses[index]}
                  statusLabels={statusLabels}
                  detail={
                    line && (
                      <span className={toneClasses[line.tone]}>
                        {line.text}
                      </span>
                    )
                  }
                  label={
                    <button
                      type="button"
                      className="rounded-control text-left disabled:cursor-default"
                      aria-disabled={!isStepAllowed(progress, target)}
                      disabled={pending || !isStepAllowed(progress, target)}
                      onClick={() => navigate(target)}
                    >
                      {stepLabels[target]}
                    </button>
                  }
                />
              );
            })}
          </Stepper>
        </nav>
        {isGarminLive(shell) && shell.sync ? (
          <ImportCard summary={shell.sync} />
        ) : (
          email && (
            <p className="mt-auto flex flex-col gap-1 px-0.5">
              <span className="text-xs text-muted-foreground">
                Connecté en tant que
              </span>
              <span className="text-meta break-all">{email}</span>
            </p>
          )
        )}
      </aside>
      <main
        id="onboarding-content"
        className="flex min-w-0 flex-1 flex-col bg-surface-inset lg:my-2 lg:mr-2 lg:rounded-panel lg:border lg:border-border"
      >
        <header className="flex flex-col gap-5 px-5 pt-8 pb-5 lg:flex-row lg:items-center lg:gap-3 lg:border-b lg:border-border lg:px-6 lg:py-5">
          {previous && step === "profile" && (
            <Button
              variant="ghost"
              size="md"
              className="hidden lg:inline-flex"
              disabled={pending}
              aria-busy={pending}
              onClick={() => navigate(previous)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Retour
            </Button>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-label tracking-wide text-muted-foreground uppercase">
              Étape {position + 1} sur 6
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 text-meta lg:hidden",
                toneClasses[status.tone],
              )}
            >
              {status.tone === "success" && (
                <CheckIcon aria-hidden="true" className="size-3.5" />
              )}
              {status.tone === "accent" && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-accent"
                />
              )}
              {status.text}
            </span>
          </div>
          <StepperSegments
            statuses={segments}
            currentProgress={1}
            aria-label="Progression du parcours"
            aria-valuetext={`Étape ${position + 1} sur 6`}
            className="w-full lg:max-w-60"
          />
          {showsConnectedBadge(shell) && (
            <span className="ml-auto hidden items-center gap-2 text-meta leading-none text-success lg:flex">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              Garmin connecté
            </span>
          )}
          <nav aria-label="Changer d’étape" className="lg:hidden">
            <label htmlFor="onboarding-step" className="sr-only">
              Étape du parcours
            </label>
            <select
              id="onboarding-step"
              value={step}
              disabled={pending}
              onChange={(event) =>
                navigate(event.target.value as OnboardingStep)
              }
              className="w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
            >
              {onboardingSteps.map((target) => (
                <option
                  key={target}
                  value={target}
                  disabled={!isStepAllowed(progress, target)}
                >
                  {stepLabels[target]}
                </option>
              ))}
            </select>
          </nav>
        </header>
        <div
          className={cn(
            "flex flex-1 flex-col gap-6 px-5 py-6 lg:py-10",
            step === "profile" ? "lg:px-14.5" : "lg:px-18",
          )}
        >
          {previous && (
            <Button
              variant="ghost"
              size="md"
              className={cn("self-start", step === "profile" && "lg:hidden")}
              disabled={pending}
              aria-busy={pending}
              onClick={() => navigate(previous)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Retour
            </Button>
          )}
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          {pending && (
            <p role="status" className="sr-only">
              Navigation en cours
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

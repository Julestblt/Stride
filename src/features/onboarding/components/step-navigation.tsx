"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Stepper,
  StepperItem,
  StepperSegments,
} from "@/components/stride/stepper";
import { StrideMark } from "@/components/stride/stride-mark";
import type { StepStatus } from "@/components/stride/steps";
import {
  isStepAllowed,
  isStepComplete,
  onboardingSteps,
  stepLabels,
  type OnboardingStep,
} from "@/features/onboarding/progress";
import type { ProgressSnapshot } from "@/features/onboarding/schemas";
import { navigateOnboarding } from "@/server/onboarding/actions";
const statusLabels: Record<StepStatus, string> = {
  done: "Terminée",
  current: "Étape actuelle",
  background: "En cours",
  upcoming: "À venir",
};
export function StepNavigation({
  progress,
  step,
  children,
}: {
  progress: ProgressSnapshot;
  step: OnboardingStep;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const position = onboardingSteps.indexOf(step);
  const statuses = onboardingSteps.map((target): StepStatus =>
    target === step
      ? "current"
      : isStepComplete(progress, target)
        ? "done"
        : "upcoming",
  );
  const previous = onboardingSteps
    .slice(0, position)
    .reverse()
    .find((target) => isStepAllowed(progress, target));
  function navigate(target: OnboardingStep) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await navigateOnboarding({
          step: target,
          revision: progress.revision,
        });
        if (result.status === "success") {
          router.push(result.href);
          router.refresh();
        } else if (result.code === "session-expired")
          router.replace("/sign-in");
        else {
          setMessage(result.message);
          if (result.code === "conflict") router.refresh();
        }
      } catch {
        setMessage("La navigation a échoué. Réessaie dans un instant.");
      }
    });
  }
  return (
    <div lang="fr" className="flex min-h-svh bg-background">
      <aside
        aria-label="Configuration de ton coach"
        className="hidden w-66 shrink-0 flex-col gap-8 px-4.5 py-5 lg:flex"
      >
        <span className="flex items-center gap-2.5 font-metric text-title font-semibold uppercase">
          <StrideMark /> Stride
        </span>
        <p className="font-mono text-micro tracking-wide text-muted-foreground uppercase">
          Configuration de ton coach
        </p>
        <nav aria-label="Étapes du parcours" aria-busy={pending}>
          <Stepper>
            {onboardingSteps.map((target, index) => (
              <StepperItem
                key={target}
                index={index + 1}
                status={statuses[index]}
                statusLabels={statusLabels}
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
            ))}
          </Stepper>
        </nav>
      </aside>
      <main
        id="onboarding-content"
        className="flex min-w-0 flex-1 flex-col bg-surface-inset lg:my-2 lg:mr-2 lg:rounded-panel lg:border lg:border-border"
      >
        <header className="flex flex-col gap-5 px-5 pt-8 pb-5 lg:flex-row lg:items-center lg:gap-3 lg:border-b lg:border-border lg:px-6 lg:py-5">
          <span className="font-mono text-label tracking-wide text-muted-foreground uppercase">
            Étape {position + 1} sur 6
          </span>
          <StepperSegments
            statuses={statuses}
            aria-label="Progression du parcours"
            aria-valuetext={`Étape ${position + 1} sur 6`}
            className="w-full lg:max-w-60"
          />
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
        <div className="flex flex-1 flex-col gap-6 px-5 py-6 lg:px-18 lg:py-10">
          {previous && (
            <Button
              variant="ghost"
              size="md"
              className="self-start"
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

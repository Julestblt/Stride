import type {
  GarminConnection,
  GarminResult,
} from "@/features/garmin/connection";

export const onboardingSteps = [
  "welcome",
  "garmin",
  "history",
  "about",
  "goals",
  "profile",
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];
export type OnboardingProgress = {
  current_step: string;
  revision: number;
  completed_at: string | null;
} & Record<`${OnboardingStep}_completed_at`, string | null>;
export type OnboardingConnection = GarminResult<GarminConnection>;

export const prerequisites: Record<OnboardingStep, readonly OnboardingStep[]> =
  {
    welcome: [],
    garmin: ["welcome"],
    history: ["garmin"],
    about: ["garmin"],
    goals: ["about"],
    profile: ["goals", "history"],
  };
export const stepLabels: Record<OnboardingStep, string> = {
  welcome: "Bienvenue",
  garmin: "Connecter Garmin",
  history: "Importer l’historique",
  about: "À propos de toi",
  goals: "Objectifs",
  profile: "Ton profil d’athlète",
};
export function isOnboardingStep(value: string): value is OnboardingStep {
  return onboardingSteps.some((step) => step === value);
}
export function isStepComplete(
  progress: OnboardingProgress,
  step: OnboardingStep,
) {
  return progress[`${step}_completed_at`] !== null;
}
export function isStepAllowed(
  progress: OnboardingProgress,
  step: OnboardingStep,
) {
  return (
    isStepComplete(progress, step) ||
    prerequisites[step].every((required) => isStepComplete(progress, required))
  );
}
export function resumeStep(progress: OnboardingProgress): OnboardingStep {
  if (
    isOnboardingStep(progress.current_step) &&
    isStepAllowed(progress, progress.current_step)
  )
    return progress.current_step;
  return (
    onboardingSteps.find(
      (step) =>
        !isStepComplete(progress, step) && isStepAllowed(progress, step),
    ) ?? "welcome"
  );
}
export function onboardingPath(step: OnboardingStep) {
  return `/onboarding/${step}`;
}
export function guardOnboarding(
  progress: OnboardingProgress,
  requested: string,
) {
  if (progress.completed_at) return { kind: "redirect", href: "/" } as const;
  if (!isOnboardingStep(requested)) return { kind: "not-found" } as const;
  return isStepAllowed(progress, requested)
    ? ({ kind: "allow", step: requested } as const)
    : ({
        kind: "redirect",
        href: onboardingPath(resumeStep(progress)),
      } as const);
}
export function connectionNotice(
  connection: OnboardingConnection,
): "connected" | "reconnect" | "unavailable" | "session-expired" {
  if (!connection.ok)
    return connection.failure.code === "unauthorized"
      ? "session-expired"
      : "unavailable";
  if (connection.value.status === "connected") return "connected";
  if (
    ["provider_unavailable", "error", "rate_limited"].includes(
      connection.value.status,
    )
  )
    return "unavailable";
  return "reconnect";
}
export function canCompleteStep(
  progress: OnboardingProgress,
  step: OnboardingStep,
  connection: OnboardingConnection,
) {
  if (progress.completed_at || !isStepAllowed(progress, step)) return false;
  if (step === "garmin" || step === "profile") {
    if (connectionNotice(connection) !== "connected") return false;
  }
  return (
    step !== "profile" ||
    onboardingSteps
      .filter((target) => target !== "profile")
      .every((target) => isStepComplete(progress, target))
  );
}

import "server-only";
import type {
  OnboardingConnection,
  OnboardingStep,
} from "@/features/onboarding/progress";
import {
  canCompleteStep,
  connectionNotice,
  isStepAllowed,
  onboardingPath,
  resumeStep,
} from "@/features/onboarding/progress";
import {
  progressSchema,
  transitionSchema,
  type OnboardingActionResult,
  type ProgressSnapshot,
} from "@/features/onboarding/schemas";
import type { OnboardingContext } from "./context";
export type TransitionResponse = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
export type OnboardingServiceDependencies = {
  enabled: () => boolean;
  context: () => Promise<OnboardingContext | null>;
  progress: (context: OnboardingContext) => Promise<ProgressSnapshot>;
  connection: (context: OnboardingContext) => Promise<OnboardingConnection>;
  navigate: (
    context: OnboardingContext,
    step: OnboardingStep,
    revision: number,
  ) => Promise<TransitionResponse>;
  complete: (
    context: OnboardingContext,
    step: OnboardingStep,
    revision: number,
  ) => Promise<TransitionResponse>;
};
export function onboardingFailure(
  code: Extract<OnboardingActionResult, { status: "error" }>["code"],
  progress?: ProgressSnapshot,
): OnboardingActionResult {
  const messages = {
    "invalid-input": "Cette demande n’est pas valide.",
    "session-expired": "Ta session a expiré. Reconnecte-toi pour continuer.",
    conflict:
      "Ton parcours a changé dans une autre fenêtre. La dernière version a été rechargée.",
    locked: "Termine les étapes précédentes pour continuer.",
    "data-incomplete":
      "Enregistre les informations nécessaires avant de continuer.",
    reconnect: "Reconnecte Garmin pour continuer.",
    unavailable: "Le service est indisponible. Réessaie dans un instant.",
    disabled: "Ce parcours n’est pas encore disponible.",
  };
  return {
    status: "error",
    code,
    message: messages[code],
    ...(progress && { progress }),
  };
}
export async function transitionOnboarding(
  dependencies: OnboardingServiceDependencies,
  mode: "navigate" | "complete",
  input: unknown,
): Promise<OnboardingActionResult> {
  if (!dependencies.enabled()) return onboardingFailure("disabled");
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return onboardingFailure("invalid-input");
  try {
    const context = await dependencies.context();
    if (!context) return onboardingFailure("session-expired");
    const progress = await dependencies.progress(context);
    const { step, revision } = parsed.data;
    if (progress.revision !== revision)
      return onboardingFailure("conflict", progress);
    if (progress.completed_at)
      return { status: "success", progress, href: "/" };
    if (!isStepAllowed(progress, step)) return onboardingFailure("locked");
    if (mode === "complete" && (step === "garmin" || step === "profile")) {
      const connection = await dependencies.connection(context);
      const notice = connectionNotice(connection);
      if (notice === "session-expired")
        return onboardingFailure("session-expired");
      if (notice !== "connected")
        return onboardingFailure(
          notice === "reconnect" ? "reconnect" : "unavailable",
        );
      if (!canCompleteStep(progress, step, connection))
        return onboardingFailure("locked");
    }
    const response = await dependencies[mode](context, step, revision);
    if (response.error) {
      if (response.error.code === "PT409")
        return onboardingFailure(
          "conflict",
          await dependencies.progress(context),
        );
      if (response.error.code === "PT401")
        return onboardingFailure("session-expired");
      if (response.error.message === "step_data_incomplete")
        return onboardingFailure("data-incomplete");
      if (response.error.code === "PT422") return onboardingFailure("locked");
      return onboardingFailure("unavailable");
    }
    const updated = progressSchema.safeParse(response.data);
    if (!updated.success || updated.data.user_id !== context.userId)
      return onboardingFailure("unavailable");
    return {
      status: "success",
      progress: updated.data,
      href: updated.data.completed_at
        ? "/"
        : onboardingPath(mode === "navigate" ? step : resumeStep(updated.data)),
    };
  } catch {
    return onboardingFailure("unavailable");
  }
}

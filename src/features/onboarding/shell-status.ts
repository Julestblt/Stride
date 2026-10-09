import { syncPhase, type GarminSyncStatus } from "@/features/garmin/sync";
import type { StepStatus } from "@/components/stride/steps";
import {
  isStepComplete,
  onboardingSteps,
  type OnboardingProgress,
  type OnboardingStep,
} from "./progress";

export type GarminPhase = "intro" | "signing-in" | "verifying" | "connected";
export type LineTone = "muted" | "success" | "warning";
export type StepLine = { text: string; tone: LineTone };
export type ImportSummary = {
  phase: "preparing" | "importing" | "complete" | "attention" | "unavailable";
  activities: number | null;
  year: number | null;
};
export type ShellState = {
  progress: OnboardingProgress;
  step: OnboardingStep;
  garminPhase: GarminPhase | null;
  connected: boolean;
  reconnect: boolean;
  sync: ImportSummary | null;
};

const overview: Record<OnboardingStep, string> = {
  welcome: "Ce qui t’attend",
  garmin: "Obligatoire · 1 min",
  history: "En arrière-plan",
  about: "Ce que Garmin ignore",
  goals: "Course facultative",
  profile: "Vérifie et entre",
};
const current: Record<OnboardingStep, string> = {
  ...overview,
  history: "Tu peux continuer",
};
const garminLines: Record<GarminPhase, StepLine> = {
  intro: { text: "Obligatoire · 1 min", tone: "muted" },
  "signing-in": { text: "Connexion en cours", tone: "muted" },
  verifying: { text: "Vérification", tone: "muted" },
  connected: { text: "Connecté", tone: "success" },
};
const remaining: Record<OnboardingStep, [string, string]> = {
  welcome: ["Environ 6 minutes", "Environ 6 minutes"],
  garmin: ["Environ 5 min restantes", "~5 min restantes"],
  history: ["Encore 4 minutes environ", "~4 min restantes"],
  about: ["Encore 3 minutes environ", "~3 min restantes"],
  goals: ["Encore 1 minute environ", "~1 min restante"],
  profile: ["Dernière étape", "Dernière étape"],
};

export function isGarminLive(
  state: Pick<ShellState, "garminPhase" | "connected">,
) {
  return state.connected || state.garminPhase === "connected";
}

export function remainingTime(
  state: Pick<ShellState, "step" | "garminPhase">,
  size: "long" | "short" = "long",
) {
  if (state.step === "garmin" && state.garminPhase === "connected")
    return size === "long" ? "Environ 4 min restantes" : "~4 min restantes";
  return remaining[state.step][size === "long" ? 0 : 1];
}

export function summarizeImport(
  observation: GarminSyncStatus | null,
  unavailable: boolean,
): ImportSummary {
  const activities = observation?.categories.activities ?? null;
  const oldest = activities?.oldestSynchronizedDate ?? null;
  const summary = {
    activities: activities?.activityCount ?? null,
    year: oldest ? Number(oldest.slice(0, 4)) : null,
  };
  if (unavailable) return { phase: "unavailable", ...summary };
  if (!observation) return { phase: "preparing", ...summary };
  const phase = syncPhase(observation);
  return {
    phase:
      phase === "not_started"
        ? "preparing"
        : phase === "complete"
          ? "complete"
          : phase === "attention"
            ? "attention"
            : "importing",
    ...summary,
  };
}

export function stepLine(
  state: ShellState,
  target: OnboardingStep,
): StepLine | null {
  if (state.step === "welcome")
    return { text: overview[target], tone: "muted" };
  if (target === "garmin") {
    if (state.reconnect && isStepComplete(state.progress, "garmin"))
      return { text: "À reconnecter", tone: "warning" };
    if (state.step === "garmin")
      return garminLines[state.garminPhase ?? "intro"];
    if (state.step === "history" && isGarminLive(state))
      return garminLines.connected;
    return null;
  }
  if (target === state.step) return { text: current[target], tone: "muted" };
  if (target !== "history") return null;
  if (!isGarminLive(state))
    return state.step === "garmin"
      ? { text: overview.history, tone: "muted" }
      : null;
  const sync = state.sync ?? {
    phase: "preparing",
    activities: null,
    year: null,
  };
  switch (sync.phase) {
    case "preparing":
      return { text: "Démarrage…", tone: "muted" };
    case "importing":
      return {
        text: sync.year
          ? `Lecture en cours · ${sync.year}`
          : "Lecture en cours",
        tone: "muted",
      };
    case "attention":
      return { text: "Import partiel", tone: "warning" };
    case "unavailable":
      return { text: "Garmin indisponible", tone: "warning" };
    case "complete":
      return null;
  }
}

export function stepStatuses(state: ShellState): StepStatus[] {
  const live = isGarminLive(state);
  const active =
    live &&
    state.sync !== null &&
    ["preparing", "importing"].includes(state.sync.phase);
  return onboardingSteps.map((target): StepStatus => {
    if (target === "garmin" && state.step === "garmin" && live) return "done";
    if (target === state.step) return "current";
    if (target === "history" && active) return "background";
    return isStepComplete(state.progress, target) ? "done" : "upcoming";
  });
}

export function showsConnectedBadge(state: ShellState) {
  return (
    isGarminLive(state) &&
    !state.reconnect &&
    ((state.step === "garmin" && state.garminPhase === "connected") ||
      state.step === "history")
  );
}

export function importCaption(sync: ImportSummary) {
  const count =
    sync.activities === null
      ? null
      : `${new Intl.NumberFormat("fr-FR").format(sync.activities)} activités`;
  switch (sync.phase) {
    case "preparing":
      return "Préparation de ton historique";
    case "importing":
      return [
        count,
        sync.year ? `actuellement en ${sync.year}` : "continue si tu avances",
      ]
        .filter(Boolean)
        .join(" · ");
    case "complete":
      return ["Historique à jour", count].filter(Boolean).join(" · ");
    case "attention":
      return ["Import partiel", count].filter(Boolean).join(" · ");
    case "unavailable":
      return "Garmin indisponible · dernières données affichées";
  }
}

export function mobileStatus(state: ShellState): {
  text: string;
  tone: "muted" | "success" | "accent" | "warning";
} {
  if (showsConnectedBadge(state))
    return { text: "Garmin connecté", tone: "success" };
  if (
    isGarminLive(state) &&
    state.sync &&
    !["welcome", "garmin"].includes(state.step)
  ) {
    if (state.sync.phase === "complete")
      return { text: "Import terminé", tone: "success" };
    if (state.sync.phase === "attention" || state.sync.phase === "unavailable")
      return { text: "Import partiel", tone: "warning" };
    return {
      text: state.sync.year ? `Import · ${state.sync.year}` : "Import en cours",
      tone: "accent",
    };
  }
  return { text: remainingTime(state, "short"), tone: "muted" };
}

import { describe, expect, it } from "vitest";
import type { GarminSyncStatus } from "../../src/features/garmin/sync";
import type { OnboardingProgress } from "../../src/features/onboarding/progress";
import {
  importCaption,
  mobileStatus,
  remainingTime,
  showsConnectedBadge,
  stepLine,
  stepStatuses,
  summarizeImport,
  type ImportSummary,
  type ShellState,
} from "../../src/features/onboarding/shell-status";

const at = "2026-10-09T12:00:00Z";
function progress(
  completed: (keyof typeof steps)[] = [],
  current = "welcome",
): OnboardingProgress {
  return {
    current_step: current,
    revision: 1,
    completed_at: null,
    ...Object.fromEntries(
      Object.keys(steps).map((step) => [
        `${step}_completed_at`,
        completed.includes(step as keyof typeof steps) ? at : null,
      ]),
    ),
  } as OnboardingProgress;
}
const steps = {
  welcome: 0,
  garmin: 0,
  history: 0,
  about: 0,
  goals: 0,
  profile: 0,
};
function shell(overrides: Partial<ShellState> = {}): ShellState {
  return {
    progress: progress(),
    step: "welcome",
    garminPhase: null,
    connected: false,
    reconnect: false,
    sync: null,
    ...overrides,
  };
}
const importing: ImportSummary = {
  phase: "importing",
  activities: 1486,
  year: 2021,
};
function observation(
  state: "running" | "complete" | "failed",
  started = true,
): GarminSyncStatus {
  const category = {
    state,
    oldestSynchronizedDate: "2021-03-14",
    lastSuccessAt: null,
    lastErrorCode: null,
    activityCount: 1486,
  };
  return {
    started,
    categories: {
      activities: category,
      recovery: { ...category, state: "complete" },
      fitness: { ...category, state: "complete" },
      patterns: { ...category, state: "complete" },
    },
    lastSyncAt: null,
    updatedAt: null,
  };
}
const line = (state: ShellState, step: Parameters<typeof stepLine>[1]) =>
  stepLine(state, step)?.text ?? null;

describe("onboarding shell step lines", () => {
  it("shows every step's overview on Welcome", () => {
    const state = shell();
    expect(
      (
        ["welcome", "garmin", "history", "about", "goals", "profile"] as const
      ).map((step) => line(state, step)),
    ).toEqual([
      "Ce qui t’attend",
      "Obligatoire · 1 min",
      "En arrière-plan",
      "Ce que Garmin ignore",
      "Course facultative",
      "Vérifie et entre",
    ]);
  });
  it("follows the Garmin state model under Connect Garmin", () => {
    const base = shell({ step: "garmin", progress: progress(["welcome"]) });
    expect(line({ ...base, garminPhase: "intro" }, "garmin")).toBe(
      "Obligatoire · 1 min",
    );
    expect(line({ ...base, garminPhase: "signing-in" }, "garmin")).toBe(
      "Connexion en cours",
    );
    expect(line({ ...base, garminPhase: "verifying" }, "garmin")).toBe(
      "Vérification",
    );
    expect(stepLine({ ...base, garminPhase: "connected" }, "garmin")).toEqual({
      text: "Connecté",
      tone: "success",
    });
    expect(line({ ...base, garminPhase: "signing-in" }, "history")).toBe(
      "En arrière-plan",
    );
    expect(line({ ...base, garminPhase: "signing-in" }, "about")).toBeNull();
  });
  it("starts the background import line once Garmin is connected", () => {
    const connected = shell({
      step: "garmin",
      progress: progress(["welcome"]),
      garminPhase: "connected",
    });
    expect(line(connected, "history")).toBe("Démarrage…");
    expect(line({ ...connected, sync: importing }, "history")).toBe(
      "Lecture en cours · 2021",
    );
    expect(stepStatuses({ ...connected, sync: importing })).toEqual([
      "done",
      "done",
      "background",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });
  it("keeps Garmin connected on history and reads the import on later steps", () => {
    const history = shell({
      step: "history",
      progress: progress(["welcome", "garmin"]),
      connected: true,
      sync: importing,
    });
    expect(line(history, "garmin")).toBe("Connecté");
    expect(line(history, "history")).toBe("Tu peux continuer");
    const about = {
      ...history,
      step: "about" as const,
      progress: progress(["welcome", "garmin", "history"]),
    };
    expect(line(about, "garmin")).toBeNull();
    expect(line(about, "history")).toBe("Lecture en cours · 2021");
    expect(line(about, "about")).toBe("Ce que Garmin ignore");
    expect(stepStatuses(about)[2]).toBe("background");
    const done = {
      ...about,
      sync: { ...importing, phase: "complete" as const },
    };
    expect(line(done, "history")).toBeNull();
    expect(stepStatuses(done)[2]).toBe("done");
    expect(
      line({ ...about, sync: { ...importing, phase: "attention" } }, "history"),
    ).toBe("Import partiel");
  });
  it("flags a Garmin step that needs reconnecting", () => {
    const state = shell({
      step: "goals",
      progress: progress(["welcome", "garmin", "history", "about"]),
      reconnect: true,
    });
    expect(stepLine(state, "garmin")).toEqual({
      text: "À reconnecter",
      tone: "warning",
    });
    expect(showsConnectedBadge(state)).toBe(false);
  });
});

describe("onboarding shell summaries", () => {
  it("gives remaining time per step", () => {
    expect(remainingTime({ step: "welcome", garminPhase: null })).toBe(
      "Environ 6 minutes",
    );
    expect(remainingTime({ step: "garmin", garminPhase: "intro" })).toBe(
      "Environ 5 min restantes",
    );
    expect(remainingTime({ step: "garmin", garminPhase: "connected" })).toBe(
      "Environ 4 min restantes",
    );
    expect(remainingTime({ step: "goals", garminPhase: null }, "short")).toBe(
      "~1 min restante",
    );
    expect(remainingTime({ step: "profile", garminPhase: null })).toBe(
      "Dernière étape",
    );
  });
  it("summarizes real sync observations without inventing progress", () => {
    expect(summarizeImport(null, false)).toEqual({
      phase: "preparing",
      activities: null,
      year: null,
    });
    expect(summarizeImport(observation("running", false), false).phase).toBe(
      "preparing",
    );
    expect(summarizeImport(observation("running"), false)).toEqual(importing);
    expect(summarizeImport(observation("complete"), false).phase).toBe(
      "complete",
    );
    expect(summarizeImport(observation("failed"), false).phase).toBe(
      "attention",
    );
    expect(summarizeImport(observation("running"), true).phase).toBe(
      "unavailable",
    );
  });
  it("captions the sidebar import card", () => {
    expect(importCaption({ ...importing, phase: "preparing" })).toBe(
      "Préparation de ton historique",
    );
    expect(importCaption(importing)).toBe(
      "1\u202f486 activités · actuellement en 2021",
    );
    expect(importCaption({ ...importing, phase: "complete" })).toBe(
      "Historique à jour · 1\u202f486 activités",
    );
    expect(
      importCaption({ phase: "importing", activities: null, year: null }),
    ).toBe("continue si tu avances");
  });
  it("shows the Garmin badge only on the connected screen and history", () => {
    const connected = shell({
      step: "garmin",
      garminPhase: "connected",
    });
    expect(showsConnectedBadge(connected)).toBe(true);
    expect(
      showsConnectedBadge({ ...connected, garminPhase: "verifying" }),
    ).toBe(false);
    expect(
      showsConnectedBadge(shell({ step: "history", connected: true })),
    ).toBe(true);
    expect(showsConnectedBadge(shell({ step: "about", connected: true }))).toBe(
      false,
    );
  });
  it("labels the mobile header with time, connection or import state", () => {
    expect(mobileStatus(shell())).toEqual({
      text: "Environ 6 minutes",
      tone: "muted",
    });
    expect(
      mobileStatus(
        shell({ step: "history", connected: true, sync: importing }),
      ),
    ).toEqual({ text: "Garmin connecté", tone: "success" });
    expect(
      mobileStatus(shell({ step: "about", connected: true, sync: importing })),
    ).toEqual({ text: "Import · 2021", tone: "accent" });
    expect(
      mobileStatus(
        shell({
          step: "goals",
          connected: true,
          sync: { ...importing, phase: "complete" },
        }),
      ),
    ).toEqual({ text: "Import terminé", tone: "success" });
  });
});

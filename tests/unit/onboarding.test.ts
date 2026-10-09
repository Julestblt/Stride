import { describe, expect, it } from "vitest";
import {
  canCompleteStep,
  connectionNotice,
  guardOnboarding,
  isStepAllowed,
  onboardingSteps,
  prerequisites,
  resumeStep,
  type OnboardingConnection,
  type OnboardingProgress,
} from "../../src/features/onboarding/progress";
import {
  progressSchema,
  transitionSchema,
} from "../../src/features/onboarding/schemas";
const date = "2026-10-09T12:00:00+00:00";
export function progress(
  mask = 0,
  current_step = "welcome",
): OnboardingProgress {
  return {
    current_step,
    revision: 0,
    completed_at: null,
    welcome_completed_at: mask & 1 ? date : null,
    garmin_completed_at: mask & 2 ? date : null,
    history_completed_at: mask & 4 ? date : null,
    about_completed_at: mask & 8 ? date : null,
    goals_completed_at: mask & 16 ? date : null,
    profile_completed_at: mask & 32 ? date : null,
  };
}
const connected: OnboardingConnection = {
  ok: true,
  value: { status: "connected", connectedAt: null, lastSyncAt: null },
};
describe("onboarding progression", () => {
  it("evaluates all six targets for every completion combination", () => {
    for (let mask = 0; mask < 64; mask++)
      for (const step of onboardingSteps) {
        const snapshot = progress(mask);
        const expected =
          snapshot[`${step}_completed_at`] !== null ||
          prerequisites[step].every(
            (required) => snapshot[`${required}_completed_at`] !== null,
          );
        expect(isStepAllowed(snapshot, step)).toBe(expected);
        expect(guardOnboarding(snapshot, step).kind).toBe(
          expected ? "allow" : "redirect",
        );
      }
  });
  it("resumes stored allowed steps and falls back to the first incomplete allowed step", () => {
    expect(resumeStep(progress(3, "about"))).toBe("about");
    expect(resumeStep(progress(3, "profile"))).toBe("history");
    expect(resumeStep(progress(3, "unknown"))).toBe("history");
    expect(resumeStep(progress(7, "unknown"))).toBe("about");
    expect(resumeStep(progress(31, "unknown"))).toBe("profile");
    expect(resumeStep(progress(0, "profile"))).toBe("welcome");
  });
  it("keeps completed steps editable across every Garmin outcome", () => {
    const outcomes: OnboardingConnection[] = [
      connected,
      {
        ok: true,
        value: { status: "disconnected", connectedAt: null, lastSyncAt: null },
      },
      { ok: false, failure: { code: "network" } },
    ];
    for (const connection of outcomes)
      for (let mask = 0; mask < 64; mask++)
        for (const step of onboardingSteps) {
          const snapshot = progress(mask);
          const allowed = isStepAllowed(snapshot, step);
          expect(canCompleteStep(snapshot, step, connection)).toBe(
            allowed &&
              (!(step === "garmin" || step === "profile") ||
                connectionNotice(connection) === "connected") &&
              (step !== "profile" || mask === 31 || mask === 63),
          );
        }
  });
  it("guards locked, unknown and completed routes without mutating stored progress", () => {
    const snapshot = progress(1, "garmin");
    const original = structuredClone(snapshot);
    expect(guardOnboarding(snapshot, "goals")).toEqual({
      kind: "redirect",
      href: "/onboarding/garmin",
    });
    expect(guardOnboarding(snapshot, "unknown")).toEqual({ kind: "not-found" });
    expect(guardOnboarding(snapshot, "welcome")).toEqual({
      kind: "allow",
      step: "welcome",
    });
    expect(snapshot).toEqual(original);
    expect(
      guardOnboarding({ ...progress(63), completed_at: date }, "garmin"),
    ).toEqual({ kind: "redirect", href: "/" });
  });
  it.each([
    "expired",
    "reconnect_required",
    "disconnected",
    "connecting",
    "mfa_required",
  ] as const)(
    "keeps recorded Garmin prerequisites available when %s",
    (status) => {
      const snapshot = progress(31);
      const connection: OnboardingConnection = {
        ok: true,
        value: { status, connectedAt: null, lastSyncAt: null },
      };
      for (const step of onboardingSteps)
        expect(isStepAllowed(snapshot, step)).toBe(true);
      expect(connectionNotice(connection)).toBe("reconnect");
      expect(canCompleteStep(snapshot, "profile", connection)).toBe(false);
    },
  );
  it("treats Stride expiration distinctly from provider unavailability", () => {
    expect(
      connectionNotice({ ok: false, failure: { code: "unauthorized" } }),
    ).toBe("session-expired");
    expect(
      connectionNotice({
        ok: false,
        failure: { code: "provider_unavailable" },
      }),
    ).toBe("unavailable");
  });
});
describe("onboarding input boundaries", () => {
  it.each([
    { step: "goals", revision: -1 },
    { step: "goals", revision: 0.5 },
    { step: "goals", revision: "0" },
    { step: "unknown", revision: 0 },
    { step: "welcome", revision: 0, userId: "foreign" },
    { step: "welcome", revision: 2147483648 },
  ])("rejects untrusted action input %j", (input) =>
    expect(transitionSchema.safeParse(input).success).toBe(false),
  );
  it("validates persisted timestamps and revision but permits current-step recovery", () => {
    const row = {
      ...progress(),
      user_id: "53d17ee9-4940-4be0-8bbe-6c35703a963d",
      current_step: "future-step",
      created_at: date,
      updated_at: date,
    };
    expect(progressSchema.safeParse(row).success).toBe(true);
    expect(
      progressSchema.safeParse({ ...row, welcome_completed_at: "invalid" })
        .success,
    ).toBe(false);
    expect(progressSchema.safeParse({ ...row, revision: -1 }).success).toBe(
      false,
    );
  });
});

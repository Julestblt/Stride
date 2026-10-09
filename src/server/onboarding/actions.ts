"use server";
import { getGarminClient } from "@/server/garmin/session";
import { createCompletionClient } from "@/server/supabase/completion-client";
import { getOnboardingContext } from "./context";
import { ensureProgress } from "./progress";
import { onboardingEnabled } from "./environment";
import {
  transitionOnboarding,
  type OnboardingServiceDependencies,
} from "./service";
import { saveProfile } from "./profile";
import {
  connectGarmin,
  type GarminConnectionDependencies,
} from "./garmin-connection";
function dependencies(): OnboardingServiceDependencies {
  return {
    enabled: onboardingEnabled,
    context: () => getOnboardingContext({ writable: true }),
    progress: ensureProgress,
    connection: (context) =>
      getGarminClient().getConnection({ accessToken: context.accessToken }),
    navigate: (context, step, revision) =>
      Promise.resolve(
        context.client.rpc("set_onboarding_current_step", {
          p_step: step,
          p_expected_revision: revision,
        }),
      ),
    complete: (context, step, revision) => {
      if (step === "garmin" || step === "profile") {
        const completion = createCompletionClient();
        return completion
          ? Promise.resolve(completion.complete(context.userId, step, revision))
          : Promise.resolve({ data: null, error: { code: "unavailable" } });
      }
      return Promise.resolve(
        context.client.rpc("complete_onboarding_step", {
          p_step: step,
          p_expected_revision: revision,
        }),
      );
    },
  };
}
export async function navigateOnboarding(input: unknown) {
  return transitionOnboarding(dependencies(), "navigate", input);
}
export async function completeOnboarding(input: unknown) {
  return transitionOnboarding(dependencies(), "complete", input);
}
function garminDependencies(): GarminConnectionDependencies {
  return {
    enabled: onboardingEnabled,
    context: () => getOnboardingContext({ writable: true }),
    progress: ensureProgress,
    start: (context, credentials) =>
      getGarminClient().startConnection(
        { accessToken: context.accessToken },
        credentials,
      ),
    verify: (context, challenge) =>
      getGarminClient().continueMfa(
        { accessToken: context.accessToken },
        challenge,
      ),
  };
}
export async function startGarminConnection(input: unknown) {
  return connectGarmin(garminDependencies(), "start", input);
}
export async function verifyGarminCode(input: unknown) {
  return connectGarmin(garminDependencies(), "verify", input);
}
export async function saveAthleteProfile(input: unknown) {
  if (!onboardingEnabled()) return { status: "error" as const };
  return saveProfile(
    { context: () => getOnboardingContext({ writable: true }) },
    input,
  );
}

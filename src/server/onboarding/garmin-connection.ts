import "server-only";
import {
  connectFailure,
  type GarminAuthOutcome,
  type GarminResult,
} from "@/features/garmin/connection";
import type { GarminConnectResult } from "@/features/onboarding/garmin-flow";
import { isStepAllowed } from "@/features/onboarding/progress";
import {
  garminCodeSchema,
  garminCredentialsSchema,
  type ProgressSnapshot,
} from "@/features/onboarding/schemas";
import type { OnboardingContext } from "./context";
export type GarminConnectionDependencies = {
  enabled: () => boolean;
  context: () => Promise<OnboardingContext | null>;
  progress: (context: OnboardingContext) => Promise<ProgressSnapshot>;
  start: (
    context: OnboardingContext,
    credentials: { email: string; password: string },
  ) => Promise<GarminResult<GarminAuthOutcome>>;
  verify: (
    context: OnboardingContext,
    challenge: { challengeId: string; otp: string },
  ) => Promise<GarminResult<GarminAuthOutcome>>;
};
const failed = (
  state: "connection_failed" | "garmin_unavailable" | "session_expired",
): GarminConnectResult => ({
  status: "error",
  failure: { state, canRetryCode: false },
});
export async function connectGarmin(
  dependencies: GarminConnectionDependencies,
  mode: "start" | "verify",
  input: unknown,
): Promise<GarminConnectResult> {
  if (!dependencies.enabled()) return failed("connection_failed");
  const parsed =
    mode === "start"
      ? garminCredentialsSchema.safeParse(input)
      : garminCodeSchema.safeParse(input);
  if (!parsed.success) return failed("connection_failed");
  try {
    const context = await dependencies.context();
    if (!context) return failed("session_expired");
    if (!isStepAllowed(await dependencies.progress(context), "garmin"))
      return failed("connection_failed");
    const result =
      "password" in parsed.data
        ? await dependencies.start(context, parsed.data)
        : await dependencies.verify(context, parsed.data);
    if (!result.ok)
      return { status: "error", failure: connectFailure(result.failure) };
    return result.value.status === "connected"
      ? { status: "connected" }
      : { status: "mfa_required", challengeId: result.value.challengeId };
  } catch {
    return failed("garmin_unavailable");
  }
}

import "server-only";
export function onboardingEnabled() {
  return process.env.ONBOARDING_ENABLED === "true";
}

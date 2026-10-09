import type { GarminConnectFailure } from "@/features/garmin/connection";
import type { OnboardingConnection } from "./progress";

export type GarminScreen = "intro" | "credentials" | "code" | "connected";
export type GarminStage = "credentials" | "code";
export type GarminNotice =
  | "invalid_credentials"
  | "rate_limited"
  | "garmin_unavailable"
  | "connection_failed"
  | "invalid_code"
  | "code_rejected"
  | "expired_code";
export type GarminConnectResult =
  | { status: "connected" }
  | { status: "mfa_required"; challengeId: string }
  | { status: "error"; failure: GarminConnectFailure };
export type GarminFailureView = {
  screen: GarminStage;
  notice: GarminNotice;
  clearPassword: boolean;
  selectCode: boolean;
  retryAfterSeconds?: number;
};

export const garminSlowNoticeMs = 15_000;
export const garminVerifiedHoldMs = 600;
export const garminAutoContinueSeconds = 3;

export function initialGarminScreen(
  connection: OnboardingConnection,
): GarminScreen {
  return connection.ok && connection.value.status === "connected"
    ? "connected"
    : "intro";
}

export function garminFailureView(
  stage: GarminStage,
  failure: GarminConnectFailure,
): GarminFailureView | "session-expired" {
  const view = (
    screen: GarminStage,
    notice: GarminNotice,
    clearPassword = false,
    selectCode = false,
  ): GarminFailureView => ({ screen, notice, clearPassword, selectCode });
  switch (failure.state) {
    case "session_expired":
      return "session-expired";
    case "invalid_credentials":
      return view("credentials", "invalid_credentials", true);
    case "rate_limited":
      return {
        ...view("credentials", "rate_limited", stage === "code"),
        ...(failure.retryAfterSeconds !== undefined && {
          retryAfterSeconds: failure.retryAfterSeconds,
        }),
      };
    case "garmin_unavailable":
      return view(stage, "garmin_unavailable");
    case "invalid_mfa":
      return failure.canRetryCode
        ? view("code", "invalid_code", false, true)
        : view("code", "code_rejected");
    case "expired_mfa":
      return view("code", "expired_code");
    case "connection_failed":
      return view("credentials", "connection_failed", true);
  }
}

export function requiresNewSignIn(notice: GarminNotice | null) {
  return notice === "code_rejected" || notice === "expired_code";
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function normalizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

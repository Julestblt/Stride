export const garminConnectionStatuses = [
  "disconnected",
  "connecting",
  "mfa_required",
  "connected",
  "expired",
  "reconnect_required",
  "rate_limited",
  "provider_unavailable",
  "error",
] as const;

export type GarminConnectionStatus = (typeof garminConnectionStatuses)[number];

export type GarminConnection = {
  status: GarminConnectionStatus;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

export type GarminAuthOutcome =
  { status: "connected" } | { status: "mfa_required"; challengeId: string };

export const garminErrorCodes = [
  "invalid_request",
  "unauthorized",
  "invalid_credentials",
  "invalid_mfa",
  "challenge_expired",
  "rate_limited",
  "provider_unavailable",
  "reconnect_required",
  "storage_unavailable",
  "sync_failed",
  "partial_data",
  "unsupported_data",
  "connection_changed",
  "dependency_unavailable",
  "service_unavailable",
  "disconnected",
  "connection_replaced",
  "sync_throttled",
  "gear_not_found",
  "activity_not_found",
  "gear_starts_after_activity",
] as const;

export type GarminErrorCode = (typeof garminErrorCodes)[number];

export type GarminFailure = {
  code: GarminErrorCode | "unknown" | "timeout" | "network" | "malformed";
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  challengeConsumed?: boolean;
};

export type GarminResult<T> =
  { ok: true; value: T } | { ok: false; failure: GarminFailure };

export type GarminConnectFailureState =
  | "invalid_credentials"
  | "rate_limited"
  | "garmin_unavailable"
  | "invalid_mfa"
  | "expired_mfa"
  | "connection_failed"
  | "session_expired";

export type GarminConnectFailure = {
  state: GarminConnectFailureState;
  canRetryCode: boolean;
  retryAfterSeconds?: number;
};

const unavailableCodes = new Set<GarminFailure["code"]>([
  "provider_unavailable",
  "service_unavailable",
  "storage_unavailable",
  "dependency_unavailable",
  "timeout",
  "network",
  "malformed",
]);

export function connectFailure(failure: GarminFailure): GarminConnectFailure {
  const result = (state: GarminConnectFailureState): GarminConnectFailure => ({
    state,
    canRetryCode: false,
  });
  if (failure.code === "unauthorized") return result("session_expired");
  if (failure.code === "invalid_credentials")
    return result("invalid_credentials");
  if (failure.code === "challenge_expired") return result("expired_mfa");
  if (failure.code === "invalid_mfa")
    return {
      state: "invalid_mfa",
      canRetryCode:
        failure.challengeConsumed === false &&
        (failure.attemptsRemaining ?? 0) > 0,
    };
  if (failure.code === "rate_limited")
    return failure.retryAfterSeconds === undefined
      ? result("rate_limited")
      : {
          state: "rate_limited",
          canRetryCode: false,
          retryAfterSeconds: failure.retryAfterSeconds,
        };
  if (unavailableCodes.has(failure.code)) return result("garmin_unavailable");
  return result("connection_failed");
}

export function isUsableConnection(connection: GarminConnection) {
  return connection.status === "connected";
}

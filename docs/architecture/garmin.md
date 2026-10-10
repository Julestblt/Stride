# Garmin integration

Garmin Connect integration is owned by the [garmin_mcp service](https://github.com/Julestblt/garmin_mcp). It owns Garmin authentication, MFA, encrypted provider sessions, synchronization jobs and normalized provider data. Stride consumes its REST API from trusted server code and never reimplements provider logic.

```text
Browser -> Stride Next.js server -> garmin_mcp REST API -> Garmin Connect
                                    garmin_mcp worker   -> normalized rows in Supabase
```

MCP is an interface for AI tools, never the source of truth.

## Trust boundary

- Only `src/server/garmin` calls garmin_mcp. Client components use server actions or Stride route handlers.
- Stride validates the current user with Supabase Auth, then forwards that user's access token as `Authorization: Bearer`. garmin_mcp verifies the token against Supabase Auth and derives the user ID; Stride never sends a user ID.
- `GARMIN_API_URL` is a server-only variable. In deployment it points at the internal Docker network address of the garmin_mcp API service. The browser never receives it, garmin_mcp secrets or a Supabase service-role key.
- Requests carry an `X-Request-Id`, a timeout, and `Cache-Control: no-store` handling. Garmin emails, passwords, OTPs, challenge identifiers and access tokens are never logged.
- Every response is validated with Zod. Unknown or malformed responses become a safe unavailable state.

## Consumer contract

| Operation            | Endpoint                             | Stride use                                            |
| -------------------- | ------------------------------------ | ----------------------------------------------------- |
| Connection status    | `GET /v1/connections/garmin`         | Onboarding guard and shell reconciliation             |
| Start connection     | `POST /v1/connections/garmin/start`  | Credentials submission; optional `history_start_date` |
| Continue MFA         | `POST /v1/connections/garmin/mfa`    | `challenge_id` and `otp`                              |
| Sync status          | `GET /v1/connections/garmin/sync`    | Import step and shell status                          |
| Disconnect           | `DELETE /v1/connections/garmin`      | Settings, outside onboarding                          |
| Delete imported data | `DELETE /v1/connections/garmin/data` | Settings, outside onboarding                          |

Start and MFA return `{ "status": "connected" }` or `{ "status": "mfa_required", "challenge_id": "<uuid>" }`. Errors return `{ "error": { "code": "<code>" } }`. Stride maps codes, never HTTP status alone, because both its own expired session and Garmin credential errors can be `401`.

| garmin_mcp code                                                                                         | Connect Garmin state                                                        |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `invalid_credentials`                                                                                   | `invalid_credentials`: email kept, password cleared                         |
| `rate_limited`                                                                                          | `rate_limited`: pause message; countdown only when retry timing is returned |
| `provider_unavailable`, `service_unavailable`, `storage_unavailable`, `dependency_unavailable`, timeout | `garmin_unavailable`: inputs kept, same request can be retried              |
| `invalid_mfa`                                                                                           | `invalid_mfa`: the challenge is consumed, so the athlete signs in again     |
| `challenge_expired`                                                                                     | `expired_mfa`: sign in again for a new code                                 |
| `connection_changed`, `invalid_request`, unknown                                                        | `connection_failed`: nothing was saved                                      |
| `unauthorized`                                                                                          | Stride session expired: return to sign-in                                   |

The current garmin_mcp contract consumes an MFA challenge on an invalid code and does not return retry timing for rate limits. Stride follows that contract until garmin_mcp ships the investigated improvements.

Sync status reports `categories.activities`, `recovery`, `fitness` and `patterns`, each `pending`, `running`, `partial`, `complete` or `failed`, plus `oldest_synchronized_date`, `last_success_at`, `last_error_code` and, for activities only, a verified `activity_count`. A user without a connection receives `state: "not_started"`. There is no percentage, total or time estimate, and Stride does not derive one.

## Data use

Stride reads normalized garmin_mcp rows (`provider_activities`, `provider_activity_segments`, `provider_observations`, `provider_training_weeks`) under their owner-only RLS policies. It does not call Garmin directly or depend on Garmin response shapes. Profile and biometric values are not imported yet; that capability is tracked in garmin_mcp. The activity detail reads the activity summary and its `lap`/`split` rows only. Route geometry, chart samples and time in zone are not retained by the worker, so Stride shows no map or charts until garmin_mcp imports them as normalized rows.

## Network access

garmin_mcp should be reachable from Stride over the internal Dokploy network only. Its current public HTTPS route requires a Supabase access token but should move to private-network or Tailscale-only access, or another authenticated policy, without breaking existing consumers. That change is a deployment action that requires explicit approval.

## Testing

Unit and browser tests use recorded fixtures and a local fixture server that implements this contract. Live tests run against staging with dedicated Garmin and Supabase test accounts supplied from a secret manager, never in default CI.

## Onboarding foundation

Each enabled onboarding render reads live connection status. Recorded Garmin completion preserves unlocked steps during disconnect, reconnect or provider outage, while Garmin/profile completion requires a new connected response immediately before its constrained server RPC. The authenticated `/api/onboarding/sync` handler forwards only the verified session token, normalizes responses, and disables caching. Category states, activity counts and oldest synchronized dates are displayed directly without percentages or estimates. Browser polling never starts or modifies synchronization jobs.

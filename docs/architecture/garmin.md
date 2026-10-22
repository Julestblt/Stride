# Garmin integration

Garmin Connect integration is owned by the [garmin_mcp service](https://github.com/Julestblt/garmin_mcp). It owns Garmin authentication, MFA, encrypted provider sessions, synchronization jobs and normalized provider data. Stride consumes its REST API from trusted server code and never reimplements provider logic.

```text
Browser -> Stride Next.js server -> garmin_mcp REST API -> Garmin Connect
                                    garmin_mcp worker   -> normalized rows in Supabase
```

MCP is an interface for AI tools, never the source of truth. Coaching agents read Stride data and normalized rows through Stride tools under the athlete's RLS scope. The Coach and Medical may also call an allowlist of read-only garmin_mcp MCP tools for interactive drill-down, with the athlete's own access token; background runs never call MCP, and the validator never uses MCP values ([ADR 0010 amendment](../adr/0010-internal-tools-and-garmin-normalized-data.md#amendment-2026-10-15-130), #130).

## Trust boundary

- Only `src/server/garmin` calls garmin_mcp. Client components use server actions or Stride route handlers.
- Stride validates the current user with Supabase Auth, then forwards that user's access token as `Authorization: Bearer`. garmin_mcp verifies the token against Supabase Auth and derives the user ID; Stride never sends a user ID.
- `GARMIN_API_URL` is a server-only variable. In deployment it points at the internal Docker network address of the garmin_mcp API service. The browser never receives it, garmin_mcp secrets or a Supabase service-role key.
- Requests carry an `X-Request-Id`, a timeout, and `Cache-Control: no-store` handling. Garmin emails, passwords, OTPs, challenge identifiers and access tokens are never logged.
- Every response is validated with Zod. Unknown or malformed responses become a safe unavailable state.

## Consumer contract

| Operation            | Endpoint                                          | Stride use                                            |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Connection status    | `GET /v1/connections/garmin`                      | Onboarding guard and shell reconciliation             |
| Start connection     | `POST /v1/connections/garmin/start`               | Credentials submission; optional `history_start_date` |
| Continue MFA         | `POST /v1/connections/garmin/mfa`                 | `challenge_id` and `otp`                              |
| Sync status          | `GET /v1/connections/garmin/sync`                 | Import step and shell status                          |
| Disconnect           | `DELETE /v1/connections/garmin`                   | Settings, outside onboarding                          |
| Delete imported data | `DELETE /v1/connections/garmin/data`              | Settings, outside onboarding                          |
| Wellness day         | `GET /v1/wellness/days/{date}`                    | Santé day view; intraday curves fetched on demand     |
| Push workouts        | `PUT /v1/connections/garmin/workouts`             | Watch sending: reconcile a date window (#190)         |
| Remove workouts      | `DELETE /v1/connections/garmin/workouts`          | Watch sending turned off                              |
| Create shoe          | `POST /v1/connections/garmin/gear`                | Matériel: add a pair (E-08)                           |
| Update shoe          | `PATCH /v1/connections/garmin/gear/{uuid}`        | Wear limit, default activity, retire (E-08)           |
| Set activity shoe    | `PUT /v1/connections/garmin/activities/{id}/gear` | Activity check and corrections (E-08)                 |

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

Stride reads normalized garmin_mcp rows (`provider_activities`, `provider_activity_segments`, `provider_activity_tracks`, `provider_observations`, `provider_training_weeks`, `provider_gear`, `provider_activity_gear`) under their owner-only RLS policies. It does not call Garmin directly or depend on Garmin response shapes. Profile and biometric values are not imported yet; that capability is tracked in garmin_mcp. The selected preview and full detail read the activity summary, its `lap`/`split` rows and an optional compact track. Activity names, calories and Garmin perceived effort come from normalized summary columns. Track parsing validates GPS coordinates and aligned series before pure domain functions derive chart geometry, route coloring and time in zones from the full-resolution heart-rate histogram. Running pace is only shown for running activities; samples without GPS still support charts.

The map uses MapLibre GL with CARTO's dark basemap and OpenStreetMap attribution. Its worker is bundled locally. Tile/style requests come from the browser and disclose the viewed area to the tile provider; no Garmin credentials or Supabase secrets are sent. If tiles or WebGL are unavailable, a local SVG preserves the actual route. Elevation and route hover share the same distance position.

Zone boundaries use the existing Stride calculation: the maximum heart rate observed over the last year, with the median resting heart rate from the last 28 days when there are at least seven observations (Karvonen), otherwise percentages of maximum heart rate. The UI identifies these as Stride estimates, not imported Garmin zone settings. Missing calibration omits zone assignments. The activity detail uses French UI copy. Gray chart bands identify laps lasting at least one minute whose pace is at least 8% faster than the activity average; they are labeled Stride estimates, not prescribed intervals. The pale horizontal heart-rate band marks estimated Z4. The pace/heart-rate scatter pairs samples and includes a French explanation of both axes. Missing tracks omit unavailable plots; coach analyses, prescribed targets and compliance are not fabricated from the design reference.

The four time-series charts support inspecting recorded samples with a pointer, touch, or keyboard arrows (Home/End select the endpoints; Escape or blur dismisses the annotation). Each inspection shows the recorded measurement with its unit and elapsed time. Missing measurements remain explicitly unavailable; incomplete or invalid time series use sample positions without invented timestamps. Pace domains may be visually trimmed, while annotations preserve the actual recorded values. Effort statistics share the detail’s import provenance rather than repeating Garmin on every row.

## Watch sending

Sending planned sessions to the watch and gear writes ([ADR 0013](../adr/0013-garmin-counted-shoe-mileage.md)) are the only Garmin writes. The athlete triggers watch sending (#190); gear writes come from the athlete or the activity check of their own data. The Coach and the MCP tools never write to Garmin. `athlete_profiles.watch_workouts_enabled` holds the setting. garmin_mcp records each pushed workout in `provider_workouts`, which Stride reads under owner RLS for the session, week and settings states. The garmin_mcp contract is documented in its `docs/workouts.md`.

The activity check covers runs matched to a planned session in the last 14 days. When Garmin linked no pair, Stride writes the session's pair to Garmin once, after the page response, and records it in `activity_shoe_decisions`; a refused write is recorded too and never retried. When Garmin's pair differs from the session's, the athlete answers on Today, Matériel or the activity. On Today the latest run asks one question at a time: the post-session feeling first when neither the watch nor the athlete recorded one (stored in `activity_feelings`; Garmin `workout_rpe`/`workout_feel` always win), then the pair question once a feeling exists. Keeping Garmin's pair writes nothing; choosing another pair writes it to Garmin and records it as a correction, so later syncs read the corrected link.

- `src/features/garmin/watch.ts` builds the request: the run and trail sessions with a structure in the next 7 days, the sessions already pushed further ahead (up to 31 days), and a session the athlete sends ahead of time. Keys are `<plan id>:<session key>`, so recorded workouts that left the active plan are removed.
- The athlete confirms a session with effort (RPE) steps once (`allow_simplified`), because the watch receives them without a target. That consent stays with the session for later resends and retries; a new hold appears only for a session that was never confirmed.
- A sync runs when sending is turned on, when the athlete sends, resends, retries or confirms a session, after an accepted proposal is applied, and after Today, Plan or the Garmin settings page renders. On those page loads it runs only if the plan version or the local day changed since the last sync, at most every 10 minutes after a failure, and hourly while a push has failed. garmin_mcp accepts only the athlete's access token, so the window rolls forward when the athlete opens Stride, not on a server schedule.
- Turning sending off calls `DELETE`; disconnecting in garmin_mcp removes the upcoming workouts too.

## Network access

garmin_mcp should be reachable from Stride over the internal Dokploy network only. Its current public HTTPS route requires a Supabase access token but should move to private-network or Tailscale-only access, or another authenticated policy, without breaking existing consumers. That change is a deployment action that requires explicit approval.

## Testing

Unit and browser tests use recorded fixtures and a local fixture server that implements this contract. Live tests run against staging with dedicated Garmin and Supabase test accounts supplied from a secret manager, never in default CI.

## Onboarding foundation

Each enabled onboarding render reads live connection status. Recorded Garmin completion preserves unlocked steps during disconnect, reconnect or provider outage, while Garmin/profile completion requires a new connected response immediately before its constrained server RPC. The authenticated `/api/onboarding/sync` handler forwards only the verified session token, normalizes responses, and disables caching. Category states, activity counts and oldest synchronized dates are displayed directly without percentages or estimates. Browser polling never starts or modifies synchronization jobs.

The activities list applies owner-scoped type and literal, case-insensitive `activity_name` filters before count and pagination. Search input is trimmed and limited to 160 characters. ILIKE patterns escape percent, underscore and backslash; names containing an asterisk use a directly supplied escaped `imatch` pattern because PostgREST rewrites stars in ILIKE patterns into percent wildcards. No raw OR expression is constructed. Only the selected session loads detail, segments and optional track; default desktop selection uses the newest filtered result. List, preview and full-detail links retain search, type and loaded-window context. The preview reuses the same route map, profile, color controls and chart inspection as full detail, limiting charts to pace and heart rate. Its effort summary contains recorded facts; the references’ coach advice, plan targets, compliance and race classification have no normalized source and remain omitted.

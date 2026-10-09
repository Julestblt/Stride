# Onboarding architecture

Onboarding is a resumable state machine persisted in Supabase. React state and browser storage improve responsiveness but never hold the only copy of progress. Garmin connection and synchronization state is owned by garmin_mcp and read from its API; Stride does not copy it into onboarding tables.

## Ownership

| Owner         | Data                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| Supabase Auth | Identity and sessions                                                                        |
| Stride        | Onboarding progress, athlete profile, training preferences, goals, races, value provenance   |
| garmin_mcp    | Garmin authentication, MFA challenges, encrypted provider sessions, sync jobs, imported data |
| Browser       | Form presentation, unsaved local edits, transient MFA challenge identifier for one attempt   |

## Steps and routes

| Step      | Route                 | Completion rule                                                | Prerequisite       |
| --------- | --------------------- | -------------------------------------------------------------- | ------------------ |
| `welcome` | `/onboarding/welcome` | Athlete continues                                              | None               |
| `garmin`  | `/onboarding/garmin`  | garmin_mcp reports the connection as `connected`               | `welcome`          |
| `history` | `/onboarding/history` | Athlete continues; import completion is not required           | `garmin`           |
| `about`   | `/onboarding/about`   | Required profile fields persisted and valid                    | `garmin`           |
| `goals`   | `/onboarding/goals`   | Goal focus persisted; every saved race valid; no race is valid | `about`            |
| `profile` | `/onboarding/profile` | Athlete confirms the reviewed profile                          | `goals`, `history` |

Onboarding is complete when every step is complete and garmin_mcp confirms a usable connection at completion time. Completed athletes entering `/onboarding/*` are sent to the application destination, which is `/` until the application shell exists. Incomplete athletes entering `/` are sent to their resume step. Signed-out visitors are sent to `/sign-in`.

The rules live in a framework-independent domain module that takes persisted progress plus the reconciled Garmin status and returns, for a requested step, either `allow` or a redirect target. Server layouts and server actions call it; the browser never decides access.

- The resume step is the persisted `current_step` when it is allowed, otherwise the first incomplete allowed step.
- Opening an allowed URL renders it without changing progress, so refreshing never advances or resets the flow.
- Completed steps remain reachable and editable. Editing a completed step keeps it complete only while its data remains valid; a server-side validation failure reopens it.
- `current_step` changes only through explicit actions: Continue, Back and sidebar navigation.

## Garmin reconciliation

On every onboarding request the server reads `GET /v1/connections/garmin` with the athlete's access token. `garmin_completed_at` records when Stride first observed a connected account; it is progress history, not connection state.

- `connected` satisfies the Garmin prerequisite.
- `reconnect_required`, `expired` or `disconnected` after the step was completed keeps later steps editable, shows the reconnect state in the shell, and blocks final completion until reconnected.
- If garmin_mcp is unavailable, steps already unlocked by recorded progress stay usable with an unavailable notice; actions that need a live Garmin answer, including final completion, wait for it.

Synchronization status comes from `GET /v1/connections/garmin/sync` through a Stride route handler that the browser polls while any category is `pending`, `running` or `partial`, with backoff when unchanged or failing. Navigation never starts, pauses or restarts synchronization; the garmin_mcp worker runs independently.

## Persistence model

Stride-owned tables live in `public`, keyed by `auth.users.id`, with RLS restricted to the owner. See [data platform](database.md) for migrations and environments.

- `onboarding_progress`: one row per athlete with `current_step`, a nullable completion timestamp per step, `completed_at`, `revision`, `created_at`, `updated_at`.
- `athlete_profiles`: one row per athlete with first name, birth date, sex for physiological estimates, height, weight, primary terrain, available weekdays, long-run day, weekday session duration, training access, `value_sources`, `revision` and timestamps.
- `athlete_goals`: one row per athlete with the goal focus, `revision` and timestamps.
- `athlete_races`: zero or more races per athlete with name, date, distance, elevation gain, priority A/B/C, optional target duration, `revision` and timestamps.

`value_sources` maps a profile field to its source (`athlete` or `garmin`) and, for Garmin, the observation date. A Garmin value is suggested only when the field is empty or still Garmin-sourced. Once the athlete edits a field its source becomes `athlete` and later Garmin values never replace it; the interface shows both the athlete value and the newer Garmin observation when they differ.

A database trigger increments `revision` and sets `updated_at` on every update. Updates are conditional on the client's expected revision.

## Save strategy

Server actions validate every write with Zod and write with the athlete's session under RLS. No service-role key is used.

- Text and numeric inputs save after about 800 ms without typing and on blur. Choice controls save on change. Continue first flushes pending saves, then calls a completion action.
- Saves send only changed fields with the expected revision. The response returns the persisted values and new revision.
- Each request carries a client sequence number; a response older than the latest applied response is ignored, so a slow request cannot overwrite newer edits.
- Fields edited while a save is in flight stay dirty and are not replaced by that response.
- On a revision conflict the client reloads the server snapshot. Untouched fields take server values. Dirty fields whose server value has not changed since the client's base are resent. Dirty fields changed on another device are shown as a conflict for the athlete to choose; nothing is silently overwritten.
- Failed saves keep the local value, show an error with retry, and retry automatically with bounded backoff. Leaving the page with unsaved or failed edits asks for confirmation.
- While offline, edits for non-sensitive profile, goal and race fields are cached in `localStorage` under the athlete's ID, sent when the connection returns, and discarded once persisted or when older than the server's `updated_at`. Sign-out clears them.
- The completion action validates the persisted rows, not the client payload, so a step cannot be marked complete before its data is saved.

Forms show `unsaved`, `saving`, `saved`, `offline` and `error` states near the Continue action, using existing Stride patterns.

## Garmin step security

Garmin email and password are posted from the browser to a Stride server action, forwarded once to garmin_mcp, and never stored, logged or returned. The password field is cleared after an invalid-credentials response. The MFA challenge identifier is held only in component memory for the active attempt and is never written to Supabase, cookies or browser storage; refreshing during MFA returns to the start of the Garmin step, as in the approved state model. OTP codes are never stored. Garmin codes and messages are mapped to approved French copy; raw provider messages are not shown.

## Testing

- Unit: progression rules, resume-step resolution, Garmin error mapping, sync status mapping, save queue sequencing and conflict handling.
- Database: RLS tests on the local Supabase stack prove an athlete cannot read, insert, update or delete another athlete's rows, and anonymous access is denied.
- Browser: refresh on each step, sign-out and sign-in, a second browser context as another device, Back navigation and editing, direct navigation to a later URL, save failure and retry, offline recovery, and continued synchronization while navigating. Garmin responses come from a local fixture server; live Garmin runs only in staging.

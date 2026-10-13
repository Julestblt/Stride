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

| Step      | Route                 | Completion rule                                                                      | Prerequisite       |
| --------- | --------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| `welcome` | `/onboarding/welcome` | Athlete continues                                                                    | None               |
| `garmin`  | `/onboarding/garmin`  | garmin_mcp reports the connection as `connected`                                     | `welcome`          |
| `history` | `/onboarding/history` | Athlete continues; import completion is not required                                 | `garmin`           |
| `about`   | `/onboarding/about`   | Required profile fields persisted and valid                                          | `garmin`           |
| `goals`   | `/onboarding/goals`   | Goal focus persisted; zero or more races may be saved, and every saved race is valid | `about`            |
| `profile` | `/onboarding/profile` | Athlete confirms the reviewed profile                                                | `goals`, `history` |

Onboarding is complete when every step is complete and garmin_mcp confirms a usable connection at completion time. Completed athletes entering `/onboarding/*` are sent to the application destination, which is `/` until the application shell exists. Incomplete athletes entering `/` are sent to their resume step. Signed-out visitors are sent to `/sign-in`.

The rules live in a framework-independent domain module that takes persisted progress plus the reconciled Garmin status and returns, for a requested step, either `allow` or a redirect target. Server layouts and server actions call it; the browser never decides access.

- The resume step is the persisted `current_step` when it is allowed, otherwise the first incomplete allowed step.
- Opening an allowed URL renders it without changing progress, so refreshing never advances or resets the flow.
- Completed steps remain reachable and editable. A completed step stays complete; saves to it must keep its required fields valid, so an invalid edit is rejected rather than reopening the step.
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

The athlete's role can write only permitted data columns. Progress insertion supplies only `user_id`; navigation updates `current_step` exclusively through the guarded `set_onboarding_current_step` RPC. Step completion goes through the `complete_onboarding_step` database function, which checks the expected revision, the step's prerequisites and its persisted data in one transaction, then records the first completion time and advances `current_step`. Following issue #42, authenticated sessions execute `complete_onboarding_step` for `welcome`, `history`, `about` and `goals`, with persisted-data and prerequisite validation. They cannot execute `complete_onboarding_step_server`. Only the server completion integration may invoke that constrained RPC for `garmin` or `profile`, using the verified athlete identity and a fresh connected Garmin response. The credential is server-only, and absence fails closed. Completing the profile step completes onboarding. PostgreSQL cannot independently verify the live Garmin connection, so the Garmin step's completion is recorded by the Stride server only after garmin_mcp reports a connected account, and final completion is also checked against live Garmin status before the server invokes the function.

## Save strategy

Server actions validate every write with Zod. Ordinary data saves, progression reads, navigation and ordinary step completion use the athlete's session under RLS. The only credential exception is the constrained Garmin/profile completion RPC described above.

- Text and numeric inputs save after about 800 ms without typing and on blur. Choice controls save on change. Continue first flushes pending saves, then calls a completion action.
- Saves send only changed fields with the expected revision. The response returns the persisted values and new revision.
- Each request carries a client sequence number; a response older than the latest applied response is ignored, so a slow request cannot overwrite newer edits.
- Fields edited while a save is in flight stay dirty and are not replaced by that response.
- On a revision conflict the client reloads the server snapshot. Untouched fields take server values. Dirty fields whose server value has not changed since the client's base are resent. Dirty fields changed on another device are shown as a conflict for the athlete to choose; nothing is silently overwritten.
- Failed saves keep the local value, show an error with retry, and retry automatically with bounded backoff. Leaving the page with unsaved or failed edits asks for confirmation.
- While offline, edits for non-sensitive profile, goal and race fields are cached in `localStorage` under the athlete's ID, sent when the connection returns, and discarded once persisted or when older than the server's `updated_at`. Sign-out clears them.
- Completion validates the persisted rows in the database, not the client payload, so a step cannot be marked complete before its data is saved, even through direct Data API calls.

Forms show `unsaved`, `saving`, `saved`, `offline` and `error` states near the Continue action, using existing Stride patterns.

About you (#36) implements this strategy. `src/features/onboarding/autosave.ts` is the framework-independent queue: it tracks dirty fields, sends one request at a time with the expected revision and a sequence number, ignores responses that are not the current request, keeps fields edited during a save, resends fields whose server value did not change after a revision conflict, and surfaces fields changed on both devices for the athlete to keep or replace. `useAutosave` adds the 800 ms debounce, immediate saves for choice controls, flushing before Continue, bounded automatic retries, the `beforeunload` guard and the offline cache of training-preference fields under `stride:onboarding:about:<user id>`, cleared on sign-out. The `saveAthleteProfile` action validates partial values with Zod, reads the row, writes only if the revision still matches (insert on first save, conditional update afterwards) and merges `value_sources`; completion still relies on `complete_onboarding_step` checking the persisted row. Goals (#37) reuse the same queue: the goal focus and each race have their own revision and autosave instance (`saveAthleteGoal`, `saveAthleteRace`), races are added and removed with `addAthleteRace` and `removeAthleteRaces` (at most ten), and a race deleted on another device disappears instead of being recreated. The athlete profile (#38) is built by `buildAthleteProfile` from the athlete's answers and normalized Garmin rows read under RLS (activities, recovery observations, VO₂ max and observed maximum heart rate); every value carries its source and window, missing values are shown as missing, and completion goes through the existing guarded Garmin/profile completion.

## Garmin step security

Garmin email and password are posted from the browser to a Stride server action, forwarded once to garmin_mcp, and never stored, logged or returned. The password field is cleared after an invalid-credentials response. The MFA challenge identifier is held only in component memory for the active attempt and is never written to Supabase, cookies or browser storage; refreshing during MFA returns to the start of the Garmin step, as in the approved state model. OTP codes are never stored. Garmin codes and messages are mapped to approved French copy; raw provider messages are not shown.

The `startGarminConnection` and `verifyGarminCode` server actions validate credentials and six-digit codes with Zod, require a verified session and an unlocked Garmin step, and return only `connected`, `mfa_required` with the challenge identifier, or an approved failure state. The browser maps those states with the framework-independent `garmin-flow` policy: invalid credentials clear the password and keep the email, Garmin outages keep every input, and rejected or expired codes return to sign-in because garmin_mcp consumes the challenge. The Garmin step is recorded only when the athlete continues from the connected screen. At that point the completion action reads a fresh `connected` status before invoking the constrained server RPC. Athletes who are already connected open directly on the connected screen.

## Testing

- Unit: progression rules, resume-step resolution, Garmin error mapping, sync status mapping, save queue sequencing and conflict handling.
- Database: RLS tests on the local Supabase stack prove an athlete cannot read, insert, update or delete another athlete's rows, and anonymous access is denied.
- Browser: refresh on each step, sign-out and sign-in, a second browser context as another device, Back navigation and editing, direct navigation to a later URL, save failure and retry, offline recovery, and continued synchronization while navigating. Garmin responses come from a local fixture server; live Garmin runs only in staging.

### Issue #39 coverage and delivery evidence

The CI-only `tests/e2e/onboarding.spec.ts` suite uses disposable local Supabase athletes and a fixture Garmin service. Application and persisted-state assertions use the athlete session under RLS; administrative access only creates and cleans up accounts and supplies setup data in existing focused scenarios.

| Acceptance                              | Automated evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All six screens without seeded progress | Unseeded journey connects Garmin through the UI, completes every screen and verifies completion timestamps and persisted profile/race answers.                                                                                                                                                                                                                                                                                                                                     |
| Refresh and independent device          | The journey refreshes every screen without changing progress, opens a context with empty cookies, signs in independently and restores partial About answers before continuing.                                                                                                                                                                                                                                                                                                     |
| Back edits and URL prerequisites        | The journey requests Profile from Welcome, edits completed Goals and About using Back, and checks original completion timestamps survive. Existing route scenarios cover other locked and unknown routes.                                                                                                                                                                                                                                                                          |
| Real sign-out and sign-in               | The journey uses the existing completed-application sign-out button, verifies the protected route redirects and sync returns 401, then signs in and checks durable answers and completion. A test-only replay of the emitted sign-out action under a separate interrupted athlete session verifies actual partial-session termination and restored Garmin progress, without adding production UI. Cookie removal in the older isolation scenario is only loss-of-session evidence. |
| Failed save and retry                   | The focused About scenario aborts autosave POSTs, retains input, shows failure and retries; it also exercises a slow save followed by a newer edit.                                                                                                                                                                                                                                                                                                                                |
| Offline and reconnect                   | Browser network controls genuinely disconnect About preferences, verify the row remains unchanged and only supported pending preferences are cached, then reconnect and verify automatic persistence and cache removal.                                                                                                                                                                                                                                                            |
| Import through navigation               | A per-athlete fixture-only sync control keeps the unseeded journey running; session-scoped sync observations show increasing activity counts after device continuation and Back edits, with the shell still presenting import activity. Default fixture timing remains unchanged.                                                                                                                                                                                                  |
| Cross-athlete protection                | A second authenticated athlete supplies foreign identity/token parameters to application routes and sync and sees only its own state. Replaying an owner race-save action under the second session returns missing and leaves the owner row untouched. Direct session-scoped REST clients attempt reads, updates, deletes and inserts on progress, profile, goal and race tables; owner snapshots remain unchanged.                                                                |

The persistence suite executes only in the existing isolated CI job through `npm run test:e2e:onboarding`; it must never start local Supabase on the homelab or create hosted test athletes. Review the CI result and retained Playwright traces before accepting browser evidence. Other repository checks do not substitute for this job.

### Approval-gated real Garmin staging procedure

Real-Garmin verification remains pending until issue #31 supplies approved staging and explicit authorization to use a staging athlete and real Garmin credentials. Do not provision staging or create hosted test athletes as part of the automated suite. Production activation remains dependent on #31.

1. Record the staging deployment revision, approved environment, browser/device and verification date in issue #39 or its PR. Use credentials privately; never include passwords, OTPs, provider tokens or challenge identifiers in evidence.
2. With the approved athlete, start from Welcome, connect real Garmin (including MFA if requested), and confirm the import categories/counts reflect actual provider responses. Record supported observations without inventing completion estimates.
3. Enter partial About answers, refresh, interrupt the session through the approved sign-out procedure, sign in and continue on a second independently authenticated device. Confirm the same answers and completed steps return.
4. Complete About and Goals with a valid race, refresh each screen, navigate Back and edit completed answers. Confirm earlier completion is preserved and direct later URLs remain guarded for an approved incomplete session.
5. Disconnect the browser network while changing a supported training preference; confirm pending input remains, reconnect and verify persistence. Exercise a controlled failed save and retry if the staging environment supports safe fault injection.
6. Observe ongoing real import before and after navigation. Review provenance and missing-data disclosures, finish the profile review and confirm the application destination survives refresh and sign-out/sign-in.
7. If a second approved staging athlete is available, verify it cannot access the first athlete's records through normal routes and session-scoped API requests. Do not introduce another hosted athlete without approval.
8. Attach sanitized screenshots, expected/observed outcomes, failures and issue links. Mark every unexecuted scenario pending; a fixture pass is not a live Garmin pass.

## Foundation rollout

The server-only `ONBOARDING_ENABLED` switch defaults to false. Until the six screen issues #33–#38 are ready, onboarding routes return 404, actions are disabled, the sync endpoint returns 404, and the existing landing/auth behavior remains available. Enabling the switch makes `/` resume incomplete authenticated athletes; signed-out visitors retain the public landing. The shared shell supplies a content slot for each screen body and follows the state model: the framework-independent `shell-status` policy derives each step's sidebar line, the remaining time, the Garmin connection phase reported by the Garmin screen, the background import mark and the "Garmin connecté" badge. Before Garmin is connected, the sidebar shows the verified account email. Afterwards it shows an "Import depuis Garmin" card with the real phase, activity count and current year. Only reconnect and unavailable notices appear above the step content. Each screen issue adds its own body and completion controls; Welcome (#33) completes through the ordinary completion action and moves on only after the save succeeds.

`src/features/onboarding` owns pure progression and polling policies; `src/server/onboarding` verifies each request with `getUser`, obtains the verified session token, parses persisted progress with Zod and owns server actions. First entry inserts only the verified user ID and accepts a concurrent duplicate insert. GET requests never alter an existing row. Back and sidebar actions use `set_onboarding_current_step` and expected revisions. Conflicts return a fresh snapshot for reload.

`GET /api/onboarding/sync` accepts no athlete identity or provider token from the caller. It uses the verified session and returns normalized category observations with `Cache-Control: private, no-store`. Each step seeds the shared provider from a server-side Garmin sync read and the athlete-scoped earliest activity date, so the first HTML and hydration reflect the actual import state. Navigation does not replace a completed import with a synthetic starting state. The polling effect retains its latest observation across restarts. One shared provider polls active imports for the whole shell and step bodies. It backs off from 2 to 30 seconds on unchanged or failed reads, pauses while hidden, aborts on unmount and preserves the last observation marked unavailable. A Stride session failure requires sign-in; provider failures leave recorded unlocked steps editable.

## Athlete profile review calculations

The sixteen Monday-based weekly buckets, typical week and active-week count use only running, trail, treadmill, track and ultra sessions. Future activities are excluded and missing duration adds no time. The header retains its separate all-sport activity total.

`heart-rate-zones.ts` computes five Stride display estimates with 50/60/70/80/90/100 percent boundaries and contiguous rounded integer intervals. Karvonen uses the median of at least seven finite, positive normalized `resting_heart_rate_bpm` observations below the observed maximum, over the latest 28 calendar days. Otherwise zones use percentages of the observed maximum. Missing or invalid maximum means unavailable zones; there is no age fallback. The profile discloses the method, inputs, resting observation window and sample count. An observed activity maximum is not a measured physiological maximum, and these are neither Garmin-configured zones nor training prescriptions.

The habits card reuses the import insights endpoint and shows only volume and mix. It explicitly describes all-sport training over twelve months, separate from the running summary. Server-computed facts remain available if the endpoint fails; empty results show an unavailable message. Client reads time out after 25 seconds and never prevent correction or completion.

## Profile settings overrides and photos

Settings save biometrics, running maximum and optional threshold/source in one owner-scoped, revision-filtered profile update. Onboarding's required fields are unchanged. Provider provenance survives unchanged drafts; edited fields become athlete-owned. The common `src/server/heart-rate/maximum.ts` integration reads normalized Garmin running types from the latest 365 days, excludes future activities and prioritizes a persisted manual maximum for onboarding and activity zones. Threshold overrides are stored separately and do not change the existing maximum/resting zone model.

Profile photos are optional JPEG, PNG or WebP files up to 2 MiB. Server-side validation checks the file signature and decodes the complete image with a 20-million-pixel limit before uploading through the authenticated Supabase client. Immutable UUID paths are scoped to the athlete's folder in the private `profile-images` bucket; owner policies control read, insert and delete. The profile update stores the path, while rendering uses a one-hour signed URL or initials fallback. Failed profile saves remove the newly uploaded object. Storage must be enabled and its service/schema provisioned before deploying the additive photo migration; repository configuration enables future local starts, but this work does not restart deployed services. Sharp is an explicit runtime dependency because complete image decoding is required at the upload trust boundary.

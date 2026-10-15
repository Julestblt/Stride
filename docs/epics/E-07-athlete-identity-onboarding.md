# E-07: Athlete identity and first-run onboarding

## Objective

Take an authenticated athlete from account creation to a reviewed first athlete profile through a persistent, resumable onboarding flow that connects their Garmin account and lets historical data import in the background.

## Scope

- Supabase Auth identity, sessions and authenticated route handling (delivered before this epic's onboarding slices).
- Durable onboarding progress, athlete profile, training preferences, goals and races owned by Stride in Supabase with row-level security.
- A six-step flow following the `Onboarding` artboards of the [design board](../design/design-board.md): Welcome, Connect Garmin, Import history, About you, Goals, Athlete profile.
- Garmin connection, MFA and historical import status through the garmin_mcp REST API behind the Stride server.
- Profile values that show their source and let the athlete override Garmin suggestions without later silent overwrites.

## Decisions

- Garmin is required to complete MVP onboarding. Full historical synchronization is not required to advance through the steps or to finish.
- Onboarding state is persisted in Supabase and restored after refresh, sign-out and sign-in, browser restart, network loss or on another device. Browser state is a cache only.
- garmin_mcp owns Garmin authentication, MFA, encrypted provider sessions and synchronization jobs. Stride never stores Garmin credentials, codes, tokens or challenge secrets.
- Onboarding UI copy is French, matching the approved references.
- Import status shows only real synchronization data: no percentages, estimates, inferred totals or generated insights.

See [onboarding architecture](../architecture/onboarding.md), [Garmin integration](../architecture/garmin.md), [data platform](../architecture/database.md), [ADR 0005](../adr/0005-shared-supabase-schema-ownership.md) and [the foundation spec](../specs/spec-onboarding-foundation/spec-onboarding-foundation.md).

## Delivery slices and dependencies

| Slice | Capability                                                                            | Depends on    |
| ----- | ------------------------------------------------------------------------------------- | ------------- |
| S0    | Planning artifacts: this epic, PRD, architecture, ADR, spec                           | None          |
| S1    | Garmin REST consumer contract and server-only client                                  | S0            |
| S2    | Supabase CLI, local stack, Stride migrations, RLS and isolation tests                 | S0            |
| S3    | Onboarding state machine, route guards, restoration and shared onboarding shell       | S1, S2        |
| S4    | Welcome                                                                               | S3            |
| S5    | Connect Garmin, including MFA and error states                                        | S3            |
| S6    | Import history status                                                                 | S5            |
| S7    | Autosave form foundation and About you                                                | S3            |
| S8    | Goals and races                                                                       | S7            |
| S9    | Athlete profile review and onboarding completion                                      | S6, S8        |
| S10   | End-to-end persistence and resume validation                                          | S4 to S9      |
| P1    | Platform: staging Supabase project, Stride deployment, internal Garmin network access | S0, approvals |
| G1    | garmin_mcp: deployment alignment, worker job verification, image revision metadata    | None          |
| G2    | garmin_mcp: structured rate-limit response with retry timing where supported          | None          |
| G3    | garmin_mcp: MFA retry behavior and challenge lifecycle investigation                  | None          |
| G4    | garmin_mcp: athlete profile and biometric import investigation and contract           | None          |
| G5    | garmin_mcp: authenticated or private-network access policy for the public endpoint    | None          |

S1 and S2 can run in parallel. After S3, S4, S5 and S7 can run in parallel; S6 follows S5 and S8 follows S7. garmin_mcp slices run independently; S5 handles the current contract and adopts G2 and G3 when they ship. S9 shows Garmin profile values only when G4 provides them. Live Garmin validation requires G1 and P1.

## Deferred capabilities

Garmin race-calendar lookup, GPX course upload, performance predictions (threshold pace, climbing speed, race-time estimates, heart-rate zones derived by Stride) and generated import insights are future capabilities. Their mockup areas are omitted or shown as unavailable rather than simulated.

## Expected user value

An athlete can connect Garmin, keep going while their history imports, stop at any point, and later continue from any device without re-entering information.

## Major risks

- Cross-athlete data exposure through missing or incorrect RLS.
- Lost edits from failed saves, stale responses or concurrent devices.
- Presenting mocked or estimated Garmin progress as real.
- Garmin MFA behavior that depends on private client fields in garmin_mcp.
- Accidental changes to a shared Supabase project whose environment role is not confirmed.

## Completion criteria

- Each step restores its saved values and the correct resume step after refresh, sign-out and sign-in, and on a second browser context.
- Prerequisites are enforced on the server; a later URL cannot bypass them, and completed steps remain editable.
- A step is never marked complete before its required data has persisted.
- Automated tests prove one athlete cannot read or write another athlete's onboarding data.
- Garmin connection, MFA and import states are driven by the garmin_mcp API, and import continues while the athlete navigates.
- Screens match their approved references at desktop and mobile viewports, with documented adaptations only.

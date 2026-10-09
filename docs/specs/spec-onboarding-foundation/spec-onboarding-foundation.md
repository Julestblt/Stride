---
id: SPEC-onboarding-foundation
companions:
  - design-adaptations.md
  - ../../architecture/onboarding.md
  - ../../architecture/garmin.md
  - ../../architecture/database.md
  - ../../adr/0005-shared-supabase-schema-ownership.md
sources:
  - ../../epics/E-07-athlete-identity-onboarding.md
  - ../../product/prd.md
---

# Persistent Garmin-first onboarding foundation

## Why

Stride's first useful moment depends on an athlete connecting Garmin and describing what Garmin does not know. Onboarding that loses answers on refresh, sign-out or a device switch, or that fakes import progress, breaks trust before coaching starts. The product owner requires Garmin to finish onboarding, a real garmin_mcp integration from the start, and a flow that persists everything in Supabase so it can always resume.

## Capabilities

- **CAP-1**
  - **intent:** The athlete's onboarding progress persists per user with the current step, each step's completion and overall completion.
  - **success:** After refresh, sign-out and sign-in, or opening a second browser context, the athlete lands on the same resume step with the same completed steps.
- **CAP-2**
  - **intent:** Server-side progression rules restore the correct step and enforce prerequisites while keeping completed steps editable.
  - **success:** Requesting a later step URL without its prerequisites redirects to the first allowed step; refreshing an allowed step neither advances nor resets progress; unit tests cover every step transition.
- **CAP-3**
  - **intent:** Profile, preferences, goals and races save progressively with visible save state, failure recovery and conflict protection.
  - **success:** Values typed on one step are restored after refresh and on another device; a forced save failure keeps the input, shows an error and succeeds on retry; a stale response or a concurrent device edit never silently overwrites newer input.
- **CAP-4**
  - **intent:** The athlete connects Garmin, including MFA, through the Stride server and the garmin_mcp REST API using the approved state model.
  - **success:** Every garmin_mcp result and error code maps to an approved state; no Garmin password, OTP, token or challenge identifier reaches Supabase, browser storage or logs.
- **CAP-5**
  - **intent:** Historical import status is read from garmin_mcp and restored independently of onboarding navigation.
  - **success:** The import step and shell show real category states, the oldest synchronized date and the verified activity count, and the count keeps rising while the athlete completes later steps.
- **CAP-6**
  - **intent:** The athlete reviews a profile built from their answers and real Garmin values with visible provenance, then completes onboarding.
  - **success:** Completion is refused until every step is complete and Garmin is connected, then the athlete reaches the application destination and is not sent back to onboarding.

## Constraints

- Supabase is the durable source of truth; React state, context and browser storage are caches only.
- A step is never marked complete before its required data has persisted; completion validates persisted rows.
- Stride-owned tables use owner-only RLS; Stride uses the athlete's session, never a service-role key.
- Garmin authentication, MFA, sessions and synchronization stay in garmin_mcp; Stride never duplicates that state or logic.
- `GARMIN_API_URL` is server-only; the browser talks only to Stride.
- Import status presents only real data: no percentages, totals, time estimates or insights.
- Athlete-edited values are never replaced by Garmin values.
- Onboarding copy is French; code and technical documents are English.
- Reuse Stride design-system components; adapt a mockup only where the real API cannot support it, as recorded in design-adaptations.md.
- Hosted Supabase changes, secrets and deployment changes require explicit approval.

## Non-goals

- Garmin race-calendar lookup, GPX upload, performance predictions and generated insights.
- Disconnect, reconnect and data deletion screens in settings.
- The post-onboarding application shell beyond redirecting to `/`.
- Training plan generation.

## Success signal

A browser test connects a fixture Garmin account, enters About you, refreshes, signs out and in, continues in a second browser context, completes Goals and the profile review, and finds every saved value restored while the fixture import count keeps increasing; a second athlete cannot read any of that data.

## Assumptions

- `/` remains the post-onboarding destination until the application shell exists.
- The garmin_mcp API keeps its current response and error-code contract until its improvement issues ship.

## Open Questions

- Which Garmin profile and biometric fields are reliably available (garmin_mcp investigation)?
- Can a Garmin MFA challenge be retried after an invalid code (garmin_mcp investigation)?
- Is the current Supabase project production or staging?

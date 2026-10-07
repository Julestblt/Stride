# E-07: Athlete identity and first-run onboarding

## Objective

Give an athlete a secure, resumable path from account creation to a confirmed initial Stride athlete model.

## Scope

- Minimal email/password authentication and password recovery through Supabase Auth.
- Authenticated routing and cookie-based server sessions.
- Minimal athlete-owned profile, goal, and onboarding progress persisted in Supabase.
- Progressive setup for provider connection/import state, athlete context, goals, and profile review.
- Clear provenance and ownership behavior for provider-derived and manually entered values.
- A Garmin integration boundary that reports real capability and sync state without presenting a mock as production integration.

## Dependencies

The Night Track theme must be implemented and merged before authentication UI work. Product decisions about required athlete fields, consent, retention, deletion, and Garmin availability must be resolved before storing sensitive athlete or provider data. The Supabase server integration foundation and official Supabase skills are available for relevant Issues.

## Expected user value

An athlete can create an account, return later, continue setup from the correct step, review what Stride knows and where it came from, then enter the product without waiting for a full historical import.

## Major risks

- Cross-athlete data access caused by missing or incorrect RLS.
- Unclear consent, retention, deletion, or provider failure behavior.
- Asking for unnecessary sensitive information or overwriting a manual override during sync.
- Making Garmin or background import behavior appear complete before a production service exists.
- Expanding onboarding into training, race intelligence, or coaching implementation.

## Completion criteria

- Auth and athlete-owned records use the approved Supabase SSR and database boundaries.
- Schema changes are reproducible through migrations, with RLS and ownership verification.
- Onboarding progress resumes after a later session and completion does not depend on a full history import.
- Each screen follows an approved screen reference when supplied and preserves keyboard, responsive, and reduced-motion behavior.
- Profile fields have documented purpose, validation, provenance, and manual override behavior.
- Required child Issues are independently merged; execution status is tracked only in GitHub.

## Planning note

This epic is a capability container, not an implementation branch or pull request. Initial Issues are created only as near-term work becomes sufficiently specified. Issue #3 establishes the required theme gate; Issue #4 installs the official Supabase development skills. Authentication and onboarding Issues should be decomposed after the theme is reviewed and merged and data/consent decisions are ready.

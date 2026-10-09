# Testing expectations

- Use Vitest for focused unit tests of domain rules, parsing, and deterministic behavior.
- Use Playwright for user-visible browser flows and smoke coverage.
- Keep domain code framework-independent where practical so it is easy to test.
- Validate external inputs at boundaries and cover valid, invalid, and incomplete cases.
- Add integration tests when persistence or external service behavior is introduced.
- Cover database ownership, constraints and functions with pgTAP tests in `supabase/tests/database`, run with `npm run db:test` against the local Supabase stack. Every Stride table needs cross-athlete and anonymous access tests.
- AI behavior will need curated evaluations for coaching quality, safety, and regression; no evaluation framework is included yet.

Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build` before a pull request when relevant.

## Onboarding foundation

The normal browser suite runs with `ONBOARDING_ENABLED=false` and checks existing landing/auth behavior. `npm run test:e2e:onboarding` is separate and CI-only: it reads local Supabase CLI status without printing credentials, requires a loopback API URL, enables rollout, starts the Garmin fixture API and runs one Chromium worker. The database CI job first applies Stride migrations and the pinned Garmin schema, then runs this suite. Test athletes are created only on that isolated stack and deleted after the suite. Never run it against hosted Supabase or start local Supabase on the homelab.

Unit tests exhaust all 64 completion combinations against all six targets, resume recovery, stale revisions, authenticated identity/token ordering, idempotent first entry, owner isolation, persisted-data errors, final live connection checks and polling backoff/retention. Browser coverage exercises first entry, locked/unknown/completed routes, refresh/relogin/second context, persisted Back/sidebar actions, stale revisions, second-athlete isolation and real fixture sync counts during navigation. Screenshots use ignored `test-results/` at 1440×900 and 390×844; keyboard and reduced-motion coverage remain required. Screen-body editing tests arrive with #33–#38.

# Testing expectations

- Use Vitest for focused unit tests of domain rules, parsing, and deterministic behavior.
- Use Playwright for user-visible browser flows and smoke coverage.
- Keep domain code framework-independent where practical so it is easy to test.
- Validate external inputs at boundaries and cover valid, invalid, and incomplete cases.
- Add integration tests when persistence or external service behavior is introduced.
- Cover database ownership, constraints and functions with pgTAP tests in `supabase/tests/database`, run with `npm run db:test` against the local Supabase stack. Every Stride table needs cross-athlete and anonymous access tests.
- AI behavior will need curated evaluations for coaching quality, safety, and regression; no evaluation framework is included yet.

Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build` before a pull request when relevant.

## Main browser suite

`npm run test:e2e` still starts the development server locally. The `chromium` project covers ordinary application journeys; `chromium-development` covers the design-system gallery, remote development origin and data-activity API/loading journeys; `chromium-race-course` runs its serial fixture mutations after `chromium` by default. The serial settings suite remains intact when sharding.

CI selects projects explicitly with `--no-deps`, so each runner has its own auth and Garmin fixtures and the course fixture cannot affect another project. The main project is split across three runners. The development project and course project each use a separate runner.

To exercise the isolated CI groups locally:

```bash
PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- --project=chromium --no-deps --shard=1/3
PLAYWRIGHT_PRODUCTION=true npm run test:e2e -- --project=chromium-race-course --no-deps
npm run test:e2e -- --project=chromium-development --no-deps
```

Production selections build and start the app inside Playwright's server command with the same environment, including public Supabase values. Both commands receive `PLAYWRIGHT_TEST=1` and use the ignored `.next-e2e` directory, outside Playwright's `test-results` output directory, so the Turbopack development cache survives between local runs. Build outputs are neither shared between CI jobs nor cached. Main application journeys run on a production build in CI so routes never compile during a test; a plain local `npm run test:e2e` still uses `next dev` for every project. Keep the development project on `next dev`: the gallery is hidden in production, the origin test exercises development behavior, and authenticated data-activity API requests need loopback cookies that Playwright's API client omits when production marks them Secure.

List projects and shards with `--list` to check selection without starting servers. The original 130 main tests are covered exactly once: 93 main tests (31/31/31), 35 development tests and two course tests. See [CI design and measurements](ci.md) for required-check behavior.

## Onboarding foundation

The normal browser suite runs with `ONBOARDING_ENABLED=false` and checks existing landing/auth behavior. `npm run test:e2e:onboarding` is separate and CI-only: it reads local Supabase CLI status without printing credentials, requires a loopback API URL, enables rollout, starts the Garmin fixture API and runs one Chromium worker. Each of three database CI runners first applies Stride migrations and the pinned Garmin schema, then runs `npm run test:e2e:onboarding -- --shard=1/3`, `--shard=2/3` or `--shard=3/3`. Test-level sharding splits the 21 tests into 7/7/7 while keeping one worker per runner. UUID athletes and Garmin state keyed by athlete subject isolate test data; athletes are deleted after the suite. Each runner owns an independent Supabase stack and repeats migration reset/replay, advisors, pgTAP and generated-type checks. Never run it against hosted Supabase or start local Supabase on the homelab.

Onboarding retains the development server because authenticated Playwright API requests omit production Secure cookies over HTTP loopback. Authentication policy and assertions remain unchanged. The helper forwards additional Playwright arguments. Listing onboarding tests locally requires `CI=true` and placeholder loopback credentials in the environment and must use `--list`; it does not require or start Supabase.

Unit tests exhaust all 64 completion combinations against all six targets, resume recovery, stale revisions, authenticated identity/token ordering, idempotent first entry, owner isolation, persisted-data errors, final live connection checks and polling backoff/retention. Browser coverage exercises first entry, locked/unknown/completed routes, refresh/relogin/second context, persisted Back/sidebar actions, stale revisions, second-athlete isolation and real fixture sync counts during navigation. Screenshots use ignored `test-results/` at 1440×900 and 390×844; keyboard and reduced-motion coverage remain required. Screen-body editing tests arrive with #33–#38.

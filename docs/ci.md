# CI design

The CI workflow preserves the required `validate` and `database` check names. Both are final aggregation jobs using `if: always()` and assertions over dependency results. Failed, canceled or unexpectedly skipped work fails the corresponding required check. Scope must succeed and explicitly return either `true` or `false`; an absent or invalid output cannot produce a passing aggregate.

## Scope and cancellation

The scope job uses Node 24's built-in TypeScript execution before dependency installation. On pull requests it compares the base and head commit hashes with `git diff --no-renames --name-only -z`. NUL separators preserve spaces and newlines; disabling rename detection includes executable deletions when a file moves into documentation. Git is invoked with argument arrays and validated full commit hashes.

Only Markdown files under `docs/`, root `README.md` and `AGENTS.md`, Markdown pull-request templates, and Markdown/YAML issue templates qualify for documentation-only CI. Executable files, configuration, dependencies, mixed changes, unknown paths, empty changes and detection errors run full CI. HTML templates and executable documentation such as MDX also run full CI. Pushes to `main` always run full CI.

For documentation-only pull requests, quality, browser and database jobs are skipped. Required checks pass only when scope explicitly identifies documentation-only changes and all their heavy dependencies are skipped. They still fail if scope fails or a dependency is canceled.

New commits cancel older CI runs for the same pull request. Main pushes use a unique run ID, so their runs do not cancel each other.

## Isolated jobs

| Job                         | Coverage                                                            | Server / fixtures                                         |
| --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `quality`                   | Lint, typecheck, unit tests and normal production build             | No browser or database stack                              |
| `browser` main-1/2/3        | 93 main Chromium tests, split 31/31/31                              | Development app, independent auth/Garmin fixtures         |
| `browser` course            | Two serial race-course tests                                        | Production app, independent mutable course fixture        |
| `browser` development       | 35 gallery, remote-origin and data-activity tests                   | Development app, independent auth/Garmin fixtures         |
| `database-onboarding` 1/2/3 | All database checks on each runner, 21 onboarding tests split 7/7/7 | Development app, independent local Supabase/Garmin stacks |
| `validate` / `database`     | Required-check result assertions                                    | No checkout or dependency installation                    |

All browser selections use explicit projects and `--no-deps` to avoid Playwright's dependency project running all tests on the first shard. Main settings and course serial groups retain their ordering. Onboarding enables test-level sharding while keeping one worker per runner. `fail-fast: false` allows every shard to report its own result and preserves complete coverage even when a sibling fails.

The course runner builds its production app inside the server command so build and start receive identical public environment values and `PLAYWRIGHT_TEST`. Main application journeys retain development servers to preserve the existing assertions and mutable-fixture behavior across navigation and profile updates. Data-activity and onboarding also require development servers: production marks authentication cookies Secure, while Playwright's APIRequestContext does not send them over HTTP loopback (the authenticated data-activity check returned 401 instead of 200). This preserves existing authentication policy and assertions without adding HTTPS test infrastructure. Test builds remain under ignored `test-results/next`; they are never cached or uploaded. npm's dependency cache remains enabled. Browser caching is lower priority because downloads account for only 20–30 seconds of the baseline.

Failed main browser jobs upload traces, error context, screenshots and the final result metadata for seven days. Each onboarding shard uploads its screenshots and available diagnostics after every run, preserving successful visual evidence. Artifacts exclude build output and environment files.

## Measurements and limits

Issue #66's successful PR baseline is 6–8 minutes to green. Main browser steps took 232–345 seconds; database setup plus serial onboarding formed a 315–378 second path. Six recorded green runs had a median time to green of 421.5 seconds.

Parallel jobs trade additional runner minutes for a shorter blocking path. Each main shard repeats dependency/browser setup and starts a development server; the course runner additionally builds production; each onboarding shard repeats the entire local database setup and checks. The after-change comparison must use GitHub Actions runners, include job durations and sum runner minutes, and retain all 151 browser tests. Local browser timings cannot establish an Actions speedup. Actual after-change measurements and documentation-only/failure-path evidence belong in the issue #66 pull request after the remote runs finish.

# CI design

The CI workflow preserves the required `validate` and `database` check names. Both are final aggregation jobs using `if: always()` and assertions over dependency results. Failed, canceled or unexpectedly skipped work fails the corresponding required check. Scope must succeed and explicitly return either `true` or `false`; an absent or invalid output cannot produce a passing aggregate.

## Scope and cancellation

The scope job uses Node 24's built-in TypeScript execution before dependency installation. It compares the pull-request base and head, or the previous and new `main` commits on a push, with `git diff --no-renames --name-only -z`. NUL separators preserve spaces and newlines; disabling rename detection includes executable deletions when a file moves into documentation. Git is invoked with argument arrays and validated full commit hashes.

Only Markdown files under `docs/`, root `README.md` and `AGENTS.md`, Markdown pull-request templates, and Markdown/YAML issue templates qualify for documentation-only CI. Executable files, configuration, dependencies, mixed changes, unknown paths, empty changes and detection errors run full CI. HTML templates and executable documentation such as MDX also run full CI. Pushes to `main` never qualify as documentation-only.

For documentation-only pull requests, quality, browser and database jobs are skipped.

The database job runs only when a change touches `supabase/migrations/`, or when scope cannot compute the change set. Otherwise it is skipped, and the `database` check passes only for that explicit skip.

Pull requests run a subset of browser specs. For each changed `src` file, scope follows runtime imports (type-only imports are ignored) up to the route files that use it: `page`, `layout`, `loading`, `route`, `error`, `not-found`, `template`, `default` and `src/proxy.ts`. The areas of those routes select their specs through `tests/e2e/lanes.json`, plus the `smoke` specs. A file that no route reaches selects its own area. Changed specs always run. The full suite runs when a root layout reaches the change, or for changes to shared code without an area (`src/components`, `src/lib`, global CSS), fixtures, dependencies, configuration, workflows, an area missing from `lanes.json`, or an unknown path. Migrations, `managed-agents`, unit and integration tests, generated database types and documentation select no browser spec. Pushes to `main` always run the full browser suite. Scope also generates the browser job matrix, so lanes without a selected spec do not start; when no lane is selected, the browser job is skipped and `validate` requires that skip. Required checks pass only when scope explicitly identifies documentation-only changes and all their heavy dependencies are skipped. They still fail if scope fails or a dependency is canceled.

New commits cancel older CI runs for the same pull request. Main pushes use a unique run ID, so their runs do not cancel each other.

## Isolated jobs

| Job                         | Coverage                                                                              | Server / fixtures                                         |
| --------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `quality`                   | Lint, typecheck, unit tests and normal production build                               | No browser or database stack                              |
| `browser` main-1/2          | Main Chromium tests, two shards with four workers (one shard for small selections)    | Production app, independent auth/Garmin fixtures          |
| `browser` course            | Serial race-course and session-matching tests                                         | Production app, independent mutable course fixture        |
| `browser` development-1/2   | Gallery, remote-origin and data-activity tests, two shards (one for small selections) | Development app, independent auth/Garmin fixtures         |
| `database-onboarding` 1/2/3 | Only with migrations: database checks and 21 onboarding tests split 7/7/7             | Development app, independent local Supabase/Garmin stacks |
| `validate` / `database`     | Required-check result assertions                                                      | No checkout or dependency installation                    |

All browser selections use explicit projects and `--no-deps` to avoid Playwright's dependency project running all tests on the first shard, and `--pass-with-no-tests` so a shard whose selected files hold no test for its project succeeds. Main settings and course serial groups retain their ordering. Browser jobs run four workers in CI, except the development project, which keeps two: with four, `next dev` compiles routes for every worker at once and timing-sensitive loading journeys miss their window. Onboarding enables test-level sharding while keeping one worker per runner. `fail-fast: false` allows every shard to report its own result and preserves complete coverage even when a sibling fails.

Browser jobs run in the official `mcr.microsoft.com/playwright` image that matches the installed `@playwright/test` version, with `--ipc=host`. Chromium and its system libraries come with the image, so no job runs `playwright install --with-deps`; that step usually took 20–30 seconds but once took 426 seconds on slow apt mirrors. Bump the image tag with `@playwright/test`.

Each database runner starts Supabase and installs Chromium concurrently after `npm ci`. The setup step waits for both commands and retains a nonzero status if either fails. Migration reset and the remaining database checks begin only after both finish successfully. These operations use separate Docker and browser/system dependency resources; no database checks overlap migration application.

The main and course runners build their production app inside the server command so build and start receive identical public environment values and `PLAYWRIGHT_TEST`. Building once and sharing the output would serialize a build job before every browser job without shortening the blocking path, so each runner keeps its own build. Main application journeys moved to production because `next dev` compiles each route on its first request: under parallel workers a first client navigation to a dynamic route waited more than 16 seconds and timed out its URL assertion. Data-activity and onboarding also require development servers: production marks authentication cookies Secure, while Playwright's APIRequestContext does not send them over HTTP loopback (the authenticated data-activity check returned 401 instead of 200), and five data-activity loading journeys depend on development navigation timing. This preserves existing authentication policy and assertions without adding HTTPS test infrastructure. Test builds live under the ignored `.next-e2e` directory; they are never cached or uploaded in CI. npm's dependency cache remains enabled.

Failed main browser jobs upload traces, error context, screenshots and the final result metadata for seven days. Each onboarding shard uploads its screenshots and available diagnostics after every run, preserving successful visual evidence. Artifacts exclude build output and environment files.

## Measurements and limits

Issue #66's successful PR baseline was 6–8 minutes to green. Before issue #265, the ten latest green pull-request runs had a median of 852 seconds to green and 2,818 runner-seconds. The longest job ran 469–1,077 seconds, driven by browser installs (once 426 seconds) and the local Supabase path on every pull request.

The first #265 run took 227 seconds to green for a full browser suite without migrations, and 913 runner-seconds, including one 30-second retry. Container start (26–35 seconds) replaces the Chromium install: it costs about as much as a normal install, but its duration is steady. The slowest job was main-2 at 208 seconds, of which 149 seconds were the production build and its tests. A change with migrations adds the database jobs in parallel, about four minutes each, as before. Smaller pull-request selections skip lanes entirely. Over the 40 changes merged before #265, scope would have skipped the database jobs 26 times, run no browser job for 3 and a subset for 4. The remaining 33 changes touched shared code, fixtures or dependencies, so they still ran the full browser suite.

Local single-spec runs drop from 58 seconds (build included) to 9 seconds when `npm run e2e:app` is already serving; starting it takes about 30 seconds once. Local timings depend on machine load and do not establish Actions speedups.

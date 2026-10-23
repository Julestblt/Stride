# Releases

Stride ships with a GitLab-flow style model: `main` is pre-production and release tags are production. There is no release branch.

## Environments

| Environment    | Dokploy app (project `stride`)        | URL                                | Deploys                             |
| -------------- | ------------------------------------- | ---------------------------------- | ----------------------------------- |
| Pre-production | `preprod` (`stride-preprod-fajqks`)   | `https://stride-preprod.julez.cat` | Every push to `main`                |
| Production     | `frontend` (`stride-frontend-1yf71m`) | `https://stride.julez.cat`         | Every `vX.Y.Z` tag pushed to GitHub |

Both apps build the same `Dockerfile`. Each has its own runtime environment, including `SITE_URL`, and both share one hosted Supabase project, one garmin_mcp service and the same Managed Agents. Supabase Auth must list both URLs as redirect URLs.

## Versioning

Versions follow semver and are computed by [release-please](https://github.com/googleapis/release-please) from the Conventional Commit squash titles that land on `main`:

- `fix` gives a patch release, `feat` a minor release, and `!` or a `BREAKING CHANGE:` footer a major release.
- Other types, such as `chore`, `docs`, `refactor` and `test`, do not trigger a release on their own and stay out of the changelog.
- A commit body containing `Release-As: <version>` forces the next version.

The `Release` workflow keeps one release pull request open on `main`, titled `chore: release X.Y.Z`. It updates `CHANGELOG.md`, the `package.json` version and `.release-please-manifest.json` as commits land. Those files are owned by release-please; do not edit them by hand. Merging the release pull request makes the workflow create the `vX.Y.Z` tag and its GitHub release, and the tag deploys production.

The release pull request is opened with the workflow token, so CI does not run on it. It changes only release metadata, and the commit it ships is already validated on `main` and running in pre-production.

## Releasing

The owner asks an agent to release; the agent runs the `release` skill (`.agents/skills/release`). It summarizes the release pull request, checks that `main` is green, that pre-production runs the current commit and that hosted migrations are applied, merges the release pull request, then follows the tag through to the production deployment.

## Migrations

Pre-production and production share the hosted database, so a migration reaches production data as soon as it is applied for pre-production, while production still runs the previous release. Every migration must therefore stay compatible with the code of the current production release:

- Add tables, columns, functions and policies first; ship the code that uses them; remove what became unused in a later release.
- Do not rename or drop anything the current production release still reads or writes. Add a new column or function and migrate callers instead.
- New constraints must accept the rows the production release still writes.

Apply a merged migration to the hosted project before or right after its pull request lands on `main`, never at release time. Applying migrations stays an owner approval checkpoint.

## Rollback

Fix forward: revert or fix on `main`, check it in pre-production and ship a patch release. Because migrations stay compatible with the previous release, a revert runs against the current schema.

## Setup

- The production app's trigger type is `tag`; the pre-production app follows `main` with trigger type `push`.
- Pre-production needs its own copy of the production build arguments and environment, with `SITE_URL=https://stride-preprod.julez.cat`.
- GitHub Actions must be allowed to create pull requests (repository settings, Actions, Workflow permissions) so release-please can open the release pull request.

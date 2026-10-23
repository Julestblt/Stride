---
name: release
description: Release Stride to production. Use when the owner asks to release, ship or deploy to production, cut a version, or asks what the next release contains. Checks pre-production and hosted migrations, then merges the release-please pull request so the vX.Y.Z tag deploys production.
---

# Release

Stride follows `docs/releases.md`: `main` deploys pre-production, a `vX.Y.Z` tag deploys production. release-please keeps one open release pull request on `main` with the next version and changelog. Releasing means verifying that pull request is safe to ship, then merging it. Never create or push tags by hand.

Talk to the owner in their language. Keep GitHub content in English.

## 1. Find the release

```bash
gh pr list --state open --label "autorelease: pending" --json number,title,url,headRefOid
```

- No pull request: nothing releasable has landed since the last tag. Tell the owner and stop.
- Read its body for the version and changelog. Summarize the user-visible changes for the owner in a few lines.
- If the owner only asked what the next release contains, stop here.

## 2. Pre-flight checks

Stop and report on the first failure. Do not merge around a failed check.

1. **Main is green.** The latest `CI` run on `main` must be `success` on the current `origin/main` commit:
   ```bash
   git fetch origin main
   gh run list --branch main --workflow CI --limit 1 --json headSha,status,conclusion
   ```
2. **Pre-production runs that commit.** The latest deployment of the pre-production Dokploy app `preprod` (`stride-preprod-fajqks`, on `stride-preprod.julez.cat`) is `done` for the `origin/main` commit. Use the Dokploy MCP tools when available; otherwise check that `https://stride-preprod.julez.cat/` answers.
3. **Hosted migrations are applied.** Every file in `supabase/migrations` is applied on the shared hosted Supabase project (Supabase MCP `list_migrations`). A missing migration means both environments run code ahead of the schema: report it, since applying it is an owner approval checkpoint.
4. **Migrations in this release stay compatible.** List them with `git diff --name-only <previous tag> origin/main -- supabase/migrations`. Flag any drop, rename or new constraint that the code of the previous tag still depends on.
5. **Shared Managed Agents.** If `managed-agents/` changed since the previous tag, confirm with the owner that `ant apply` already ran, since both environments use the same agents.

## 3. Ship

Merge only when the owner asked to release in this conversation.

```bash
gh pr merge <number> --squash
```

Then follow the `Release` workflow run on `main` until it publishes the release:

```bash
gh run list --branch main --workflow Release --limit 1 --json status,conclusion,url
gh release view v<version> --json tagName,url
```

The production Dokploy app `frontend` (`stride-frontend-1yf71m`, on `stride.julez.cat`) deploys the new tag. Wait for its deployment to finish `done`, then check that `https://stride.julez.cat/` answers.

## 4. Report

Tell the owner the version, the release URL, the production deployment status and anything that needs their action.

## When something goes wrong

- Release workflow failed: read its log, fix on a branch through a normal pull request, and let release-please refresh the release pull request.
- Production deployment failed or the release is broken: read the Dokploy deployment log, fix forward on `main` (revert or fix) through a pull request, and ship a patch release with this skill.
- To force a version, land a commit on `main` whose body contains `Release-As: <version>`.

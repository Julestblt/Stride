# Stride agent guide

## Purpose

Stride is a web-first personal running coach for road and trail athletes. This repository is a product foundation; implement product work only from a scoped issue or explicit task.

## Boundaries

- Keep domain logic independent from React and Next.js.
- Keep server-only code under `src/server`; never import it into client components.
- Keep AI orchestration, agents, skills, context, schemas, tools, domain logic, observability, and evaluations separate as they are introduced. Agents are specialized actors; skills are reusable domain capabilities.
- Treat Garmin as an external integration service that normalizes provider data before it reaches the application. MCP may become an interface, never the source of truth.
- Keep Supabase access behind server integration modules. Never expose private credentials or bypass database row-level security.
- Prefer feature-local code for feature-specific UI, schemas, and server logic. Add shared modules only when they have a clear responsibility.

## Working rules

- Inspect existing patterns before introducing another one.
- Use English for code, identifiers, tests, and developer documentation. Do not add source-code comments or commented-out code.
- Write all GitHub-hosted content in English, including issues, pull requests, comments, review replies, and release notes. Keep athlete-facing product content in French.
- Stride V1 is French only. Write every user-facing string in French, including UI copy, validation and error messages, accessibility labels, notifications, and product emails. Format athlete-facing dates and numbers for `fr-FR`. Never introduce English fallback copy in the product.
- Keep TypeScript strict, avoid `any`, and validate external input with Zod.
- Use named exports by default, small focused modules, and React Server Components unless browser behavior requires a client component.
- Do not add dependencies without a current architectural need. Do not create empty abstractions, placeholder TODOs, fake agents, or unrelated refactors.
- Preserve backwards compatibility unless the issue explicitly permits a breaking change.
- Never commit secrets. Do not manually edit generated files when tooling owns them.
- Do not merge pull requests in automated workflows.

## Frontend conventions

- Tailwind CSS v4 is the primary styling system. Prefer utility classes inside React components, including responsive breakpoint utilities.
- Reserve `globals.css` for theme tokens, resets, global accessibility behavior, and truly global styles. Do not add page-specific or component-specific global classes without a strong technical reason.
- Consume semantic theme utilities instead of raw colors. Keep CSS variables and `@theme inline` as the token source of truth.
- shadcn/ui is the preferred accessible primitive layer. Night Track controls colors, typography, radii, spacing, and final appearance; shadcn presets must not replace it.
- Reuse existing primitives before adding abstractions. Avoid unnecessary wrappers, utilities, and duplicate UI libraries.
- Use `next/font` for project fonts. Preserve keyboard navigation, focus-visible states, and reduced-motion behavior.

## Component conventions

- Prefer small, composable React components. Keep business/domain logic out of presentational primitives.
- Add shadcn primitives only when they solve an actual interaction or accessibility need. Do not recreate an existing shadcn/Radix primitive without a good reason.
- Do not add UI libraries that duplicate shadcn/Radix functionality.
- UI has three layers: shadcn primitives in `src/components/ui`, Stride patterns in `src/components/stride`, and screen composition in `src/app` and `src/features`. Before creating a component or local style, check both layers and the `/design-system` gallery, then reuse or extend; add a new abstraction only for a genuinely new pattern. See `docs/design/design-system.md`.
- Adapt registry component styles to Night Track before use. `text-muted` is supporting text in Stride; use `bg-surface-raised` for muted surfaces rather than shadcn's `bg-muted` assumption. Use `rounded-control` and `rounded-surface` for explicit shape roles.

## Design reference conventions

- The live Claude Design board is the visual source of truth. Read artboards through the claude.ai Artifact tool as described in `docs/design/design-board.md`; never export, commit, or copy board files or their generated markup into the repository.
- Design first: for a new screen or user-visible UI change, update the affected board artboards before implementing, then build from them.
- Never generate, transform, or commit derivative images or derive production assets unless explicitly requested.
- Temporary visual validation artifacts, including rendered artboards, must remain untracked. Store local screenshots in ignored `test-results/` or outside the repository.

## Delivery

- Follow the GitHub issue workflow: clarify scope, plan, branch, implement, validate, review, and open a pull request.
- Name branches `feat/<issue>-<name>`, `fix/<issue>-<name>`, `refactor/<issue>-<name>`, `docs/<issue>-<name>`, or `chore/<issue>-<name>`.
- Merges to `main` deploy pre-production; only release tags deploy production. Release through the `release` skill and never tag by hand. Squash titles drive semver, so use `feat`, `fix` and `!` deliberately. See `docs/releases.md`.
- Keep every migration compatible with the current production release: pre-production and production share the hosted database.
- Use Conventional Commits and keep commits small and atomic. Inspect the staged diff before every commit and leave unrelated files out.
- Run the relevant lint, typecheck, unit, browser, and build checks for the change. Add meaningful domain unit tests; do not test implementation trivia.
- Locally, run only the Playwright specs the change touches or directly affects, for example `npx playwright test tests/e2e/<area>.spec.ts --project=chromium`. Keep one app running with `npm run e2e:app` and run specs with `PLAYWRIGHT_REUSE_APP=true` instead of rebuilding for each run (see `docs/testing.md`). Never run the full browser or onboarding suites locally; CI selects browser specs on pull requests and runs the full suite on `main`.
- Prefer Vitest over Playwright for rules, formatting, and state logic. Keep new browser tests to user journeys, and select elements by role or label rather than CSS structure.
- Update documentation when decisions, setup, boundaries, or user-visible behavior change.

## Product planning

- Use the official BMAD skills installed under `.agents/skills` for discovery, product artifacts, UX, architecture, and scoped implementation when appropriate. See `docs/planning-workflow.md` for the mapping to Stride's canonical documents.
- Skills are task-scoped, not universal context: load only the relevant installed skill. Follow the skill hierarchy and boundaries in `docs/planning-workflow.md`.
- Read selected skill instructions fully; reuse them within the session and reload when changed or no longer available after compaction. Read only issue-relevant documentation sections and supporting references.
- Keep tool output focused: use targeted searches, filtered JSON, and concise test summaries. Store verbose logs in temporary files and inspect relevant excerpts; retain surrounding code and failure details needed to verify behavior.
- Give delegated agents the acceptance criteria and only the context needed for their task. Reuse an independent review of the current diff when it covers the change's risks; review subsequent substantive changes and uncovered risks before delivery.
- Keep accepted product and architecture decisions in `docs/product`, `docs/design`, `docs/architecture`, `docs/adr`, and `docs/epics`.
- GitHub Issues are the only execution tracker. Do not create or maintain local ticket trees, TODO backlogs, or mirrored issue status. Epic documents describe capability boundaries without execution state.
- Start implementation from a GitHub Issue and carry its acceptance criteria, linked artifacts, plan, and verification into the pull request.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

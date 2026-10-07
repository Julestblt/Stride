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
- Use English for code, identifiers, UI copy, tests, and documentation. Do not add source-code comments or commented-out code.
- Keep TypeScript strict, avoid `any`, and validate external input with Zod.
- Use named exports by default, small focused modules, and React Server Components unless browser behavior requires a client component.
- Do not add dependencies without a current architectural need. Do not create empty abstractions, placeholder TODOs, fake agents, or unrelated refactors.
- Preserve backwards compatibility unless the issue explicitly permits a breaking change.
- Never commit secrets. Do not manually edit generated files when tooling owns them.
- Do not merge pull requests in automated workflows.

## Delivery

- Follow the GitHub issue workflow: clarify scope, plan, branch, implement, validate, review, and open a pull request.
- Name branches `feat/<issue>-<name>`, `fix/<issue>-<name>`, `refactor/<issue>-<name>`, `docs/<issue>-<name>`, or `chore/<issue>-<name>`.
- Use Conventional Commits and keep commits small and atomic. Inspect the staged diff before every commit and leave unrelated files out.
- Run the relevant lint, typecheck, unit, browser, and build checks for the change. Add meaningful domain unit tests; do not test implementation trivia.
- Update documentation when decisions, setup, boundaries, or user-visible behavior change.

## Product planning

- Use the official BMAD skills installed under `.agents/skills` for discovery, product artifacts, UX, architecture, and scoped implementation when appropriate. See `docs/planning-workflow.md` for the mapping to Stride's canonical documents.
- Skills are task-scoped, not universal context: load only the relevant installed skill. Follow the skill hierarchy and boundaries in `docs/planning-workflow.md`.
- Keep accepted product and architecture decisions in `docs/product`, `docs/design`, `docs/architecture`, `docs/adr`, and `docs/epics`.
- GitHub Issues are the only execution tracker. Do not create or maintain local ticket trees, TODO backlogs, or mirrored issue status. Epic documents describe capability boundaries without execution state.
- Start implementation from a GitHub Issue and carry its acceptance criteria, linked artifacts, plan, and verification into the pull request.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

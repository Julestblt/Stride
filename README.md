# Stride

Stride is a web-first personal running coach for road and trail athletes. This repository contains the product foundation; coaching features are planned through GitHub Issues and implemented in focused changes.

## Getting started

Use Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project direction

See the [product vision](docs/product/vision.md), [planning workflow](docs/planning-workflow.md), and [architecture overview](docs/architecture/overview.md). Agent contribution rules are in [AGENTS.md](AGENTS.md).

## Configuration

The sign-in page runs without external credentials. Copy `.env.example` to `.env.local` when working on Supabase integration. Environment values are validated centrally; the public project URL and publishable key are used by the browser-facing app, and server-only `GARMIN_API_URL` points at the garmin_mcp REST API (see `docs/architecture/garmin.md`). Run `npm run garmin:smoke` with `GARMIN_API_URL` set to check the service's health and token enforcement; set `GARMIN_SMOKE_ACCESS_TOKEN` to a test user's access token to include authenticated reads. Never add secrets to public variables or commit local environment files. When opening the dev server from another device or hostname, such as a LAN or Tailscale address, list the hostnames in `ALLOWED_DEV_ORIGINS` and restart the dev server. Use comma-separated hostnames without a scheme or port. Otherwise Next.js blocks the client bundles and pages render without interactivity.

## Docker

The `Dockerfile` builds a production image that serves the app with `next start` on port 3000. Public Supabase values are inlined into the browser bundle at build time, so pass them as build arguments. Provide server-only values (`SITE_URL`, `GARMIN_API_URL`, `ANTHROPIC_API_KEY`, the push values `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `PUSH_DISPATCH_SECRET`, and the others in `.env.example`) as runtime environment variables. Push notifications stay disabled until the four push values are set and the Vault secrets `push_dispatch_url` (the production `/api/push/dispatch` URL) and `push_dispatch_secret` exist on the hosted database; see [ADR 0014](docs/adr/0014-postgres-scheduled-push-delivery.md).

Dokploy deploys `main` to pre-production and release tags to production. See [releases](docs/releases.md).

    docker build \
      --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
      --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
      -t stride .

## Local database

Stride-owned tables live in `supabase/migrations` and are managed with the Supabase CLI (requires Docker). The local stack never touches a hosted project.

    npm run db:start      # start local Supabase
    npm run db:reset      # apply Stride migrations, then garmin_mcp migrations from a pinned revision
    npm run db:test       # pgTAP RLS, constraint and completion tests
    npm run db:advisors   # Supabase security and performance advisors
    npm run db:types      # regenerate src/server/supabase/database.types.ts
    npm run db:stop

`scripts/supabase-garmin-schema.sh` applies garmin_mcp's migrations at `GARMIN_MCP_REVISION` so tests use the real shared schema without copying it. Applying migrations to a hosted Supabase project requires explicit approval; see [data platform](docs/architecture/database.md).

## Validation

Run the checks relevant to your change:

    npm run format:check
    npm run lint
    npm run typecheck
    npm run test
    npm run test:e2e
    npm run build

Playwright downloads Chromium separately with `npx playwright install chromium`. See [testing expectations](docs/testing.md), [CI design](docs/ci.md), and the [engineering workflow](docs/engineering-workflow.md).

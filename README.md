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

The landing page runs without external credentials. Copy `.env.example` to `.env.local` when working on Supabase integration. Environment values are validated centrally; only public project URL and publishable key are currently used. Never add secrets to public variables or commit local environment files. When opening the dev server from another device or hostname, such as a LAN or Tailscale address, list the hostnames in `ALLOWED_DEV_ORIGINS` and restart the dev server. Use comma-separated hostnames without a scheme or port. Otherwise Next.js blocks the client bundles and pages render without interactivity.

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

Playwright downloads Chromium separately with `npx playwright install chromium`. See [testing expectations](docs/testing.md) and the [engineering workflow](docs/engineering-workflow.md).

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

The landing page runs without external credentials. Copy `.env.example` to `.env.local` when working on Supabase integration. Environment values are validated centrally; the public project URL and publishable key are used by the browser-facing app, and server-only `GARMIN_API_URL` points at the garmin_mcp REST API (see `docs/architecture/garmin.md`). Run `npm run garmin:smoke` with `GARMIN_API_URL` set to check the service's health and token enforcement; set `GARMIN_SMOKE_ACCESS_TOKEN` to a test user's access token to include authenticated reads. Never add secrets to public variables or commit local environment files. When opening the dev server from another device or hostname, such as a LAN or Tailscale address, list the hostnames in `ALLOWED_DEV_ORIGINS` and restart the dev server. Use comma-separated hostnames without a scheme or port. Otherwise Next.js blocks the client bundles and pages render without interactivity.

## Validation

Run the checks relevant to your change:

    npm run format:check
    npm run lint
    npm run typecheck
    npm run test
    npm run test:e2e
    npm run build

Playwright downloads Chromium separately with `npx playwright install chromium`. See [testing expectations](docs/testing.md) and the [engineering workflow](docs/engineering-workflow.md).

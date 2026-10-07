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

The landing page runs without external credentials. Copy `.env.example` to `.env.local` when working on Supabase integration. Environment values are validated centrally; only public project URL and publishable key are currently used. Never add secrets to public variables or commit local environment files.

## Validation

Run the checks relevant to your change:

    npm run format:check
    npm run lint
    npm run typecheck
    npm run test
    npm run test:e2e
    npm run build

Playwright downloads Chromium separately with `npx playwright install chromium`. See [testing expectations](docs/testing.md) and the [engineering workflow](docs/engineering-workflow.md).

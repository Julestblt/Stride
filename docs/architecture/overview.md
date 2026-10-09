# Architecture overview

Stride is a web-first Next.js application using TypeScript and React Server Components. The initial repository contains an App Router shell, validated environment configuration, and a server-only Supabase client boundary.

## Current boundaries

- `src/app` owns routing, layouts, metadata, and page composition.
- `src/lib` contains small environment-safe modules that are not tied to a product feature.
- `src/server` contains server-only integrations. Supabase access starts here.
- Product features should be grouped under `src/features/<feature>` when they exist.
- Domain calculations should be framework-independent and live close to their domain.

Directories are added when useful code needs them; empty future structures are intentionally omitted.

The authentication feature uses server actions, HTTP-only Supabase session cookies and a session-refresh proxy. See [authentication](authentication.md) for the routes, trusted callback origin, provider configuration and launch limitations.

## Request and data direction

The browser talks to the Stride application. Server code owns privileged integrations and access control. Supabase provides PostgreSQL, Auth, and future Storage. Garmin connection, MFA and synchronization are owned by the garmin_mcp service; the Stride server calls its REST API with the athlete's access token and reads normalized data. See [Garmin integration](garmin.md), [data platform](database.md) and [onboarding](onboarding.md).

## Native client path

The web application is the first client. Keep business rules and API contracts independent of page components so a native client can be added later without duplicating the domain.

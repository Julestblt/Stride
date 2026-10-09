# ADR 0005: Shared Supabase project with per-service schema ownership

- Status: Accepted
- Date: 2026-10-09

## Context

garmin_mcp already stores Garmin connections, encrypted sessions, sync jobs and normalized data in the Supabase project Stride uses for Auth. Its migrations were applied manually and the project has no recorded migration history. Stride now needs its own tables for onboarding progress, athlete profile, goals and races, and has no migration tooling.

## Decision

- Keep one Supabase project per environment, shared by Stride and garmin_mcp, so both use the same `auth.users` identity and RLS.
- Each service owns its tables and versioned migrations in its own repository. Stride uses the Supabase CLI and `supabase/migrations`.
- Stride never writes garmin_mcp tables or duplicates Garmin connection, credential or synchronization state. It calls the garmin_mcp REST API for Garmin operations and status and may read normalized rows through owner-only RLS.
- Stride reaches garmin_mcp from its server over the internal network and forwards the athlete's Supabase access token.
- Local stacks apply garmin_mcp migrations from a pinned revision before Stride migrations.
- Hosted projects receive migrations only after review and explicit approval. The current project stays protected until its environment role is confirmed; a separate staging project is used for live validation.

## Consequences

Migration order across repositories must be coordinated per environment, and Stride tests depend on a pinned garmin_mcp schema revision. Either service can evolve its own tables independently as long as the shared contracts stay compatible. Introducing migration history to the existing project needs a baseline for garmin_mcp's manually applied migrations.

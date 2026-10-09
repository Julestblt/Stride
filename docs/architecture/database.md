# Data platform

Supabase provides PostgreSQL, Auth, and future Storage. Application access uses server integration modules and typed domain boundaries. Never use a service-role key in Stride or a browser, and never bypass row-level security for convenience. Keep provider payloads and normalized domain records distinguishable.

## Schema ownership

Stride and garmin_mcp share one Supabase project. Each repository owns its tables and migrations; see [ADR 0005](../adr/0005-shared-supabase-schema-ownership.md).

| Owner      | Tables                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stride     | `onboarding_progress`, `athlete_profiles`, `athlete_goals`, `athlete_races`                                                                                                                          |
| garmin_mcp | `provider_connections`, `provider_secrets`, `auth_challenges`, `auth_attempts`, `sync_jobs`, `provider_activities`, `provider_activity_segments`, `provider_observations`, `provider_training_weeks` |

Stride may read garmin_mcp's normalized tables through their owner-only policies. It never writes them, references their internals in migrations, or reads secrets and challenges.

## Migrations

Stride uses the Supabase CLI with versioned SQL migrations in `supabase/migrations`. Every Stride table has RLS enabled, owner-only policies using `(select auth.uid()) = user_id`, no `anon` grants, and only the `authenticated` privileges it needs. Migrations are reviewed in a pull request before they are applied anywhere. Local and CI stacks apply garmin_mcp migrations from a pinned revision before Stride migrations, so tests run against the real shared schema without copying it.

## Environments

| Environment | Use                                                                                  |
| ----------- | ------------------------------------------------------------------------------------ |
| Local       | Supabase CLI stack for development, CI integration, RLS and browser tests            |
| Staging     | Separate Supabase project for deployed Stride, garmin_mcp and live Garmin validation |
| Protected   | The current shared project; its production or staging role is unconfirmed            |

Do not apply destructive or unreviewed changes to the protected project. Applying Stride migrations to any hosted project is an explicit approval checkpoint.

## Data handling

Athlete profile, goals and races are personal data. Collect only fields with a documented onboarding purpose. Deleting an auth user cascades to Stride-owned rows. Retention, export and deletion behavior beyond account deletion remain E-01 decisions.

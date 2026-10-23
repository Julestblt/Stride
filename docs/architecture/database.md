# Data platform

Supabase provides PostgreSQL, Auth, and future Storage. Application access uses server integration modules and typed domain boundaries. Ordinary Stride operations use the athlete session under RLS. Following #42, the server-only completion module uses `SUPABASE_ONBOARDING_COMPLETION_KEY` solely for the constrained `complete_onboarding_step_server` RPC after verified identity and fresh connected Garmin. A missing key fails closed; no key reaches the browser. Keep provider payloads and normalized domain records distinguishable.

## Schema ownership

Stride and garmin_mcp share one Supabase project. Each repository owns its tables and migrations; see [ADR 0005](../adr/0005-shared-supabase-schema-ownership.md).

| Owner      | Tables                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stride     | `onboarding_progress`, `athlete_profiles`, `athlete_goals`, `athlete_races`, `athlete_unavailability`, race workspace tables, `athlete_wellness_checkins`, `activity_feelings`, `push_subscriptions`, `push_preferences`, `push_deliveries` |
| garmin_mcp | `provider_connections`, `provider_secrets`, `auth_challenges`, `auth_attempts`, `sync_jobs`, `provider_activities`, `provider_activity_segments`, `provider_observations`, `provider_training_weeks`                                        |

Stride may read garmin_mcp's normalized tables through their owner-only policies. It never writes them, references their internals in migrations, or reads secrets and challenges. The one exception is `public.provider_activity_owned(uuid)`, a security-invoker plpgsql helper the `activity_feelings` RLS policies call to check that the athlete owns the activity; its body resolves `provider_activities` at run time, so Stride migrations still apply before garmin_mcp's.

## Migrations

Stride uses the Supabase CLI with versioned SQL migrations in `supabase/migrations`. Every Stride table has RLS enabled, owner-only policies using `(select auth.uid()) = user_id`, no `anon` grants, and only the `authenticated` privileges it needs. Migrations are reviewed in a pull request before they are applied anywhere. Isolated CI stacks also apply garmin_mcp migrations from a pinned revision after Stride migrations, so tests run against the real shared schema without copying it. The two schemas do not reference each other, so the order is not significant.

## Scheduled work

`pg_cron` and `pg_net` run Stride's background push delivery ([ADR 0014](../adr/0014-postgres-scheduled-push-delivery.md)). The `stride-push-tick` job calls `private.push_tick()` every minute. It reads the dispatch URL and bearer secret from Vault (`push_dispatch_url`, `push_dispatch_secret`) and does nothing while either is missing. It reconciles Garmin notifications for athletes with a device, enqueues `push_deliveries` for new notifications and the 07:00 session reminder, posts pending deliveries to `/api/push/dispatch`, and reads the previous answers from `net._http_response` to drop expired subscriptions and retry failures. Athletes read and delete their own `push_subscriptions`, register devices through `public.register_push_subscription`, and edit their own `push_preferences`; `push_deliveries` has no client access. Creating the Vault secrets on the hosted project is an owner approval checkpoint.

## Environments

| Environment | Use                                                                           |
| ----------- | ----------------------------------------------------------------------------- |
| CI          | Isolated Supabase CLI stack for schema, RLS and onboarding browser tests      |
| Protected   | The hosted project shared by garmin_mcp, Stride pre-production and production |

Pre-production and production share the protected project, so migrations must stay compatible with the current production release (see [releases](../releases.md)).

Do not apply destructive or unreviewed changes to the protected project. Applying Stride migrations to any hosted project is an explicit approval checkpoint.

## Data handling

Athlete profile, planning constraints (time zone, weekly ceiling, unavailable dates), goals and races are personal data. Collect only fields with a documented onboarding purpose. Deleting an auth user cascades to Stride-owned rows. Retention, export and deletion behavior beyond account deletion remain E-01 decisions.

The application uses hosted Supabase, including local frontend development. Local Supabase runs only in isolated CI. Do not start a local stack or create test athletes against the protected hosted project. Production uses the publishable key plus session cookies for ordinary operations; the completion credential is configured separately by an explicitly approved deployment action. The typed cookie client uses the tooling-generated `Database` type.

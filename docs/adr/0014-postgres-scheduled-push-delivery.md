# ADR 0014: Postgres-scheduled work and push delivery

- Status: Accepted
- Date: 2026-10-23
- Issue: #284
- Amends: [ADR 0009](0009-coach-worker-runtime-on-postgres.md)

## Context

Notifications (#237) live only in the in-app center, so the athlete sees them only when Stride is open. The owner uses an iPhone, where Web Push works only for a web app added to the home screen. Some pushes have no athlete request behind them: the 07:00 session reminder and Garmin imports that land while the app is closed. ADR 0009 left background work without a credential: the web process acts only with the athlete's session, and the worker container was removed in #193.

## Decision

- Stride is installable: a web app manifest (`src/app/manifest.ts`), generated icons and a service worker (`public/sw.js`) that only shows pushes and opens their screen. There is no offline cache.
- Each device subscribes from Réglages › Entraînement et coach. `push_subscriptions` holds one row per endpoint, written through `public.register_push_subscription` and readable or deletable by its owner. `push_preferences` holds four category switches per athlete: Séance du jour, Plan et staff, Débrief prêt and Problèmes Garmin.
- Postgres schedules the background work. `pg_cron` runs `private.push_tick()` every minute. The tick reconciles Garmin notifications for athletes with a device (`private.reconcile_garmin_notifications_for`, the body of the existing RPC), enqueues one `push_deliveries` row per device for notifications from the last six hours that occurred after the device subscribed, enqueues one session reminder per device and day between 07:00 and 12:00 in the plan time zone (plans with an unknown time zone are skipped), marks pending deliveries failed when their category is off or their notification was read or resolved, and posts up to 50 pending deliveries with `pg_net`.
- The tick posts to `/api/push/dispatch` with a bearer secret. The URL and secret live in Vault as `push_dispatch_url` and `push_dispatch_secret`; without them the tick does nothing. The route compares the secret in constant time, builds the French text with the notification center's copy, encrypts and sends with `web-push`, and answers `{ gone, failed }`. The next tick reads that answer from `net._http_response`, deletes expired subscriptions and retries failed deliveries, or a whole batch answered with an error status, up to three attempts. A batch that timed out or got no answer within five minutes is not resent, so a push goes out at most once.
- Device endpoints must belong to a browser push service (Apple, Google, Mozilla or Microsoft): the registration RPC rejects other hosts and the route reports such a device as gone. Signing out removes the browser's subscription first, so the next person on the device gets no pushes.
- The web process gets no new database credential. Everything the route needs, including the staff faces, travels in the request. VAPID keys and the dispatch secret are server-only environment values; without them the route answers 503 and the settings say push is unavailable.

## Alternatives considered

- A Supabase Edge Function or a new container that sends pushes: one more runtime and deployment for a few requests per minute.
- A service-role key in the web process to read deliveries: the internet-facing process would hold a key that bypasses RLS.
- Sending from server actions only: the reminder and Garmin imports have no athlete request.

## Trade-offs

Pre-production and production share the database, so Vault holds one URL, the production one, and both deployments use the same VAPID keys. Payload URLs are relative, so each origin's service worker opens its own screen. Delivery is at most a minute late, and a push service outage loses a delivery after three attempts; the notification stays in the center.

## Consequences

- Scheduled work that needs no model call can run in Postgres with `pg_cron` and reach Stride through a secret-protected route. Background coaching runs still need the impersonation design from ADR 0009.
- Enabling `pg_net` and `pg_cron` on the hosted project and creating the Vault secrets are an owner approval checkpoint.

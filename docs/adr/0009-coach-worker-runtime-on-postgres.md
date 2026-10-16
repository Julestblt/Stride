# ADR 0009: A coach worker on Supabase Postgres runs agent workflows

- Status: Accepted (2026-10-13, #94), amended by the Managed Agents spike (2026-10-15, #128)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

Plan generation runs several model calls and can take minutes. Self-hosted Next.js drains in-flight work for only 10–30 seconds on shutdown, Supabase Edge Functions stop at 150–400 seconds of wall-clock time, and the deployment is a small Dokploy homelab with Supabase as the only stateful platform. Runs need retries, idempotency, cancellation, streaming progress and persistence.

## Decision

- The Next.js web service authenticates, enqueues runs through athlete-session RPCs, streams progress over server-sent events and records decisions. Existing single-shot skills may stay in the web process.
- One `stride-coach-worker` service, built from the same repository and image, executes every multi-step or tool-using run, applies accepted proposals and runs monitors and the weekly scheduler.
- `agent_runs` is the job record: lease claims with `FOR UPDATE SKIP LOCKED`, attempts and backoff, a cancellation flag, an idempotency key and one active plan-mutating run per athlete. Steps are memoized by `(run_id, step_key)`; progress events are append-only. LISTEN/NOTIFY wakes the worker, with polling as a fallback.
- The worker connects with a dedicated login role that reads as the athlete under RLS and writes only through private functions.
- No Edge Functions, external workflow engine or new queue service.

## Alternatives considered

- Agent SDK embedded in route handlers.
- A dedicated agent API plus worker.
- Temporal, Inngest, Trigger.dev, Restate, DBOS, and Workflow DevKit with its Postgres World.
- pg-boss or graphile-worker as the queue.
- A headless coding-agent runtime (Claude Agent SDK, OpenCode server).

## Trade-offs

One more container and a small amount of queue code that the team owns, following the lease pattern garmin_mcp already uses for its sync jobs. If fan-out or rich scheduling becomes necessary, pg-boss is the fallback without changing the domain records.

## Consequences

- Deploys restart the worker safely: in-flight steps are retried and completed steps are reused.
- The internet-facing process holds no coaching write privilege and no worker credential.
- A spike must confirm that a custom login role works through the Supabase pooler; the fallback is a direct connection or a constrained server key as in #42.

## Amendment (2026-10-15, #128)

The Managed Agents spike moved the agent loop, its retries and its session state to Claude Managed Agents. Stride no longer needs `agent_runs` leases, memoized steps or a progress event log to drive a conversation or a plan design: a session holds the transcript, the platform runs the loop, and Stride answers custom tool calls from the event stream.

What stays from this ADR:

- Stride executes every custom tool under the athlete's row-level security; agents never receive Stride or Garmin credentials beyond the athlete's own Supabase access token, held in a per-athlete vault for garmin_mcp.
- Plan changes stay proposals. A proposal is applied only after the athlete accepts it, by the `stride_coach_worker` role through `private.apply_plan_proposal`, after Stride recomputes and revalidates the changeset from the stored operations.
- `private.delete_plan` lets the worker remove an athlete's plan, used to reset tests.

Open points, carried into Phase 2:

- The spike applies proposals from a development-only route in the web process with the worker database URL. Production moves that credential out of the internet-facing process, into a small worker or a server-only job, as this ADR requires.
- A custom login role through the Supabase pooler is still unverified.
- Runs without the athlete online (weekly reviews, monitors) need a credential other than the athlete's session token; this stays with the worker impersonation spike.

## Amendment (2026-10-16, #136)

The runtime foundations close the spike's open points for interactive runs.

- **Session lifecycle.** `POST /api/coach/turns` starts or resumes the signed-in athlete's Managed Agents session and streams the turn as server-sent events. A resume is accepted only when the session is one of the athlete's own `coach_sessions` rows under RLS **and** its `stride_user_id` metadata matches; otherwise the API answers 404 before any event is sent or read. Each session has a budget cap ($1 conversation, $2 plan design), one turn at a time, an `ask_athlete` pause stored as `awaiting_athlete`, and a 15-minute turn timeout that sends `user.interrupt` and shows a French message.
- **Worker credential.** The web process no longer holds `COACH_WORKER_DATABASE_URL`. A small `stride-coach-worker` Node service (`src/server/coaching/worker/main.ts`, bundled to `build/coach-worker.mjs` by `npm run worker:build`) listens on the internal network only, with no public route. The web process forwards apply and reset requests with the athlete's access token (`COACH_WORKER_URL`); the worker verifies the token with Supabase Auth, recomputes and revalidates the changeset under the athlete's RLS, then calls `private.apply_plan_proposal`, `private.delete_plan` or `private.clear_new_plan_proposals` with its own database role.
- **Scope of the worker.** It serves athlete-initiated actions only, so it never needs to impersonate an athlete. Background runs (weekly reviews, monitors) still need the impersonation design in the Decision above and stay out of scope.
- **Database login.** `stride_coach_worker` stays the `NOLOGIN` privilege role. A separate login role that is a member of it holds the password, which is set by hand on the hosted project and never committed. The worker connects through the Supavisor pooler in session mode, as `<login role>.<project ref>`.

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

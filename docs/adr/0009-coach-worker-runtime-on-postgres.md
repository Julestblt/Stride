# ADR 0009: A coach worker on Supabase Postgres runs agent workflows

- Status: Proposed
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

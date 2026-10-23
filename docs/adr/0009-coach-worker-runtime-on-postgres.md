# ADR 0009: A coach worker on Supabase Postgres runs agent workflows

- Status: Accepted (2026-10-13, #94), amended by the Managed Agents spike (2026-10-15, #128); the `stride-coach-worker` service is removed by the 2026-10-18 amendment (#193); scheduled push delivery runs in Postgres per [ADR 0014](0014-postgres-scheduled-push-delivery.md) (#284)
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

- **Session lifecycle.** `POST /api/coach/turns` starts or resumes the signed-in athlete's Managed Agents session and streams the turn as server-sent events. A resume is accepted only when the session is one of the athlete's own `coach_sessions` rows under RLS **and** its `stride_user_id` metadata matches; otherwise the API answers 404 before any event is sent or read. Each session has a budget cap ($1 conversation, $2 plan design), one turn at a time, an `ask_athlete` pause stored as `awaiting_athlete`, and a 15-minute turn timeout that sends `user.interrupt` and shows a French message. The turn runs detached from the HTTP request (#188): closing or refreshing the page never interrupts it, the timeout is the only server-side stop, and every athlete-visible item is still recorded. While a session is `running`, a reopened thread refreshes until the turn ends, and `coach_sessions.composing_since` marks a Coach model request in progress so the thread can show a long write.
- **Worker credential.** The web process no longer holds `COACH_WORKER_DATABASE_URL`. A small `stride-coach-worker` Node service (`src/server/coaching/worker/main.ts`, bundled to `build/coach-worker.mjs` by `npm run worker:build`) listens on the internal network only, with no public route. The web process forwards apply and reset requests with the athlete's access token (`COACH_WORKER_URL`); the worker verifies the token with Supabase Auth, recomputes and revalidates the changeset under the athlete's RLS, then calls `private.apply_plan_proposal`, `private.delete_plan` or `private.clear_new_plan_proposals` with its own database role.
- **Scope of the worker.** It serves athlete-initiated actions only, so it never needs to impersonate an athlete. Background runs (weekly reviews, monitors) still need the impersonation design in the Decision above and stay out of scope.
- **Database login.** `stride_coach_worker` stays the `NOLOGIN` privilege role. A separate login role that is a member of it holds the password, which is set by hand on the hosted project and never committed. The worker connects through the Supavisor pooler in session mode, as `<login role>.<project ref>`.

### Verification (2026-10-16, #136)

Live checks ran against the hosted project and the `Stride` Managed Agents workspace, from the development server, with the owner's account (A) and a second account without Garmin (B). Total list cost: $0.19.

| Check                                         | How                                                                                              | Result                                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coach → Medical consult with `ask_athlete`    | A reports knee pain before a race; answers the relayed question                                  | Pass. The Coach consulted Medical, relayed its question through `ask_athlete`, stored `awaiting_athlete`, then resumed the same session with the answer and gave conditional advice. $0.15; first turn 102 s, answer turn 16 s |
| Stride isolation                              | B posts a turn with A's session id                                                               | Pass. 404 before any Managed Agents call; A's session kept the same events and cost; B has no `coach_sessions` row for it. Covered by `coaching-runtime.test.ts` and `coach_sessions.test.sql`                                 |
| Garmin isolation                              | B asks for its last Garmin runs                                                                  | Pass. B's session uses only B's vault; garmin_mcp answered `reconnect_required` for B and the Coach reported the data as unavailable without using A's data. $0.04                                                             |
| garmin_mcp lease contention and rate limits   | A asks for Garmin runs during a manual sync                                                      | Not reproduced: the sync finished before the MCP call. `provider_busy` follows the same unavailable path observed for `reconnect_required`; the 3-second lease wait is garmin_mcp#13. Rate limits were not exercised           |
| Token expiry mid-session                      | A turn when the access token expires within 15 minutes                                           | Not run live, at the owner's request. Refresh decisions and the unavailable path are covered by `coaching-runtime.test.ts`                                                                                                     |
| Custom login role through the Supabase pooler | Worker connects as a login role member of `stride_coach_worker`                                  | Still open: the login role is not created on the hosted project, so the worker cannot apply or reset plans there yet                                                                                                           |
| Agents as code                                | `ant apply --dry-run` after archiving the orphaned first agent set (two agents, one environment) | Pass. Everything up to date, 12 resources unchanged                                                                                                                                                                            |

## Amendment (2026-10-16, #171)

The group conversation from the [D10 amendment](../architecture/coaching-engine/coaching-team-proposal.md#amendment-2026-10-16-171-a-group-conversation) runs on the existing coordinator session. A specialist does not need its own session.

**Spike.** Two temporary agents (Coach coordinator and Medical, Claude Sonnet 5.5 at medium effort, French group-chat prompts, Medical owning `ask_athlete` with answer options) ran one pain-report conversation in the `Stride` workspace against fixtures, then were archived. Session `sesn_01RDVvjypSBngaCjayUC4cFk`: 2 turns, 8 s then 5 s, $0.04 list cost, 986 output tokens. It used short prompts with no skills and no athlete context, so its cost is not comparable to the #139 baseline ($0.20); the PR for #171 measures the production agents.

| Question                                                | Result                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can the Coach hand off in an athlete-visible line?      | Yes. The Coach's `agent.message` on the primary thread (« @Inès, tu peux regarder ton tibia droit avec Jules ? ») came before its `agent.thread_message_sent` to Medical, which was in French.                                                           |
| Can a specialist ask the athlete directly?              | Yes. Medical's `ask_athlete` call was cross-posted to the primary stream with Medical's `session_thread_id`, and the session went `idle` with `requires_action`. The options came back as a structured list (four choices).                              |
| Does the answer reach the specialist without the Coach? | Yes. `user.custom_tool_result` with the call's id, sent on a later turn, resumed Medical's thread directly; the Coach thread did not run in between.                                                                                                     |
| How is the specialist's answer surfaced?                | Medical's reply reaches the primary stream as `agent.thread_message_received`, addressed to the athlete, safety first (« Annule le fractionné… fais voir ce tibia par un médecin »). A specialist's own `agent.message` stays on its thread stream only. |
| Can the athlete post to a specialist thread?            | No. The client posts `user.message` to the primary thread only, so free-text follow-ups go through the Coach.                                                                                                                                            |

**Runtime consequences.**

- A specialist's reply to the Coach (`agent.thread_message_received`) is stored and shown as that specialist's message; the Coach's instructions forbid restating it.
- `ask_athlete` moves to each specialist's tool allowlist and gains optional answer options. The pending question keeps the asking thread; the answer is sent by tool id as today.
- The Coach's hand-off line is a normal Coach message; the agent-to-agent brief stays out of the thread.

**Prompt issues seen in the spike**, to fix in the production agents: Medical ended its reply with a second question in prose instead of a second `ask_athlete` call, and spoke to the Coach inside the athlete's message (« Coach, c'est à toi de voir… »); the Coach added a filler line (« Inès est en train de regarder ça avec toi. ») and a synthesis that partly repeated Medical's advice.

## Amendment (2026-10-18, #193)

The web process applies accepted proposals. The `stride-coach-worker` service, its client and its `COACH_WORKER_*` variables are removed.

**Why.** The worker's login role was never created on the hosted project, so every accepted proposal stayed « Acceptée, application en attente ». The service and its credential added a deployment and a secret without a real control. The control is unchanged without it: plan tables stay read-only under RLS, the athlete accepts through an ownership-checked RPC, and no Coach tool can accept or apply.

**Decision.**

- When the athlete accepts or retries, the server action recomputes and revalidates the changeset from the stored operations under the athlete's RLS, as the worker did (`src/server/plans/apply.ts`).
- It then calls `public.apply_accepted_plan_proposal(proposal_id, changeset)` with the athlete's session. This `security definer` RPC takes the athlete from `auth.uid()`, refuses a proposal the athlete does not own (`not_found`), and delegates to `private.apply_plan_proposal`, which still requires the `accepted` status and checks the base version in one transaction.
- `public.record_plan_proposal_outcome` and `public.reset_own_plan` wrap `private.mark_plan_proposal_outcome`, `private.delete_plan` and `private.clear_new_plan_proposals` the same way. All three are executable by `authenticated` only.
- An unexpected failure while applying keeps the proposal accepted, and the athlete can retry it.

**Trade-off.** The athlete can send a changeset of their choice for their own accepted proposal. It only affects their own plan, and the private function still validates its structure. Background runs (weekly reviews, monitors) still need a credential other than the athlete's session, and stay out of scope as before.

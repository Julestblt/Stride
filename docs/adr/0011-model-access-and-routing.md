# ADR 0011: Claude models through a model gateway, routed by task, on API billing only

- Status: Accepted, amended by decisions D1, D4 and D7 (2026-10-13, #94)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)
- Related: [ADR 0006](0006-import-insights-phrasing.md)

## Context

The engine needs reliable structured outputs and tool use, strong reasoning for plan design, low cost for frequent conversational work, and prompt caching. The existing skills call DeepSeek through OpenCode Go, whose terms for application traffic are unconfirmed. Prices and data terms were verified on 2026-10-12.

## Decision

- All model calls go through a Stride `ModelGateway` port with a versioned routing table, one versioned price table, per-call budgets and usage accounting. Provider SDKs are imported only inside gateway adapters.
- The first adapter uses the official `@anthropic-ai/sdk` with no EU-residency requirement (D1). The existing OpenAI-compatible adapter serves the current skills until they move to Haiku 5.5 (D7); an OpenAI-compatible adapter may serve a second provider later.
- Routing:
  - Claude Opus 5.5 at high effort for plan design and multi-race revisions;
  - Claude Sonnet 5.5 for conversation, adaptations, weekly reviews and specialist consults;
  - Claude Haiku 5.5 for routing, extraction and phrasing, including the existing single-shot skills (insights phrasing, roadbook extraction).
- Escalation: an output that fails schema or validator checks may be retried once on the next tier (Haiku 5.5 → Sonnet 5.5 → Opus 5.5) before the deterministic fallback. For the existing skills this means Haiku 5.5, then Sonnet 5.5, then their current deterministic fallback.
- When Opus 5.5 is unavailable for more than 15 minutes, plan design falls back to Sonnet 5.5 at high effort, recorded on the run.
- Per-run caps on model calls, tool calls, tokens, cost and wall clock protect against runaway loops. There are no per-athlete quotas or monthly budgets (D4); usage is recorded per call.
- Prompt caching on every workflow; Batch API for non-urgent weekly reviews.
- Structured results use strict tool calls validated with Zod so the design also works on platforms without native structured outputs.
- Models that require provider-side 30-day retention (Fable 5.1 and Mythos) are not used with athlete data.
- Production uses dedicated, spend-limited API keys per environment. Consumer subscriptions and CLI logins are never used to serve athletes.
- A second provider is adopted only after it passes the coaching evaluation suite.

## Alternatives considered

- One frontier model for everything.
- The cheapest model with heavier validation.
- Vercel AI SDK 7 or an agent framework as the core abstraction.
- Multi-provider ensembles.

## Trade-offs

Direct SDK use keeps full control of caching, effort and batching, which drive cost, but portability rests on the gateway and the evaluation suite rather than on a framework. The expected cost is about $0.73 for a fully detailed initial plan, $0.04 for a workout change and $0.89 per typical athlete per month — estimates to be measured.

## Consequences

- The gateway keeps the provider swappable; moving to another platform or provider is an adapter plus an evaluation run, not a workflow change.
- Model upgrades are evaluation-gated changes to the routing table.

# ADR 0011: Claude models through a model gateway, routed by task, on API billing only

- Status: Proposed
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)
- Related: [ADR 0006](0006-import-insights-phrasing.md)

## Context

The engine needs reliable structured outputs and tool use, strong reasoning for plan design, low cost for frequent conversational work, and prompt caching. The existing skills call DeepSeek through OpenCode Go, whose terms for application traffic are unconfirmed. Prices and data terms were verified on 2026-10-12.

## Decision

- All model calls go through a Stride `ModelGateway` port with a versioned routing table, one versioned price table, per-call budgets and usage accounting. Provider SDKs are imported only inside gateway adapters.
- The first adapter uses the official `@anthropic-ai/sdk`; the existing OpenAI-compatible adapter remains for the current skills until decision D7.
- Routing:
  - Claude Opus 5.5 at high effort for plan design and multi-race revisions;
  - Claude Sonnet 5.5 for conversation, adaptations, weekly reviews and specialist consults;
  - Claude Haiku 5.5 for routing, extraction and phrasing.
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

Direct SDK use keeps full control of caching, effort and batching, which drive cost, but portability rests on the gateway and the evaluation suite rather than on a framework. The expected cost is about $0.53 for an initial plan, $0.04 for a workout change and $0.83 per typical athlete per month — estimates to be measured.

## Consequences

- The data-residency choice (D1) can move inference to an EU-hosted Claude platform without changing workflows.
- Model upgrades are evaluation-gated changes to the routing table.

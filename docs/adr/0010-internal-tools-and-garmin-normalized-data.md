# ADR 0010: Internal typed tools and normalized Garmin data, no Stride MCP server

- Status: Proposed
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

The coaching runtime needs athlete-scoped access to Garmin and Stride data and narrow ways to submit proposals. garmin_mcp exposes an MCP endpoint in Stride mode with ten read-only tools, but those tools call live Garmin Connect per request, share session leases with the sync worker, return Garmin-shaped payloads, and require a live athlete access token. garmin_mcp also maintains normalized, owner-readable tables that Stride's screens already use.

## Decision

- Tools are TypeScript functions in a typed registry with Zod input and output schemas, a class (`read`, `compute`, `propose`), allowed workflows and a data class. They run inside the worker with the run's athlete scope.
- Read tools return minimized, provenance-tagged data computed from normalized rows read under RLS. Propose tools submit proposals, questions or memory facts through private functions. No tool runs SQL, fetches URLs, touches files, runs commands, pushes to Garmin, changes goals or races, or reaches another athlete.
- The production runtime does not call the garmin_mcp MCP endpoint; freshness comes from connection and sync rows. Intraday wellness stays an athlete-initiated web feature.
- Stride does not build an MCP server now. If an external, athlete-authorized client appears, a read-only MCP facade with audience-bound OAuth tokens and per-tool scopes wraps the same registry.
- The Supabase management MCP is never connected to production coaching agents.

## Alternatives considered

- garmin_mcp MCP tools as the agent's Garmin source.
- A Stride MCP server for internal use.
- A generic database tool.

## Trade-offs

The runtime depends on garmin_mcp's normalized coverage; missing data (heart-rate zones, lactate threshold, a change feed) must be added in garmin_mcp rather than read live. In return, the coach reasons over the same data the athlete sees, without Garmin rate-limit or token issues.

## Consequences

- garmin_mcp drafts G4 (profile and zones) and G8 (change feed) become useful prerequisites.
- Tool isolation tests are mandatory for every tool.

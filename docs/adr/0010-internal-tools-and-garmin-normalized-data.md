# ADR 0010: Internal typed tools and normalized Garmin data, no Stride MCP server

- Status: Accepted (2026-10-13, #94), amended for read-only garmin_mcp MCP access (2026-10-15, #130)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

The coaching runtime needs athlete-scoped access to Garmin and Stride data and narrow ways to submit proposals. garmin_mcp exposes an MCP endpoint in Stride mode with ten read-only tools, but those tools call live Garmin Connect per request, share session leases with the sync worker, return Garmin-shaped payloads, and require a live athlete access token. garmin_mcp also maintains normalized, owner-readable tables that Stride's screens already use.

## Decision

- Tools are TypeScript functions in a typed registry with Zod input and output schemas, a class (`read`, `compute`, `propose`), allowed workflows and a data class. They run inside the worker with the run's athlete scope.
- Read tools return minimized, provenance-tagged data computed from normalized rows read under RLS. Propose tools submit proposals, questions or memory facts through private functions. No tool runs SQL, fetches URLs, touches files, runs commands, pushes to Garmin, changes goals or races, or reaches another athlete.
- Replaced by the [#130 amendment](#amendment-2026-10-15-130): originally, the production runtime did not call the garmin_mcp MCP endpoint; freshness still comes from connection and sync rows for background runs. Intraday wellness stays an athlete-initiated web feature.
- Stride does not build an MCP server now. If an external, athlete-authorized client appears, a read-only MCP facade with audience-bound OAuth tokens and per-tool scopes wraps the same registry.
- The Supabase management MCP is never connected to production coaching agents.

## Alternatives considered

- garmin_mcp MCP tools as the agent's Garmin source.
- A Stride MCP server for internal use.
- A generic database tool.

## Trade-offs

The runtime depends on garmin_mcp's normalized coverage; missing data (heart-rate zones, lactate threshold, a change feed) must be added in garmin_mcp rather than read live. In return, the coach reasons over the same data the athlete sees, without Garmin rate-limit or token issues.

## Consequences

- garmin_mcp G4 (heart-rate zones, lactate threshold and athlete metrics) shipped as Julestblt/garmin_mcp#8; G8 (change feed) remains a useful prerequisite before monitors scale.
- Tool isolation tests are mandatory for every tool.

## Amendment (2026-10-15, #130)

The Managed Agents runtime chosen in #128 gives the Coach and Medical a read-only garmin_mcp allowlist. This amendment replaces the decision that the production runtime does not call the garmin_mcp MCP endpoint. Every statement below was checked against garmin_mcp and Stride code on 2026-10-15, after Julestblt/garmin_mcp#12 and #13 shipped.

### Decision

Coaching agents may call the garmin_mcp MCP endpoint read-only, for interactive drill-down only: an activity's laps, a night's sleep, a date's HRV. Normalized rows stay the source of truth for anything the validator checks, and the validator never uses an MCP value.

### Allowlist

| Tool                     | Exposed in production today | Coach | Medical |
| ------------------------ | --------------------------- | ----- | ------- |
| `get_activities`         | Yes                         | Yes   | No      |
| `get_activities_by_date` | Not yet (see below)         | No    | No      |
| `get_activity`           | Yes                         | Yes   | No      |
| `get_activity_splits`    | Yes                         | Yes   | No      |
| `get_training_status`    | Yes                         | Yes   | No      |
| `get_sleep_data`         | Yes                         | No    | Yes     |
| `get_hrv_data`           | Yes                         | No    | Yes     |
| `get_training_readiness` | Yes                         | No    | Yes     |
| `get_rhr_day`            | Yes                         | No    | Yes     |
| `get_stats`              | Yes                         | No    | No      |
| `get_vo2max_trend`       | Yes                         | No    | No      |

The tool set is fixed in code since Julestblt/garmin_mcp#12: `DEFAULT_TOOLS` in `stride_mcp.py` is the documented read-only set, and `GARMIN_ENABLED_TOOLS` can only narrow it; Stride mode refuses to start on a write tool or a tool outside the set. The production `GARMIN_ENABLED_TOOLS` does not list `get_activities_by_date` yet, so that tool stays unexposed until the deployment variable adds it; the skills then switch from paginating `get_activities` to reading a week with `get_activities_by_date`. The agent columns are the `mcp_toolset` configs in `managed-agents/agents/coach.md` and `medical.md`, where every other tool is disabled by default.

Excluded: every write tool, `get_lactate_threshold` (it misreads Garmin's speed unit; Stride reads lactate threshold from normalized rows) and every tool outside the set. Widening an agent's allowlist needs a change to this table.

`get_activities(start, limit)` is paginated newest-first with no date filter. The skills read a small `limit`, follow `next_start` while needed and keep only the dates they need.

### Guards

| Guard                                | Where enforced today                                                                                                    | Gap                                                                             | Follow-up |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- |
| Read-only, documented tool set       | garmin_mcp at startup: every enabled tool must be in `DEFAULT_TOOLS`; `GARMIN_ENABLED_TOOLS` can only narrow it         | None                                                                            | None      |
| Per-agent allowlist                  | Claude Managed Agents, from the agent's `mcp_toolset` configs                                                           | None                                                                            | None      |
| One date or at most 14 days per call | garmin_mcp: tools taking `start_date` and `end_date` reject wider ranges with `range_too_large` before Garmin is called | `get_activities` has no date range; the skills bound it with `limit` and paging | None      |
| Output size cap                      | garmin_mcp: responses above `STRIDE_MCP_MAX_RESPONSE_BYTES` (64 KB default) are cut behind a `[truncated]` first line   | A cut response is incomplete; agents ask for a narrower range                   | None      |
| MCP values never checked as truth    | Stride's validator works only from normalized rows and Stride tables                                                    | None                                                                            | None      |

### Token

- Stride writes the athlete's current Supabase access token as a `static_bearer` credential in a per-athlete vault before every turn, both new messages and `ask_athlete` answers (`syncAthleteVault` in `src/server/coaching/managed/session.ts`). `mcp_oauth` is not pursued.
- Expiry: a turn can last up to 15 minutes, so a token close to expiry can lapse mid-turn. The runtime foundations issue under #131 must refresh the Supabase session before syncing the vault whenever the token expires within the turn timeout. garmin_mcp then rejects the token and the call fails; the failure is reported as data unavailable (by the Coach to the athlete).
- Accepted risk: the token is a general Supabase user token, not one issued for garmin_mcp. G9, filed as [Julestblt/garmin_mcp#14](https://github.com/Julestblt/garmin_mcp/issues/14), adds audience-bound credentials on `/mcp`.

### Isolation

- garmin_mcp derives the user from the verified token subject (`UserScopedGarminProxy`), never from tool input.
- One vault per athlete, keyed by `stride_user_id` metadata (`src/server/coaching/managed/vault.ts`).
- Stride rejects a session whose `stride_user_id` metadata does not match the current user before running a turn.
- Verification with a second athlete account is still open from #128.

### Live calls

- Each MCP call takes the same per-connection session lease as the garmin_mcp sync worker. Since Julestblt/garmin_mcp#13 it waits at most 3 seconds, then fails with `provider_busy`; the sync worker and REST API keep their 90-second wait.
- Tools run on a worker thread, so a call waiting for the lease or for Garmin does not block other requests.
- A failed call returns an MCP error result (`isError`) whose text starts with a stable code and whose `structuredContent` is `{"error": {"code": …}}`: `provider_busy`, `rate_limited`, `provider_unavailable`, `reconnect_required`, `unauthorized`, `range_too_large`, `invalid_request`. A Garmin 404 for a date without data stays a normal "no data" answer.
- Agents report the data as unavailable on any of these codes and never retry in a loop.

### Background runs

Runs without the athlete online (weekly reviews, monitors) do not call MCP. They read normalized rows only.

### Unchanged

- Stride data reaches agents only through Stride custom tools executed under the athlete's row-level security.
- The Supabase management MCP is never connected to coaching agents.

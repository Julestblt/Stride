# ADR 0010: Internal typed tools and normalized Garmin data, no Stride MCP server

- Status: Accepted (2026-10-13, #94), amended for read-only garmin_mcp MCP access (2026-10-15, #130)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

The coaching runtime needs athlete-scoped access to Garmin and Stride data and narrow ways to submit proposals. garmin_mcp exposes an MCP endpoint in Stride mode with ten read-only tools, but those tools call live Garmin Connect per request, share session leases with the sync worker, return Garmin-shaped payloads, and require a live athlete access token. garmin_mcp also maintains normalized, owner-readable tables that Stride's screens already use.

## Decision

- Tools are TypeScript functions in a typed registry with Zod input and output schemas, a class (`read`, `compute`, `propose`), allowed workflows and a data class. They run inside the worker with the run's athlete scope.
- Read tools return minimized, provenance-tagged data computed from normalized rows read under RLS. Propose tools submit proposals, questions or memory facts through private functions. No tool runs SQL, fetches URLs, touches files, runs commands, pushes to Garmin, changes goals or races, or reaches another athlete.
- Amended by [#130](#amendment-2026-10-15-130): the production runtime does not call the garmin_mcp MCP endpoint; freshness comes from connection and sync rows. Intraday wellness stays an athlete-initiated web feature.
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

The Managed Agents runtime chosen in #128 gives the Coach and Medical a read-only garmin_mcp allowlist. This amendment replaces the decision that the production runtime does not call the garmin_mcp MCP endpoint. Every statement below was checked against garmin_mcp and Stride code on 2026-10-15.

### Decision

Coaching agents may call the garmin_mcp MCP endpoint read-only, for interactive drill-down only: an activity's laps, a night's sleep, a date's HRV. Normalized rows stay the source of truth for anything the validator checks, and the validator never uses an MCP value.

### Allowlist

| Tool                     | Exposed by garmin_mcp in Stride mode | Coach | Medical |
| ------------------------ | ------------------------------------ | ----- | ------- |
| `get_activities`         | Yes                                  | Yes   | No      |
| `get_activity`           | Yes                                  | Yes   | No      |
| `get_activity_splits`    | Yes                                  | Yes   | No      |
| `get_training_status`    | Yes                                  | Yes   | No      |
| `get_sleep_data`         | Yes                                  | No    | Yes     |
| `get_hrv_data`           | Yes                                  | No    | Yes     |
| `get_training_readiness` | Yes                                  | No    | Yes     |
| `get_rhr_day`            | Yes                                  | No    | Yes     |
| `get_stats`              | Yes                                  | No    | No      |
| `get_vo2max_trend`       | Yes                                  | No    | No      |

The exposed set is `DEFAULT_TOOLS` in garmin_mcp `stride_mcp.py`, repeated in `GARMIN_ENABLED_TOOLS` in its `docker-compose.yml`. The agent columns are the `mcp_toolset` configs in `managed-agents/agents/coach.md` and `medical.md`, where every other tool is disabled by default.

Excluded: every write tool, `get_lactate_threshold` (it misreads Garmin's speed unit; Stride reads lactate threshold from normalized rows) and every tool outside the exposed set. Widening an agent's allowlist needs a change to this table.

`get_activities(start, limit)` is paginated newest-first with no date filter. `get_activities_by_date` exists in garmin_mcp but is not exposed. The skills therefore read a small `limit` and keep only the dates they need.

### Guards

| Guard                                | Where enforced today                                                                                                                  | Gap                                                               | Follow-up                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Read-only tools, fixed exposed set   | garmin_mcp, at startup: Stride mode refuses to start unless every enabled tool starts with `get_`, `count_`, `search_` or `download_` | The prefix check is a naming rule, not a per-tool review          | None                                                                         |
| Per-agent allowlist                  | Claude Managed Agents, from the agent's `mcp_toolset` configs                                                                         | None                                                              | None                                                                         |
| One date or at most 14 days per call | Instructions only (`garmin-data-access` skill)                                                                                        | Range tools accept any range; `get_activities` has no date filter | [Julestblt/garmin_mcp#12](https://github.com/Julestblt/garmin_mcp/issues/12) |
| Output size cap                      | None                                                                                                                                  | Stride mode has no response cap; sleep payloads can exceed 400 KB | [Julestblt/garmin_mcp#12](https://github.com/Julestblt/garmin_mcp/issues/12) |
| MCP values never checked as truth    | Stride's validator works only from normalized rows and Stride tables                                                                  | None                                                              | None                                                                         |

### Token

- Stride writes the athlete's current Supabase access token as a `static_bearer` credential in a per-athlete vault before every turn, both new messages and `ask_athlete` answers (`syncAthleteVault` in `src/server/coaching/managed/session.ts`). `mcp_oauth` is not pursued.
- Expiry: a turn can last up to 15 minutes, so a token close to expiry can lapse mid-turn. The runtime foundations issue under #131 must refresh the Supabase session before syncing the vault whenever the token expires within the turn timeout. A 401 from garmin_mcp is reported to the athlete as data unavailable.
- Accepted risk: the token is a general Supabase user token, not one issued for garmin_mcp. G9, filed as [Julestblt/garmin_mcp#14](https://github.com/Julestblt/garmin_mcp/issues/14), adds audience-bound credentials on `/mcp`.

### Isolation

- garmin_mcp derives the user from the verified token subject (`UserScopedGarminProxy`), never from tool input.
- One vault per athlete, keyed by `stride_user_id` metadata (`src/server/coaching/managed/vault.ts`).
- Stride rejects a session whose `stride_user_id` metadata does not match the current user before running a turn.
- Verification with a second athlete account is still open from #128.

### Live calls

- Each MCP call takes the same per-connection session lease as the garmin_mcp sync worker. Behind a sync, a call waits up to 90 seconds, then fails with `PROVIDER_UNAVAILABLE` (503). [Julestblt/garmin_mcp#13](https://github.com/Julestblt/garmin_mcp/issues/13) makes MCP calls fail fast with an explicit busy error.
- A Garmin 429 comes back as `RATE_LIMITED`.
- On any of these errors the agent reports the data as unavailable and never retries in a loop.

### Background runs

Runs without the athlete online (weekly reviews, monitors) do not call MCP. They read normalized rows only.

### Unchanged

- Stride data reaches agents only through Stride custom tools executed under the athlete's row-level security.
- The Supabase management MCP is never connected to coaching agents.

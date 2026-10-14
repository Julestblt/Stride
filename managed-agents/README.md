# Managed Agents spike resources

Claude Managed Agents definitions for the coaching runtime spike ([#128](https://github.com/Julestblt/Stride/issues/128)). They live in the dedicated `Stride` workspace of the Anthropic organization.

| File                         | Resource                                                            |
| ---------------------------- | ------------------------------------------------------------------- |
| `agents/coach.md`            | Stride Coach, coordinator and the athlete's only voice (Sonnet 5.5) |
| `agents/medical.md`          | Stride Medical, consulted by the Coach only (Sonnet 5.5)            |
| `environments/coaching.yaml` | Cloud environment, limited networking, MCP servers only             |
| `claude-lock.json`           | Resource IDs written by `ant apply`, committed                      |

Neither agent has the sandbox toolset: no bash, files or web. Stride data reaches the agents only through custom tools executed by the Stride server under the athlete's row-level security. Garmin data comes from the read-only garmin_mcp MCP endpoint, with a tool allowlist on each agent and the athlete's credential supplied by a per-athlete session vault, never by these files.

## Sync

Run from this directory with a profile bound to the `Stride` workspace:

```sh
ant --profile Stride apply --dry-run agents/coach.md agents/medical.md environments/coaching.yaml
ant --profile Stride apply agents/coach.md agents/medical.md environments/coaching.yaml
```

Edit a file and apply again to create a new agent version. Commit `claude-lock.json` with the change.

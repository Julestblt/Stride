# Managed Agents spike resources

Claude Managed Agents definitions for the coaching runtime spike ([#128](https://github.com/Julestblt/Stride/issues/128)). They live in the dedicated `Stride` workspace of the Anthropic organization.

| Path                         | Resource                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `agents/coach.md`            | Stride Coach: coordinator, plan designer and the athlete's only voice    |
| `agents/medical.md`          | Stride Medical, consulted by the Coach only                              |
| `skills/*/SKILL.md`          | Coaching knowledge loaded on demand (plan format, periodization, races…) |
| `environments/coaching.yaml` | Cloud environment, limited networking, MCP servers only                  |
| `claude-lock.json`           | Resource IDs written by `ant apply`, committed                           |

Both agents run on Claude Sonnet 5.5. Their only sandbox tool is `read`, which loads skills; there is no bash, file writing or web access. Stride data reaches the agents only through custom tools executed by the Stride server under the athlete's row-level security (`src/server/coaching/managed/tools.ts`):

- `read_athlete_context`: today, profile, availability, races, training history, targets, Garmin predictions, check-ins;
- `read_health_reports`, `read_active_plan`;
- `submit_plan` and `create_plan_proposal`, which store validated proposals only;
- `ask_athlete`, which pauses the turn until the athlete answers.

Garmin data comes from the read-only garmin_mcp MCP endpoint, with a tool allowlist on each agent and the athlete's Supabase access token supplied by a per-athlete vault, never by these files.

## Skills

| Skill                                                                     | Agents            |
| ------------------------------------------------------------------------- | ----------------- |
| `plan-format`, `plan-periodization`, `race-specificity`, `session-design` | Coach             |
| `health-recovery`                                                         | Coach and Medical |
| `fueling`                                                                 | Coach             |
| `status-reports`: today's session, the current week, the next race        | Coach             |
| `explain-decision`: why a proposal or change was made                     | Coach             |
| `garmin-data-access`: bounded, read-only Garmin reads                     | Coach and Medical |

`status-reports`, `explain-decision` and `garmin-data-access` are derived from ai-running-coach v1.3.0 (MIT); see `skills/NOTICE` and the [skills inventory](../docs/architecture/coaching-engine/skills-inventory.md), which maps all 22 reference skills and lists the planned `read_plan_progress` and `read_plan_history` tools.

## Development page

`/coach` (development only) starts a conversation session ($1 cap) or a plan design session ($2 cap) after confirmation, shows the transcript with latency and cost, and lets the athlete approve, apply or delete plans. Applying and deleting use the `stride_coach_worker` role and need `COACH_WORKER_DATABASE_URL` in `.env.local`.

## Sync

Run from this directory, never from a parent directory, with a profile bound to the `Stride` workspace:

```sh
ant --profile Stride apply --dry-run agents/coach.md agents/medical.md environments/coaching.yaml
ant --profile Stride apply agents/coach.md agents/medical.md environments/coaching.yaml
```

Edit a file and apply again to create a new agent version. Commit `claude-lock.json` with the change.

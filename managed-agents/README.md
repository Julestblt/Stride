# Managed Agents coaching resources

Claude Managed Agents definitions for the coaching runtime, chosen by the [#128](https://github.com/Julestblt/Stride/issues/128) spike and made production-grade by [#136](https://github.com/Julestblt/Stride/issues/136). They live in the dedicated `Stride` workspace of the Anthropic organization.

| Path                         | Resource                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `agents/coach.md`            | Stride Coach: coordinator, plan designer and the athlete's only voice    |
| `agents/medical.md`          | Stride Medical, consulted by the Coach only                              |
| `skills/*/SKILL.md`          | Coaching knowledge loaded on demand (plan format, periodization, races…) |
| `environments/coaching.yaml` | Cloud environment, limited networking, MCP servers only                  |
| `claude-lock.json`           | Resource IDs written by `ant apply`, committed                           |

Both agents run on Claude Sonnet 5.5. Their only sandbox tool is `read`, which loads skills; there is no bash, file writing or web access. Stride data reaches the agents only through custom tools from the typed registry in `src/server/coaching/tools`, executed by the Stride server under the athlete's row-level security:

- `read_athlete_context` (Coach, Medical): compact context with today, profile, availability, upcoming races, recent running, training intensities, Garmin values with source and date, feasibility reference, last week's check-ins;
- `read_health_reports` (Coach, Medical): recent wellness check-ins;
- `read_active_plan`, `read_plan_progress` and `read_plan_history` (Coach): the plan for a range, planned-versus-completed status, and recorded proposals with their decisions;
- `submit_plan` and `create_plan_proposal` (Coach), which store validated proposals only;
- `ask_athlete` (Coach), which pauses the turn until the athlete answers.

The custom tool entries in `agents/*.md` are generated from the registry between the `# stride-tools:start` and `# stride-tools:end` markers. Never edit them by hand: change the tool module, run `npm run agents:tools`, and commit both. `npm run agents:tools:check` and `npm test` fail when a block drifts. The agent files are excluded from Prettier so the generated lines stay intact.

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

`status-reports`, `explain-decision` and `garmin-data-access` are derived from ai-running-coach v1.3.0 (MIT); see `skills/NOTICE` and the [skills inventory](../docs/architecture/coaching-engine/skills-inventory.md), which maps all 22 reference skills and describes the `read_plan_progress` and `read_plan_history` tools.

## Runtime

`POST /api/coach/turns` starts or resumes the signed-in athlete's session and streams the turn as server-sent events (`src/server/coaching/managed/session.ts`):

- a new session gets the athlete's vault, `stride_user_id` metadata and a budget cap ($1 for a conversation, $2 for a plan design), and a `coach_sessions` row under row-level security;
- a resumed session must exist in the athlete's own `coach_sessions` rows **and** carry the athlete's `stride_user_id` metadata, otherwise the API answers 404;
- custom tool calls run under the athlete's row-level security, only when the calling agent's thread is allowed the tool in `agentTools`; any other name, including one the model invents, is answered with `unknown_tool` without running anything. `ask_athlete` pauses the session (`awaiting_athlete`) until the athlete answers;
- a turn stops after 15 minutes: Stride sends `user.interrupt` and shows a French message; a session that reaches its budget is closed.

Accepted proposals are applied by the `stride-coach-worker` service, not by the web process. See [ADR 0009](../docs/adr/0009-coach-worker-runtime-on-postgres.md).

## Development page

`/coach` (development only) starts a conversation or plan design session after confirmation, streams the transcript with latency and cost, and lets the athlete approve, apply or reset plans. Applying and resetting go through the worker: run `npm run worker:build && npm run worker:start` with `COACH_WORKER_DATABASE_URL` in the worker's environment, and set `COACH_WORKER_URL` for the web process.

## Release procedure

Run from this directory, never from a parent directory, with a profile bound to the `Stride` workspace:

1. From the repository root, run `npm run agents:tools:check`; it must pass.

2. Dry run and read the plan. It must only change the files you edited:

   ```sh
   ant --profile Stride apply --dry-run agents/coach.md agents/medical.md environments/coaching.yaml
   ```

3. Apply after the owner approves the plan:

   ```sh
   ant --profile Stride apply agents/coach.md agents/medical.md environments/coaching.yaml
   ```

4. Commit `claude-lock.json` with the change, then run the dry run again: it must report everything up to date.

Editing an agent file creates a new agent version. New sessions use the latest version; running sessions keep theirs. Never pass `--force` or `--prune` without the owner's approval.

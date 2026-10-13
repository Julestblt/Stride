# Agent responsibilities

Agents are specialized actors selected by an orchestrator. Each has a narrow responsibility, declared inputs, allowed tools, and structured output. An agent is not a folder of prompts and is not interchangeable with a skill.

## Planned roles

The [coaching engine RFC](coaching-engine/agents-and-delegation.md) (#86, proposed) refines the earlier role list:

- **Coach:** the only tool-using agent. It merges the former orchestrator and training-coach roles: it understands the request, runs the workflow chosen by code, designs and adapts plans within computed bounds, synthesizes specialist opinions and explains decisions.
- **Sports Director:** race roles, season feasibility and spacing between races; a deterministic module with an optional bounded consult.
- **Course Strategist:** training implications of a race course, built on the race workspace's course analysis; race-day pacing stays in the race workspace.
- **Recovery & Health:** readiness assessment, red flags and load restrictions, never diagnosis.
- **Performance:** the deterministic Progression measures; no separate agent.
- **Nutritionist:** deferred; race fueling stays deterministic.

The roles above describe future responsibilities. They are not implemented agents. Specialists should not independently change athlete data or bypass application authorization.

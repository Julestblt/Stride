# AI runtime boundary

AI behavior belongs in a server-side runtime, separate from UI components and ordinary route composition. No provider or agent is implemented in the foundation.

As capabilities are added, keep these responsibilities distinct:

- Orchestration chooses the workflow and specialist.
- Agents apply explicit roles and limits.
- Skills provide reusable running-domain capabilities and structured procedures.
- Context building retrieves authorized athlete, activity, and training facts.
- Schemas validate inputs and structured outputs.
- Tool access mediates calls to domain services and integrations.
- Domain logic performs deterministic calculations outside the language model.
- Observability records safe operational metadata and outcomes.
- Evaluation checks behavior against curated coaching scenarios.

The runtime should receive explicit, permission-scoped context and return validated output. UI code should consume application APIs rather than call language-model providers directly. AI evaluations will complement, not replace, unit and integration tests.

## First capability: import insights (#52)

The onboarding import step uses the first runtime capability. Each responsibility stays separate:

- Domain logic: `src/features/insights/facts.ts` computes observations deterministically from normalized activities and recovery observations.
- Context building: `src/server/ai/context/history.ts` reads only the athlete's own `provider_activities` and `provider_observations` with their session under RLS.
- Provider access: `src/server/ai/provider.ts` calls an OpenAI-compatible endpoint (OpenCode Go, `deepseek-v4.1-flash`, reasoning disabled, JSON output, 20 s timeout). The key is server-only (`OPENCODE_API_KEY`).
- Skill: `src/server/ai/skills/history-insights.ts` sends only the computed sentences, validates the JSON output with Zod and rejects any sentence with a percentage or a number absent from its fact; rejected or missing sentences fall back to the deterministic text.
- Guardrails: the model runs only once the activity import is complete, results are cached in memory per athlete by facts hash, and at most one call per athlete per ten minutes is made. A typical call uses about 400 input and 200 output tokens.
- Observability: one structured log line per call records skill, model, outcome, accepted count, token usage and duration, never content.

The application route `GET /api/onboarding/insights` exposes the result to the UI. No identity, email or raw rows are sent to the provider; aggregated health metrics (HRV and sleep ranges) are. Production use requires confirming the provider's terms for application traffic and its data handling. Persisted insights and evaluations are follow-ups.

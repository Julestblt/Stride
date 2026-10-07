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

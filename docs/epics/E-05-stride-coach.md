# E-05: Stride Coach

## Objective

Offer an athlete a conversational way to understand training and review proposals using authorized, current context.

## Scope

- Server-side orchestration and provider boundary
- Context construction and access control
- Structured, validated responses with evidence and uncertainty
- Tool access to approved domain capabilities
- Observability and coaching evaluations
- Later, specialist roles for training, performance, recovery, and race strategy

## Dependencies

E-01 provides permission-scoped context. E-03 provides deterministic measures. Plan changes depend on E-04. Specialist agents are added only when their responsibilities and evaluations are explicit.

## Expected user value

Athletes can ask questions about their own training and receive grounded, understandable answers with clear limits.

## Major risks

- Unauthorized athlete context reaches a prompt or tool
- Fabricated metrics or unsafe certainty
- Provider-specific logic spreads into UI and route code
- Conversational evaluation is mistaken for ordinary unit testing

## Completion criteria

- UI code does not call LLM providers directly.
- Inputs and outputs are schema-validated and access-scoped.
- Missing evidence, provider errors, and out-of-scope health requests have defined behavior.
- A curated evaluation set covers usefulness, grounding, uncertainty, and safety before pilot release.

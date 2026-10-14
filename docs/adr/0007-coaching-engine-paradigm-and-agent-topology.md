# ADR 0007: Code-orchestrated coaching with one Coach agent and bounded specialists

- Status: Accepted (2026-10-13, #94); plan design by the single Coach confirmed by decision D10, specialist agents for conversations proposed in the [coaching team proposal](../architecture/coaching-engine/coaching-team-proposal.md)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

Stride will generate and adapt training plans with AI assistance. The reference project, ai-running-coach, uses five LLM agents (coach, sports director, course strategist, medical, nutritionist) that delegate to each other inside an IDE harness, with long procedural prompts and a deterministic guardrail engine. Stride is a multi-tenant web product that must be explainable, evaluable and safe, and ADR 0003 already isolates AI behavior in a server-side runtime.

## Decision

- Workflows are deterministic TypeScript code. Language-model steps return schema-validated intents or typed operations; deterministic code computes every number, date and constraint and validates every proposal.
- One Coach agent is the only tool-using agent.
- Sports Director, Course Strategist and Recovery & Health are deterministic modules first, plus at most one depth-one consult each per run that returns a validated `SpecialistOpinion`. Their constraints use a shared `ConstraintSpec` union enforced by the validator. Specialists have no tools and cannot call each other.
- Conflicts resolve in this order: safety, athlete constraints, race priority, progression, preference. Below safety, the Coach proposes the conservative option and states the alternative, or asks the athlete.
- The Nutritionist role is deferred; race fueling stays deterministic in the race workspace.

## Alternatives considered

- Five autonomous agents with delegation, as in the reference project.
- One agent with all instructions and tools.
- A fully deterministic engine with model phrasing only.

## Trade-offs

Most specialist work is calculation and becomes tested code, which lowers cost and makes behavior evaluable. The price is maintaining consult prompts and their trigger rules, and accepting that open-ended specialist reasoning is limited to one bounded call.

## Consequences

- Delegation depth is always one; circular delegation cannot be expressed.
- New specialist capabilities start as deterministic modules and earn a consult only when evaluations show judgment is needed.
- Evaluation covers the Coach's choices and each consult's opinions separately.
- Before Phase 2, the [topology benchmark](../architecture/coaching-engine/topology-benchmark.md) compares this topology with a single Coach loading skills on demand and with multi-agent delegation, on the same scenarios, knowledge corpus and validator. Its pre-registered rule either confirms this ADR, supersedes it, or adds multi-agent delegation as an opt-in mode.

# E-04: Training plans and adaptation

## Objective

Provide a complete training plan up to the athlete's main objective, tied to their goal, availability and observed training, with every week fully detailed and athlete control over every change.

## Scope

- Goal and schedule constraints, including time zone, weekly time ceiling and unavailable dates
- Plan creation for road 5 km to marathon, trail of every distance (low-confidence label above 60 km) and base building
- Every session of every week fully structured with computed pace, heart-rate or effort targets
- Plan presentation by blocks, weeks and sessions
- One active plan per athlete; races added later amend that plan, extending it when the race falls after its end ([ADR 0008](../adr/0008-versioned-plans-and-proposal-lifecycle.md), #141)
- Planned-versus-completed adherence and the Régularité measure
- Explicit rationale and source context for proposed sessions
- Athlete review, acceptance, rejection, and change history
- Adaptation rules that keep deterministic training constraints outside LLM judgment where practical

## Dependencies

E-01 provides goals and availability. E-03 provides trusted training context. Supported events and guardrails follow the product-owner decisions D1–D8 of 2026-10-13.

The accepted [coaching engine architecture](../architecture/coaching-engine/README.md) (#86) defines plan versioning, the proposal lifecycle, deterministic validation and the planning workflows this epic builds on. Product requirements FR-19 to FR-30 in the [PRD](../product/prd.md) and the [plan foundation spec](../specs/spec-plan-foundation/spec-plan-foundation.md) define the deterministic foundation.

## Expected user value

An athlete has a coherent, fully detailed plan to their objective that can be understood and adjusted with their coach.

## Major risks

- Plans ignore real-life constraints, recovery, or terrain
- Unsupported recommendations are presented as prescriptive training science
- A model changes an active plan without athlete approval
- Without human expert review, weak defaults go unnoticed; the validator, conservative conventions and automated evaluations must catch them

## Completion criteria

- Supported inputs, event types, constraints, and plan boundaries are documented (FR-19 to FR-22).
- A plan can be reviewed and rejected without changing the active plan.
- Changes have a visible rationale and history.
- Core plan rules and safety scenarios are covered by deterministic tests and coaching evaluations.

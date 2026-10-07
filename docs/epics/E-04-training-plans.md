# E-04: Training plans and adaptation

## Objective

Provide a practical weekly training proposal tied to an athlete's goal, availability, and observed training, with athlete control over changes.

## Scope

- Goal and schedule constraints
- Weekly plan creation and presentation
- Explicit rationale and source context for proposed sessions
- Athlete review, acceptance, rejection, and change history
- Adaptation rules that keep deterministic training constraints outside LLM judgment where practical

## Dependencies

E-01 provides goals and availability. E-03 provides trusted training context. The first supported event types and coaching guardrails must be chosen during discovery.

## Expected user value

An athlete has a coherent next week of training that can be understood and adjusted with their coach.

## Major risks

- Plans ignore real-life constraints, recovery, or terrain
- Unsupported recommendations are presented as prescriptive training science
- A model changes an active plan without athlete approval

## Completion criteria

- Supported inputs, event types, constraints, and plan boundaries are documented.
- A plan can be reviewed and rejected without changing the active plan.
- Changes have a visible rationale and history.
- Core plan rules and safety scenarios are covered by deterministic tests and coaching evaluations.

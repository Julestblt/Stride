# ADR 0012: Evidence-graded deterministic guardrails and a non-diagnostic health boundary

- Status: Accepted, amended by decision D8 (2026-10-13, #94)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

Coaching accuracy must not depend on model reasoning alone, and many popular training-load thresholds lack strong evidence: a randomized trial found no injury reduction from the 10% rule, and the acute:chronic workload ratio has been criticized as unsupported for injury prevention. The strongest recent evidence for recreational runners using Garmin devices concerns single-session spikes relative to the longest run of the previous 30 days. Stride's principles forbid diagnosis and presenting estimates as measurements.

## Decision

- A deterministic validator evaluates every proposal at submission and at apply. Its `block` results are final.
- Every rule declares a grade (`evidence`, `convention`, `integrity`), a severity (`block`, `warn`, `info`) and explicit skip conditions with reasons. A missing signal is never treated as favorable.
- Integrity rules (frozen history, base version, valid dates, athlete races untouched) and athlete constraints (availability, declared limits, specialist constraints) block.
- Single-session distance more than 30% above the longest run of the previous 30 days is a strong warning that the proposal must state; 10–30% warns. As in the reference project, which blocks only on a red health verdict, the athlete decides on warnings.
- Weekly progression caps, elevation caps, long-run share, back-to-back quality and intensity distribution warn and are labeled conventions. The acute:chronic ratio is information only.
- Health boundary: declared pain from 7/10, worsening pain, illness with systemic symptoms or other red flags stop running proposals and show referral copy; pain from 4/10 blocks quality sessions and load increases until reassessed. These thresholds are conservative conventions. No clinician or coach reviews them (D8); they change only through a reviewed pull request with tests and an evaluation run.
- The engine never diagnoses, names conditions, recommends treatment or clears a return to running. Passing the validator is never presented as medical safety.
- Thresholds live in one versioned configuration module; changes require tests and an evaluation run.
- Without human expert review, the validator, conservative defaults and the automated evaluation suite with an LLM judge are the quality gates; the judge never overrides a rule.
- Event scope: road 5 km to marathon and trail of every distance. Plans for events above 60 km carry a low-confidence label instead of being refused.

## Alternatives considered

- Reusing the reference project's seven rules unchanged.
- Model-only judgment with prompt rules.
- A clinical-style injury risk score.

## Trade-offs

Keeping blocks to integrity, declared constraints and health leaves room for the Coach's judgment and the athlete's control, at the cost of relying on clearly stated warnings for load progression. Evidence grades make the system honest about uncertainty and easy to revise as evidence or pilot data changes.

## Consequences

- Each rule has boundary tests and an evaluation scenario.
- Explanations cite the rule, its grade and the observed values, so the athlete sees why a change was blocked or flagged.

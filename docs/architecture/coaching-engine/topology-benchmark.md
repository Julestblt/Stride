# Topology benchmark: orchestrated Coach versus multi-agent delegation

- Status: Accepted protocol, run pending (issue [#119](https://github.com/Julestblt/Stride/issues/119))
- Decision record: [ADR 0007](../../adr/0007-coaching-engine-paradigm-and-agent-topology.md), decision D9 in [risks and decisions](risks-and-decisions.md)
- Runs in Phase 2, once the model gateway, tools, coach worker runtime and evaluation harness exist, and before Phase 3 fixes the plan-design workflow.

## Question

Does a multi-agent topology like the reference project ai-running-coach produce measurably better plans than Stride's orchestrated Coach, and at what cost? The product owner wants the most accurate coaching and asked to decide from measurements graded by several AI judges, not by inspection. Offering both topologies in the app is considered only if the results justify it.

## Topologies

| Topology | Description                                                                                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A        | The [target architecture](target-architecture.md): code-orchestrated workflow, one Coach agent with tools, deterministic Sports Director, Course Strategist and Recovery & Health modules, at most one bounded consult per specialist, no Nutritionist.                                                                                        |
| B        | Multi-agent delegation modelled on ai-running-coach: five LLM agents (Coach, Sports Director, Course Strategist, Medical, Nutritionist), each with its own instructions and the read tools relevant to its role. The Coach delegates to specialists, which may delegate once more (depth at most two). The Coach writes the final plan design. |

Everything else is identical, so the comparison isolates the orchestration:

- same models and routing (Opus 5.5 for plan design, Sonnet 5.5 for specialists and consults, Haiku 5.5 for extraction), same effort settings and per-run caps scaled for B's extra calls;
- same typed tools, context packet, deterministic modules (history, targets, templates, skeleton, feasibility, session library) and validator;
- same repair loop (two repairs, then the deterministic fallback) and same numeric guard on explanations;
- same output: a `create_plan` proposal with every week fully detailed (D6).

## Scenarios

- 20 to 30 synthetic athletes taken from the [scenario catalogue](observability-and-evaluation.md#scenario-catalogue-initial) and extended to cover every event family: novice 10 km, regular half and marathon runners, trail 25 km and 50 km, ultra 100 km, 100 miles, short history, import in progress, no heart-rate calibration, declared pain, unrealistic target, preparation race before an A race, tight availability, weekly ceiling and unavailable weeks.
- The product owner's real profile, judged only by Anthropic models and the owner (see data handling).
- Three repetitions per scenario and topology, because model outputs vary.

## Measures

### Deterministic, computed by code

| Measure                                                                               | Expected direction |
| ------------------------------------------------------------------------------------- | ------------------ |
| Proposals with a blocking validator result after repairs                              | 0 for both         |
| Warnings per plan (strong and normal)                                                 | Lower is better    |
| Safety scenarios ending with a stop and referral, no quality proposed, in 3 of 3 runs | 100% for both      |
| Explanations containing a number absent from the facts                                | 0 for both         |
| Schema-valid outputs without repair                                                   | Higher is better   |
| Sessions with a complete structure and a target per step                              | 100% for both      |
| Model calls, input and output tokens, cost and wall-clock time per plan               | Measured           |

### Judged

- **Judges from three model families**: Claude Opus 5.5, an OpenAI model and a Google model from the current pricing table, so no family judges only its own outputs.
- **Blind pairwise comparison**: each judge sees the athlete context and two plans labelled "Plan 1" and "Plan 2", never the topology. Every pair is judged twice with the order swapped; a preference counts only when it survives the swap, otherwise it is a tie.
- **Written rubric**, 1 to 5 per criterion, with anchors for each level: appropriateness to the athlete, progression and load management, specificity to the race, recovery placement, individualization from the athlete's data, clarity of the French explanation. The judge also gives an overall preference and flags any plan it considers unsafe.
- **Calibration before trust**: each judge first grades plans with seeded defects (single-session spike, missing taper, back-to-back quality, quality the day after a red readiness, a health report ignored). A judge counts only if it flags at least 90% of them.
- The rubric, the seeded defects and the judge prompts are versioned in the repository with the results.

### Owner review

For the owner's real profile, both plans are shown blind and in random order. The owner records a preference and a short reason. This is the only human judgment and is reported separately.

## Decision rule

Fixed before the run:

1. **Safety gate**: a topology that fails a safety scenario, produces a blocking result after repairs or invents a number is not eligible.
2. **Quality**: B is better only if, across calibrated judges, its pairwise win rate is at least 60% with the lower bound of the 95% confidence interval above 50%, its mean rubric score is at least 0.3 higher, and at least two of the three judge families agree on the direction.
3. **Outcome**:
   - B not better: keep A only; B's runner stays in the evaluation suite as a reference and is not shipped.
   - B better and its expected cost per plan at most 1.5 times A's: B becomes the default topology; ADR 0007 is superseded.
   - B better but more than 1.5 times A's cost: A stays the default and B is offered as an opt-in "mode approfondi" whose expected cost is shown to the athlete.
4. If the owner's blind preference contradicts the judges on the owner's profile, the result is reported as such and the owner decides.

## Budget

About 150 to 300 USD of model usage: roughly 180 plan generations at 0.7 to 3 USD each and a few tens of dollars of judging. The live run starts only after the owner confirms the budget with the dry-run cost estimate.

## Data handling

- Only synthetic athletes are sent to the non-Anthropic judges. The owner's real data stays with Anthropic models, consistent with D1.
- Judge providers are used for evaluation only, with their own keys, never in the product.

## Threats to validity

| Threat                                      | Mitigation                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Judges prefer longer or more confident text | Rubric anchors on substance, explanation length capped by the same output schema |
| Judges prefer their own family              | Three families, agreement of at least two required                               |
| Position bias                               | Every pair judged in both orders                                                 |
| B's prompts less tuned than A's             | Same tuning budget for both; B's role prompts adapted from the reference project |
| Synthetic athletes miss real-world variety  | Event-family coverage, edge cases and the owner's real profile                   |
| Small sample                                | Three repetitions, confidence interval in the decision rule                      |

## Outputs

- A results table per scenario and topology with every measure, committed with the evaluation suite.
- A summary in this document and the outcome recorded in ADR 0007.

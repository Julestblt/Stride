# Topology benchmark: single agent, single agent with skills, multi-agent delegation

- Status: Accepted protocol, run pending (issue [#119](https://github.com/Julestblt/Stride/issues/119))
- Decision record: [ADR 0007](../../adr/0007-coaching-engine-paradigm-and-agent-topology.md), decision D9 in [risks and decisions](risks-and-decisions.md)
- Runs at the end of Phase 1, before the Phase 2 model gateway is built, so its outcome shapes the Phase 2 runtime. Results are committed in the pull request that runs it.

## Question

Is multi-agent delegation like the reference project ai-running-coach worth its complexity and cost compared with a single Coach, and does a single Coach that loads skills on demand sit in between? The product owner wants the most accurate coaching, decided from measurements graded by several AI judges, not by inspection.

## Arms

Three arms receive the same knowledge corpus, the same athlete facts and the same output contract. Only the way the knowledge reaches the model differs, so the comparison isolates the topology.

| Arm | Topology                 | How the knowledge corpus is used                                                                                                                                                                                                                                                                                |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Single agent             | One Coach call holds the whole corpus in its instructions and writes the plan.                                                                                                                                                                                                                                  |
| C   | Single agent with skills | One Coach sees only the skill index. It loads the skills it needs (at most four loads), then writes the plan.                                                                                                                                                                                                   |
| B   | Multi-agent delegation   | Modelled on ai-running-coach: a Coach and four specialists (Sports Director, Course Strategist, Medical, Nutritionist), each owning one part of the corpus. The Coach delegates questions, a specialist may consult one other specialist (depth at most two), and the Coach writes the plan from their answers. |

Shared by every arm:

- **Corpus**: five sections (periodization and load, race and terrain specificity, health and recovery, fueling, session design and paces) derived from Stride's validator thresholds, the [Phase 1 spec](../../specs/spec-plan-foundation/spec-plan-foundation.md) and the rules ported from ai-running-coach. In C each section is a skill; in B each specialist owns one section and the Coach owns session design.
- **Athlete facts**: a context packet computed by code (profile, availability, races, history summary, health reports). No model sees raw provider data.
- **Output contract**: one compact plan JSON with every week detailed (D6): week type and targets, then every session with its day, kind, duration, distance, elevation and structured steps with a pace, heart-rate or RPE target per work step. Code converts it into Stride's `PlanState` and checks it with `planStateSchema`.
- **Validator and repair**: the Phase 1 validator (`validatePlan`) runs on every plan. A schema failure or a blocking result triggers one repair turn with the error list, identical in all arms. A plan still invalid after the repair counts as a failure.
- **Generator model**: Claude Sonnet 5.5 for every role in every arm, same effort. Production plan design targets Opus 5.5 (D1); Sonnet is used because the run must fit a Max 5x subscription, and it does not favour any arm.

## Execution

The benchmark runs through the official subscription CLIs as plain text transport, so it costs no API money; it consumes subscription quota and wall-clock time instead. Every call runs in an empty temporary directory with a replaced system prompt, no built-in tools, no MCP servers and no project instructions, so the CLI harness does not leak into the comparison. Delegation, consults and skill loads are a JSON protocol executed by the benchmark harness, identical for every model.

| Role                | Model                      | Transport            |
| ------------------- | -------------------------- | -------------------- |
| All generator roles | Claude Sonnet 5.5          | `claude -p` (Max 5x) |
| Judge 1             | GPT-6 Luna (OpenAI)        | `codex exec` (Plus)  |
| Judge 2             | Gemini 4 Argon (Google)    | `opencode run` (Go)  |
| Judge 3             | DeepSeek V4 Pro (DeepSeek) | `opencode run` (Go)  |

No judge belongs to the generator's family. API-equivalent cost per plan is read from the generator CLI's usage report and compared at list prices.

The harness lives in `evals/topology/`, outside the product code, and imports only Phase 1 domain modules.

## Scenarios

Eight synthetic athletes, each run twice per arm (48 plans):

| ID  | Athlete                                                                                 | What it tests                              |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| S1  | Novice, 10 km in 10 weeks, three days a week                                            | Conservative build, simple sessions        |
| S2  | Regular runner, half marathon in 1 h 45 in 12 weeks                                     | Classic road progression and taper         |
| S3  | Experienced runner, marathon in 3 h 30 in 14 weeks                                      | Long-run progression, specific pace work   |
| S4  | Trail 32 km with 1,600 m of climbing in 10 weeks                                        | Elevation progression, hills, terrain      |
| S5  | Ultra 80 km in 14 weeks (EcoTrail-like), above 60 km                                    | Ultra volume, back-to-back, low-confidence |
| S6  | Half marathon with an active, worsening knee pain report                                | Safety: stop and referral, no quality      |
| S7  | Four weeks of history, marathon target in 3 h from a 4 h 10 runner, 8 weeks             | Unrealistic target, short history          |
| S8  | Preparation 10 km three weeks before an A half, three days a week, one unavailable week | Race roles, tight availability, constraint |

A ninth scenario (S0, a regular 10 km runner) is the tuning set: prompts are adjusted only on S0, with the same effort for every arm, before the run starts. The owner's real profile is excluded from this run; it stays with Anthropic models only (D1).

## Measures

### Deterministic, computed by code

| Measure                                                                 | Expected direction |
| ----------------------------------------------------------------------- | ------------------ |
| Plans invalid after the repair (schema or blocking validator result)    | 0                  |
| Schema-valid and non-blocking on the first attempt                      | Higher is better   |
| Validator warnings per plan                                             | Lower is better    |
| S6 plans that schedule any quality session                              | 0 in every run     |
| Model calls, input and output tokens, API-equivalent cost and wall time | Measured           |

### Judged

- Each judge receives the athlete facts and the three plans of one scenario repetition rendered as the same compact French weekly table, labelled Plan 1, Plan 2 and Plan 3, never the arm.
- Each triplet is judged three times with the order rotated so every plan appears once in every position. An arm's rank is its mean over the rotations.
- Written rubric, 1 to 5 with anchors per level: appropriateness to the athlete, progression and load management, race specificity, recovery placement, individualization from the athlete facts, clarity of the French explanations. The judge also tags each plan with defects from a fixed list (load spike, missing taper, back-to-back quality, quality despite a health report, ignored availability, unrealistic target accepted, unsafe long run) and ranks the three plans.
- **Calibration before trust**: before the run each judge audits four plans with seeded defects (load spike, missing taper, back-to-back quality, quality despite a health report). A judge counts only if it tags at least three of the four seeded defects; otherwise its scores are reported but not used for the decision.

Judging volume: 16 triplets × 3 rotations × 3 judges = 144 calls, plus 12 calibration calls.

### Owner review

After the run, the owner reviews S4 and S5 blind (the scenarios closest to their own racing), ranks the three plans and gives a short reason. This is reported separately and does not change the rule.

## Decision rule

Fixed before the run. Complexity order: A < C < B.

1. **Safety gate**: an arm is not eligible if any of its plans schedules quality in S6 or stays invalid after the repair in more than one of its 16 plans.
2. **Clearly better**: an arm X is clearly better than a simpler arm Y when, for at least two of the calibrated judges, X ranks above Y in at least 12 of the 16 triplets (a tie counts against X), and X's mean rubric score across calibrated judges is at least 0.3 higher.
3. **Outcome**:
   - Keep the simplest eligible arm unless a more complex arm is clearly better than it.
   - If B is clearly better than both A and C and costs at most 1.5 times the simplest eligible arm per plan, B becomes the default and ADR 0007 is superseded.
   - If B is clearly better but costs more than 1.5 times, the simpler arm stays the default and B is offered as an opt-in "mode approfondi" whose expected cost is shown to the athlete.
   - If C is clearly better than A and B is not clearly better than C, C becomes the target: one Coach with on-demand skills.
4. If the owner's blind ranking contradicts the judges, the result is reported as such and the owner decides.

With 16 triplets the rule only accepts a large effect (75% of wins). This is intended: a topology that is not clearly better on this set does not justify its added complexity.

## Budget

No API spending. The run uses about 130 Sonnet calls on Claude Max 5x, about 50 calls on Codex Plus and about 100 calls on OpenCode Go, and takes about two to three hours of wall-clock time. API-equivalent cost is reported for each arm.

## Data handling

Only synthetic athletes are used. Judge providers are used for evaluation only, never in the product.

## Threats to validity

| Threat                                      | Mitigation                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sonnet instead of Opus for plan design      | Same model in every arm; a confirmation on Opus can follow if the result is close         |
| Judges prefer longer or more confident text | Same output contract and rendering for every arm; rubric anchored on substance            |
| Judge family bias                           | Three judge families, none from the generator's family; two must agree                    |
| Position bias                               | Three rotations per triplet                                                               |
| Uneven prompt tuning                        | One shared corpus; tuning only on S0 with equal effort per arm                            |
| Small sample                                | Two repetitions; the rule requires a large effect                                         |
| Synthetic athletes miss real-world variety  | Road, trail, ultra, safety, short history and multi-race cases; owner review on S4 and S5 |

## Outputs

- `evals/topology/results/`: every generated plan, judge output and the computed results table, committed in the pull request that runs the benchmark.
- A results summary in this document and the outcome recorded in ADR 0007.

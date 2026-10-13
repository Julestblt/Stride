# Agents, specialists and delegation

- Status: Proposed (RFC #86)
- Decision record: [ADR 0007](../../adr/0007-coaching-engine-paradigm-and-agent-topology.md)

## Roles

The reference project's five-person staff is kept as a vocabulary, not as five autonomous agents. Each role is implemented as the cheapest reliable mechanism: deterministic code first, a single structured model call when judgment is needed, and a tool-using agent only for the Coach.

| Role              | Implementation                                                                                                                                | Owns                                                                                                                               | Never                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Coach             | The only tool-using agent; orchestrated by workflow code                                                                                      | Conversation, plan design within computed bounds, adaptation choices, synthesis of specialist opinions, explanations               | Writes plan state; overrides a validator block or a health hard stop; invents data         |
| Sports Director   | Deterministic race-calendar module + optional consult                                                                                         | Race roles (primary, secondary, preparation, incompatible) for the plan, season feasibility, spacing and taper conflicts           | Edits the athlete's races or priorities; searches the web; proposes races                  |
| Course Strategist | Deterministic race-demands module (from the E-06 course data) + optional consult                                                              | Training implications of a course: duration range, climbing and descending demands, technical sections, night or altitude exposure | Produces race-day pacing (stays in the race workspace)                                     |
| Recovery & Health | Deterministic readiness assessment and health boundary + optional consult; Haiku extraction for free-text symptoms (confirmed by the athlete) | Readiness state, red flags, load restrictions, referral triggers                                                                   | Diagnoses, names a pathology, prescribes treatment or medication, clears return to running |
| Nutritionist      | Deferred                                                                                                                                      | —                                                                                                                                  | —                                                                                          |
| Performance       | Deterministic `progress` measures (existing)                                                                                                  | Trends, records, estimates with confidence                                                                                         | —                                                                                          |

The proposal origins in the design references map onto these roles: **Entraînement** (Coach), **Récupération** (Recovery & Health), **Performance** (Performance measures), **Agenda** (athlete availability and schedule changes), **Course** (Sports Director or Course Strategist).

## When a specialist is consulted

| Trigger (evaluated by code)                                                                                     | Specialist        | Consult or module only                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Initial plan with two or more future races, or a goal flagged ambitious or unrealistic by the feasibility check | Sports Director   | Consult                                                                                                                             |
| Athlete adds, removes or reprioritizes a race while a plan is active                                            | Sports Director   | Consult                                                                                                                             |
| Specific phase for a race that has course data                                                                  | Course Strategist | Module; consult only when demands are unusual (for example more than 60 m of climbing per km, more than 4 hours, or night sections) |
| Active pain or illness report, red readiness, or an athlete request mentioning fatigue, pain or illness         | Recovery & Health | Module always; consult when the athlete's text needs interpretation or the adaptation trades off health signals                     |
| Missed key session, schedule change, travel                                                                     | None              | Coach alone with validator                                                                                                          |
| Simple question about the plan or data                                                                          | None              | Coach alone                                                                                                                         |

Limits enforced by the runtime: at most one consult per specialist per run, at most three consults per run, specialists have no tools, and a specialist cannot request another specialist. Delegation depth is therefore always one, and circular delegation cannot be expressed.

## Shared athlete context packet

Every run starts from a deterministic `AthleteContextPacket`, versioned and built under RLS. Specialists receive a role-specific subset.

| Section         | Contents                                                                                                                                                                            | Budget        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Athlete         | Age band, sex for physiological estimates, terrain preference, availability (weekdays, long-run day, weekday minutes, access to hills, treadmill, gym, track), injury history flags | ~300 tokens   |
| Goals           | Goal focus; races with date, distance, elevation, kind, athlete priority, target time, course demands when present                                                                  | ~400 tokens   |
| History summary | Last 16 weeks: weekly running duration, distance and elevation; longest run in the last 30 days; key-session count; consistency; data coverage                                      | ~900 tokens   |
| Performance     | Recent records and estimates with confidence and age                                                                                                                                | ~250 tokens   |
| Readiness       | Last 14 days of HRV against usual range, resting HR, sleep, Garmin readiness and load, check-ins, active condition reports, missing-data flags                                      | ~600 tokens   |
| Plan            | Current block, week targets, upcoming sessions, recent adherence, pending proposals                                                                                                 | ~1,200 tokens |
| Memory          | Active facts with provenance ("Ce que je sais de toi")                                                                                                                              | ~400 tokens   |
| Data quality    | Sync state per category, oldest synchronized date, last success, calibration gaps                                                                                                   | ~200 tokens   |

Every value carries provenance (`source`, `as_of`, `window`). The packet contains no email, Garmin identifiers or free-text notes unless the task needs them; free text is wrapped as untrusted data ([security](security.md)). Target size is under 5,000 tokens, which keeps every workflow's prefix cacheable.

## Output contracts

All model outputs are validated with Zod before use. Invalid output is retried once with the validation errors, then the step fails into a deterministic fallback.

```ts
type EvidenceRef = {
  kind:
    | "activity"
    | "observation"
    | "checkin"
    | "condition"
    | "plan_session"
    | "race"
    | "rule"
    | "fact";
  id: string;
  observedOn?: string;
  source: "garmin" | "athlete" | "stride";
  metric?: string;
  value?: number;
};

type ConstraintSpec =
  | { type: "max_weekly_duration_min"; value: number; until?: string }
  | { type: "max_session_duration_min"; value: number; until?: string }
  | { type: "no_quality_sessions"; until: string }
  | { type: "no_running"; until: string }
  | {
      type: "avoid_terrain";
      terrain: "long_descents" | "technical" | "steep_climbs";
      until?: string;
    }
  | { type: "keep_session"; sessionKey: string }
  | {
      type: "race_role";
      raceId: string;
      role: "primary" | "secondary" | "preparation" | "incompatible";
    }
  | { type: "taper_window"; raceId: string; startsOn: string };

type SpecialistOpinion = {
  specialist: "sports_director" | "course_strategist" | "recovery_health";
  summaryFr: string;
  recommendations: {
    code: string;
    detail: string;
    priority: "must" | "should" | "could";
  }[];
  constraints: ConstraintSpec[];
  confidence: "low" | "moderate" | "high";
  missingData: string[];
  referral: { recommended: boolean; reasonCode?: string };
  evidence: EvidenceRef[];
};

type ReadinessAssessment = {
  state: "green" | "amber" | "red" | "unknown";
  signals: {
    code: string;
    direction: "favorable" | "unfavorable" | "neutral";
    evidence: EvidenceRef;
  }[];
  hardStops: { code: string; reason: string }[];
  missingData: string[];
  asOf: string;
};

type RaceDemands = {
  raceId: string;
  distanceM: number;
  elevationGainM?: number;
  elevationLossM?: number;
  expectedDurationS?: { low: number; high: number };
  longestClimb?: { gainM: number; lengthM: number };
  steepSectionsShare?: number;
  nightExposure?: boolean;
  confidence: "low" | "moderate" | "high";
};
```

Specialist constraints are not advice to be paraphrased: the validator enforces them, so a Recovery & Health `no_quality_sessions` constraint makes any proposal with a quality session invalid until the date passes.

## Reconciling disagreements

1. Safety first: validator blocks and health hard stops win, always.
2. Athlete constraints: availability, declared limits, kept sessions.
3. Race priority: plan race roles decided with the Sports Director and the athlete.
4. Progression: the Coach's training logic.
5. Preference: comfort, variety, timing.

When two specialists disagree on something below safety, the Coach does not average them. It proposes the more conservative option and states the alternative in the proposal ("Option non retenue"), or asks the athlete a targeted question when the choice depends on their priorities. Every opinion and its resolution is stored in the proposal for the ledger.

## Independent validation

| Check                         | When                                                                               | Independent of the model?                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Deterministic validator       | Every proposal, at submission and at apply                                         | Yes                                                                              |
| Numeric guard on explanations | Every athlete-facing explanation                                                   | Yes                                                                              |
| Schema validation             | Every model output                                                                 | Yes                                                                              |
| LLM critic review             | Not in V1; evaluated as an option for initial plans and block revisions            | No, and only adopted if evaluations show it catches defects the validator misses |
| Human coach review            | Templates, rules, evaluation rubric, and sampled plans before and during the pilot | Yes                                                                              |

Passing these checks means a proposal respects Stride's rules and the athlete's declared constraints. It does not mean the plan is medically safe; the proposal copy never claims that.

## Prompt architecture

- A fixed system prompt per agent states role, boundaries, output contract and French tone rules. Workflow-specific skill modules (plan design, session adjustment, weekly review, explanation, questions) are appended in a fixed order. Together they form the cached prefix.
- The context packet follows the prefix, then the conversation (one thread per day, as in the Coach design reference), then tool results.
- Prompts are versioned files; the version is recorded on every step. Prompts never contain configuration mapping, data-source logic or thresholds — those live in code, which avoids the reference project's 52 KB prompts.
- Output language is French for anything the athlete reads; identifiers and schemas stay English.

## Model and budget per role

| Role and task                                            | Model                                  | Effort | Calls per run   | Output cap    |
| -------------------------------------------------------- | -------------------------------------- | ------ | --------------- | ------------- |
| Coach: questions and explanations                        | Sonnet 5.5                             | low    | ≤ 3             | 1,500 tokens  |
| Coach: session and week adaptations                      | Sonnet 5.5                             | medium | ≤ 4             | 3,000 tokens  |
| Coach: plan design (initial, block revision, multi-race) | Opus 5.5                               | high   | 1 + ≤ 2 repairs | 16,000 tokens |
| Coach: weekly review                                     | Sonnet 5.5 (Batch API when not urgent) | medium | ≤ 2             | 4,000 tokens  |
| Sports Director consult                                  | Sonnet 5.5                             | high   | ≤ 1             | 3,000 tokens  |
| Course Strategist consult                                | Sonnet 5.5                             | medium | ≤ 1             | 2,500 tokens  |
| Recovery & Health consult                                | Sonnet 5.5                             | medium | ≤ 1             | 2,000 tokens  |
| Routing, extraction, phrasing                            | Haiku 5.5                              | low    | ≤ 2             | 800 tokens    |

Per-run caps and quotas are in [models and costs](models-and-costs.md#budgets-quotas-and-timeouts).

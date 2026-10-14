---
id: SPEC-plan-foundation
companions:
  - ../../architecture/coaching-engine/README.md
  - ../../architecture/coaching-engine/deterministic-coaching.md
  - ../../architecture/coaching-engine/data-model.md
  - ../../architecture/coaching-engine/workflows.md
  - ../../adr/0005-shared-supabase-schema-ownership.md
  - ../../adr/0008-versioned-plans-and-proposal-lifecycle.md
  - ../../adr/0012-evidence-graded-guardrails-and-health-boundary.md
sources:
  - ../../epics/E-04-training-plans.md
  - ../../product/prd.md
  - ../../architecture/coaching-engine/risks-and-decisions.md
---

# Deterministic plan foundation (coaching engine Phase 1)

## Why

The coaching engine lets a model design and adapt plans only inside bounds that code computes and checks. Those bounds, the plan model, its storage and the screens that show it must exist before any model call. The product owner decided that every week is fully detailed at creation (D6) and that no human expert reviews plans (D8), so the deterministic modules carry the whole quality and safety load in this phase and remain the fallback in every later one. At the end of Phase 1, Stride builds a complete, validated plan for the athlete's main objective from their own data, shows it, and has the versioned storage and adherence model ready for the coach worker of Phase 2.

## Capabilities

Each capability maps to one GitHub issue under parent [#95](https://github.com/Julestblt/Stride/issues/95), delivered in this order.

| Capability | Issue | Requirements         |
| ---------- | ----- | -------------------- |
| CAP-1      | #96   | FR-23, FR-26, FR-27  |
| CAP-2      | #97   | FR-20                |
| CAP-3      | #98   | FR-24                |
| CAP-4      | #99   | FR-25, NFR-10        |
| CAP-5      | #100  | FR-19, FR-21, FR-22  |
| CAP-6      | #101  | FR-23, FR-24         |
| CAP-7      | #102  | FR-30, NFR-06        |
| CAP-8      | #103  | FR-26, FR-27, NFR-01 |
| CAP-9      | #104  | FR-28, FR-29         |

- **CAP-1 Plan domain model and typed operations**
  - **intent:** A pure TypeScript model of plans, blocks, weeks and sessions with stable keys, a strict session structure schema, the closed operation union and the changeset computation that protects frozen sessions.
  - **success:** Every operation has success and rejection tests; a one-session change yields a changeset touching only that session's key; a structure whose steps miss the declared duration by more than 10% is rejected; the module imports nothing from React, Next.js or Supabase.
- **CAP-2 Planning constraints**
  - **intent:** The athlete declares a time zone, a maximum weekly training time and unavailable date ranges in Settings → Entraînement; plan code reads them with Europe/Paris as the explicit fallback.
  - **success:** Values persist across refresh and devices, another athlete cannot read or write them, and an unavailable period ending before it starts is refused with a French message.
- **CAP-3 Training targets**
  - **intent:** A deterministic module turns the athlete's data into pace ranges, heart-rate ranges and RPE descriptors per intensity, each with its source, date and confidence, plus the list of calibration gaps.
  - **success:** Fixtures with threshold data, race-only data, VO₂ max only and no reliable data produce the expected targets and labels; ranges are ordered for every fixture; no heart-rate range is ever produced without calibration.
- **CAP-4 Validator and rule catalogue**
  - **intent:** A pure validator evaluates a candidate plan state and its neighbouring weeks against the rule catalogue of [deterministic coaching](../../architecture/coaching-engine/deterministic-coaching.md#rule-catalogue) and returns a structured report.
  - **success:** Every rule has tests just below, at and above its threshold plus a skip test; missing data yields `skipped`, never a pass; the Garmin load ratio never blocks; identical input yields an identical report.
- **CAP-5 Templates, skeleton and feasibility**
  - **intent:** Code resolves the objective, summarizes history, selects an event-family template and builds a skeleton of blocks, weeks and weekly targets to race day, with a feasibility verdict.
  - **success:** Fixtures from 5 km to a 100+ km trail produce skeletons the validator never blocks; taper and recovery-week invariants hold; short history selects base building with low confidence; an impossible timeline yields `unrealistic` with alternatives.
- **CAP-6 Session library and complete detailing**
  - **intent:** A parameterized session library and a detailing step turn a skeleton into a complete plan where every session has a structure and computed targets; `buildDeterministicPlan` is the single entry point.
  - **success:** Every session of every fixture plan has a structure that sums to its duration within 10% and a target per step; key-session progression is monotonic within a block and resets after recovery weeks; no fixture plan is blocked.
- **CAP-7 Read-only plan screens**
  - **intent:** The Plan destination renders the athlete's deterministic plan, built on request from their real data, by blocks, weeks and sessions, labeled as an unsaved draft.
  - **success:** An onboarded athlete with a race sees a complete plan to race day and opens any session's full detail; every number comes from the deterministic modules; desktop and mobile match the references; empty and degraded states are honest.
- **CAP-8 Plan and proposal schema with versioned apply**
  - **intent:** Migrations, RLS and private functions store plans as immutable versions of revisioned rows, proposals and decisions, and enforce frozen history in SQL.
  - **success:** pgTAP proves cross-athlete isolation, no direct athlete writes to plan rows or proposals, stale-version and frozen-session rejection, and that reading version `v` returns exactly its rows.
- **CAP-9 Matching and Régularité**
  - **intent:** A deterministic matcher links activities to planned sessions, matches are persisted with an athlete override, and Progression's Régularité uses them.
  - **success:** Fixture tests cover same-day, moved, split, substituted and missed sessions; an override survives recomputation; without an active plan Régularité keeps its empty state.

## Shared contracts

These contracts are shared by several issues. Each issue may refine names while keeping the shape.

### Module layout

| Path                             | Owner                      | Content                                                            |
| -------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `src/features/plans/model`       | CAP-1                      | Types, Zod schemas, keys, structure totals                         |
| `src/features/plans/operations`  | CAP-1                      | Operation union, `applyOperations`, changeset                      |
| `src/features/plans/targets`     | CAP-3                      | `TrainingTargets` computation                                      |
| `src/features/plans/validation`  | CAP-4                      | Rules, thresholds module, report                                   |
| `src/features/plans/history`     | CAP-5                      | History summary over normalized activities                         |
| `src/features/plans/templates`   | CAP-5                      | Event-family templates (data)                                      |
| `src/features/plans/skeleton`    | CAP-5                      | Objective resolution, workload envelope, blocks and weekly targets |
| `src/features/plans/feasibility` | CAP-5                      | Verdict, reasons and alternatives                                  |
| `src/features/plans/library`     | CAP-6                      | Parameterized sessions                                             |
| `src/features/plans/detailing`   | CAP-6                      | Placement, sizing, targets, `buildDeterministicPlan`               |
| `src/features/plans/matching`    | CAP-9                      | Matcher and adherence                                              |
| `src/server/plans`               | CAP-2, CAP-7, CAP-8, CAP-9 | Server reads and RPC calls under the athlete session               |
| `src/app/(app)/plan`             | CAP-7                      | Plan, week and session routes                                      |

Every module under `src/features/plans` is pure: no React, Next.js, Supabase or model import, and no access to the clock except through an explicit `today` and time zone argument.

### Plan model

- **Plan:** id, title, `startsOn`, `endsOn`, `timeZone`, primary race id (nullable), race roles (`primary`, `preparation`, `secondary`), confidence (`normal`, `low`) and the reasons for a low label.
- **Block:** `blockKey`, kind (`lead_in`, `base`, `build`, `specific`, `taper`, `race`, `recovery`, `transition`), name, `startsOn`, `endsOn`, objective, race id.
- **Week:** `weekKey`, `weekStart` (Monday in the plan time zone), `blockKey`, `weekType` (`lead_in`, `build`, `recovery`, `taper`, `race`, `post_race`), targets for duration, distance, elevation, quality sessions, long run and intensity split.
- **Session:** `sessionKey`, `scheduledOn`, `sport` (`run`, `trail`, `strength`, `cross`, `rest`), `kind` (`easy`, `long`, `recovery`, `tempo`, `threshold`, `intervals`, `hills`, `race_specific`, `race`, `strength`, `mobility`, `cross`, `rest`), French `title` and `purpose`, `isKey`, `priority`, `targets`, `structure`, `terrain`, `origin` (`template`, `coach`, `athlete`), contingency hints.
- **Keys** are stable, deterministic strings derived from the plan and the logical slot (for example a week key from its Monday, a session key from its week, day and slot), so an unchanged slot keeps its key across versions.
- **Frozen session:** dated before the athlete's local today, or matched to an activity. Frozen sessions are never changed by an operation.

### Session structure

Ordered steps compatible with how watches describe workouts:

| Field    | Values                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| `type`   | `warmup`, `work`, `recovery`, `cooldown`, `repeat`                            |
| `end`    | `time` (seconds), `distance` (metres), `lap_button`                           |
| `target` | `pace_range` (seconds per km), `heart_rate_range` (bpm), `rpe` (1–10), `none` |
| `repeat` | count (2–50) and nested steps, one level deep                                 |
| `cue`    | optional short French instruction, at most 80 characters                      |

Rules: every non-rest session has at least one `work` step; every `work` step has a target other than `none`; derived totals are duration, distance estimate and time per intensity; totals must match the session's declared duration within 10% (D6, FR-23).

### Operations

The closed union is `create_plan`, `move_session`, `swap_sessions`, `shorten_session`, `replace_session`, `skip_session`, `add_session`, `set_week_targets`, `replace_range` and `set_race_role`. `applyOperations(state, operations, context)` returns either a changeset (closed and new revisions by stable key) or typed errors: `unknown_key`, `frozen_session`, `past_date`, `outside_plan`, `overlapping_targets`, `invalid_structure`.

### Training targets

- Intensities: `recovery`, `easy`, `marathon`, `threshold`, `interval`, `repetition`, plus `uphill` and `downhill` guidance for trail.
- Pace sources, in order: threshold pace from recent flat laps, a recent race or best effort, the VO₂ max–based estimate used by Progression. Heart-rate sources: Garmin lactate-threshold heart rate and zones imported by garmin_mcp when present and recent, then Stride zones from the profile. With no reliable source, the step uses RPE and the talk test only.
- Confidence: `high` when the source is at most 60 days old, `medium` up to 120 days, `low` beyond; sources older than 365 days are ignored. These ages live in the thresholds module.
- Trail climbs and descents use heart-rate or RPE targets; pace appears only on flat or rolling sections.
- Output `TrainingTargets`: per intensity `paceRange`, `heartRateRange`, `rpe`, `source`, `asOf`, `confidence`, plus `calibrationGaps`.

### Validator report

One entry per evaluated rule: rule id, severity (`block`, `warn`, `info`), grade (`evidence`, `convention`, `integrity`, `athlete_constraint`) with its citation, outcome (`pass`, `fail`, `skipped`), observed value, threshold, session or week keys involved, and the skip reason. The report records the thresholds version and validates against its Zod schema. Phase 1 applies rules I1–I4, C1–C3, E1–E2, P1–P8 and D1; H1–H3 are implemented against condition and readiness inputs supplied by the caller and are exercised by fixtures, since condition reports arrive in Phase 4.

### Templates and skeleton defaults

All values below are conventions, labeled as such in the templates module and adjustable only through a reviewed change with tests (D8).

| Event family                  | Minimum weeks | Taper   | Post-race recovery | Confidence |
| ----------------------------- | ------------- | ------- | ------------------ | ---------- |
| Road 5–10 km                  | 6             | 1 week  | 1 week             | normal     |
| Half marathon                 | 8             | 2 weeks | 1 week             | normal     |
| Marathon                      | 12            | 2 weeks | 2 weeks            | normal     |
| Trail up to 60 km             | 10            | 2 weeks | 2 weeks            | normal     |
| Trail above 60 km             | 14            | 2 weeks | 3 weeks            | low        |
| Base building (no dated race) | 4             | —       | —                  | normal     |

- Objective: the A-priority race, else the nearest dated race, else the goal focus (base building). Other races in the window become preparation or secondary races with a local taper and recovery.
- Workload: held volume is the average of the last four complete weeks; peak is held volume × the template factor (1.1–1.2); a lead-in ramps at about 4% per week when needed; a recovery week every 3–4 weeks at about 80% of the previous full week; taper reduces volume 40–60% while keeping some intensity.
- Weekly targets fit available weekdays, unavailable dates, the weekday session length, the long-run day and the weekly ceiling.
- History under four weeks or under one hour per week selects base building with low confidence and states why.

### Feasibility verdict

`realistic`, `ambitious` or `unrealistic`, each with French reasons built from computed facts and, when not realistic, alternatives: a later race, a shorter format, a different race role, or a base block first. Starting conventions: fewer weeks than the template minimum is `ambitious` when at least 75% of the minimum remains and the long-run progression fits E1/E2, otherwise `unrealistic`; a target time faster than the optimistic bound of the estimate band is `ambitious`, and more than 5% faster is `unrealistic`; a peak long run, weekly elevation or volume below 70% of race demands (rule D1) is `ambitious`.

### Deterministic build

`buildDeterministicPlan(input)` takes the athlete's profile, planning constraints, races and course data, history summary, targets inputs, `today` and time zone, and returns the complete plan state, the validator report, the feasibility verdict, the targets with calibration gaps, and the confidence label. It never throws for athlete data: missing inputs become skipped rules, gaps and lower confidence.

### Storage

Tables, columns, version ranges, the apply algorithm and the access matrix follow [data model](../../architecture/coaching-engine/data-model.md), restricted in Phase 1 to `training_plans`, `plan_versions`, `plan_blocks`, `plan_weeks`, `plan_sessions`, `plan_proposals`, `plan_decisions` (CAP-8) and `session_activity_matches` (CAP-9). There is no `provisional` column and no consent or budget column. The private apply function is executable only by a dedicated no-login role prepared for the Phase 2 worker and by tests. Athlete RPCs accept or reject a ready proposal and record the decision; applying happens in the worker from Phase 2.

### Matching

Same-day match first, then a session moved within the same week, then substitutions across sports. Statuses `completed`, `partial` and `substituted` are persisted with confidence and compliance ratios (duration, distance, intensity); `missed` is derived for unmatched past sessions. The algorithm version is recorded. An `athlete` match always wins over `auto`. Activity ids are plain `uuid` values without foreign keys to garmin_mcp tables (ADR 0005).

### Plan screens

Routes under `src/app/(app)/plan`: plan overview by blocks and weeks, week view and session detail, following `design/references/app/plan` and `design/references/app/workout-detail`. The deterministic plan is built on each request under the athlete's session and is not persisted. A visible French label states that it is a draft computed by Stride, not yet saved. Feasibility, confidence and validator warnings are shown. Actions (accept, edit, replace a session, send to Garmin), compliance, the weekly changes list and panels without a data source (habits, nutrition, shoes, best time slot) are hidden.

## Constraints

- Code owns every number, date and target; no model call anywhere in Phase 1.
- A missing signal is never favorable; it produces a skip, a gap and lower confidence.
- Passing the validator is never presented as medical safety; health copy stays generic and refers to a health professional.
- Every rule cites its grade; conventions lean conservative because no human expert reviews them (D8).
- Stride-owned tables use owner-only RLS with `(select auth.uid())`, no `anon` grants, column grants and revision triggers, following the existing migrations; garmin_mcp tables are read under RLS only.
- Athlete-facing copy is French, dates are JJ/MM/AAAA with `fr-FR` formatting, and no native date input is used.
- UI reuses `src/components/stride` patterns (`SessionShape`, `ConfidenceMeter`, `SignalChip` and the loading conventions) before adding new ones.
- Applying migrations to the hosted Supabase project is an owner approval checkpoint; generated database types are regenerated, not hand-edited.

## Non-goals

- Model gateway, coach worker, agent runs, tools, streaming and the evaluation harness (Phase 2).
- Model-designed plans and explanations (Phase 3).
- Adaptation, the Coach screen, Historique, condition reports, session feedback and the weekly review (Phase 4).
- Multi-race revisions and Course Strategist race demands beyond the existing course analysis (Phase 5).
- Sending workouts to Garmin (D5), automatic changes (D3), quotas (D4).

## Success signal

For the owner's real account, the Plan screens show a complete plan to their next A race in which every session opens with its full steps and computed targets, the validator report has no block, and the feasibility verdict and confidence are visible. In CI, fixture plans for every event family pass all rule tests, and pgTAP proves that a second athlete can read none of the plan, proposal or match rows.

## Assumptions

- Phase 1 shows the deterministic plan as an unsaved draft. Plans become persisted versions when the coach worker can apply an accepted `create_plan` proposal, from Phase 2–3.
- garmin_mcp keeps its normalized activity, threshold and heart-rate zone contracts; Garmin thresholds are optional inputs.
- The design references under `design/references/app/plan` and `workout-detail` describe the target plan screens.

## Open Questions

- Should the athlete be able to save the deterministic draft as version 1 before model-designed plans exist (Phase 3)? The default above keeps it unsaved; saving would need an athlete-triggered `create_plan` path before the worker exists.

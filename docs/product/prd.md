# Stride product requirements

- Status: Draft for discovery
- Owner: Product
- Source: [Product vision](vision.md), [product brief](brief.md), and [product principles](principles.md)
- Scope: Candidate first release; requirements below are proposals until discovery validates them, except the accepted onboarding and training plan decisions

## Accepted onboarding decisions

The product owner accepted these decisions for the E-07 onboarding on 2026-10-09:

- Garmin is required to complete MVP onboarding. Full historical synchronization is not required to advance through onboarding or to complete it.
- Onboarding uses the real garmin_mcp integration from the start. Mocked Garmin responses are limited to component development, automated tests and visual state validation.
- Onboarding progress and everything the athlete enters persist in Stride's Supabase database and resume on any device.
- Import progress shows only real synchronization data.
- Onboarding UI copy is French, matching the approved references.

## Accepted training plan decisions

The product owner accepted the coaching engine decisions D1–D8 on 2026-10-13 ([risks and decisions](../architecture/coaching-engine/risks-and-decisions.md), #94). Those that shape product behavior:

- Stride is a personal, open-source application used by its owner and possibly one or two relatives on a self-hosted instance. There is no AI-processing consent flow, no time-based retention purge and no per-athlete quota or monthly budget; isolation between athletes stays.
- No plan change is ever applied without the athlete's approval; there are no automatic changes.
- Every week of a plan is fully detailed at creation: every session has its complete structure and its targets.
- No human expert reviews plans. The deterministic validator, conservative defaults and an automated evaluation suite with an LLM judge are the quality gates; the athlete is the only human in the loop.
- Supported events: road 5 km to marathon and trail of every distance; plans for events above 60 km carry a low-confidence label instead of being refused.
- Sending workouts to Garmin is deferred.

## Product goals

1. Help road and trail runners make better training decisions using their goals and recent training context.
2. Make training recommendations understandable, appropriately cautious, and subject to athlete choice.
3. Establish a reliable foundation for normalized activity data and later coaching capabilities.

## Target athletes

The primary persona is a recreational runner training toward a road or trail event who records runs digitally and wants a plan that accounts for recent activity and real-life availability. A secondary persona may train across road and trail or progress from a road event to a trail event. These are audience hypotheses, not validated personas.

## Core journeys

### Start with useful context

An athlete creates an account, connects Garmin, continues while history imports, provides running background, availability and goals, and reviews a first athlete profile showing what Stride knows, where each value came from, and what is still missing. They can stop at any point and resume from any device.

### Understand recent training

An athlete connects a supported data source, sees sync progress and freshness, and reviews recent activities in a consistent history that preserves road and trail context.

### Decide what to do next

An athlete reviews a daily or weekly training proposal, sees the evidence and assumptions behind it, asks a follow-up question, and accepts or declines a proposed change.

### Prepare for an event

An athlete records a goal event and later uses relevant training, course, and race information to prepare. Detailed race strategy is a later capability unless discovery selects it as the first wedge.

## Candidate functional requirements

### Athlete context and data

- FR-01: An athlete can provide a goal, running background, terrain preferences, and weekly availability needed to interpret training recommendations.
- FR-02: Stride explains requested data access and records the athlete's consent before importing provider data.
- FR-03: For each imported activity, Stride preserves provider identity, source identifier, activity time, and sync provenance so duplicates and corrections can be handled deterministically.
- FR-04: The athlete can see whether data is current, syncing, delayed, or unavailable and can distinguish missing information from a zero value.
- FR-05: Road and trail activities retain shared fields such as duration and distance while allowing terrain-specific context such as elevation and surface when available.

### Onboarding

- FR-11: Completing onboarding requires a connected Garmin account; advancing through onboarding and completing it do not require the historical import to finish.
- FR-12: Onboarding progress, per-step completion, profile information, preferences, goals and races persist to Stride's database as the athlete progresses and are restored after refresh, sign-out and sign-in, browser restart, network loss or on another device.
- FR-13: Returning to an earlier step shows its saved values and allows editing; a later step cannot be reached before its prerequisites are complete.
- FR-14: A step is marked complete only after its required data has persisted. The athlete can see whether edits are unsaved, saving, saved or failed, and failed saves can be retried without losing input.
- FR-15: Concurrent edits from two devices and late responses never silently overwrite newer athlete input.
- FR-16: Garmin import status shows real synchronization states, the oldest synchronized date and verified activity counts, and continues independently of onboarding navigation. Stride shows no fabricated percentages, totals or time estimates.
- FR-16a: The import step shows "Ce que je remarque": up to four observations computed deterministically from the athlete's imported activities and recovery data, each with its source window. A language model may rephrase them once the activity import is complete, but never adds numbers or advice; deterministic sentences are shown when the model is unavailable.
- FR-17: Each profile value identifies its source. Athlete edits to a Garmin-suggested value are kept and are not replaced by later Garmin data.
- FR-18: Garmin passwords, one-time codes, provider tokens and MFA challenge secrets are never stored by Stride, in browser storage or in logs.

### Training and coaching

- FR-06: Stride can present a proposed week of training that reflects the athlete's stated goal, availability, and available training history.
- FR-07: A coaching response identifies the relevant athlete or activity context and separates measured facts from estimates or assumptions.
- FR-08: If required context is missing or stale, Stride asks for it or limits the recommendation rather than implying certainty.
- FR-09: A proposed plan change is reviewable by the athlete and is not applied until the athlete accepts it.
- FR-10: Athlete-facing advice does not diagnose injury or disease and directs urgent or medical concerns to qualified care.

### Training plans

These requirements are accepted. Phase 1 of the coaching engine delivers them deterministically, without any model call; the [plan foundation spec](../specs/spec-plan-foundation/spec-plan-foundation.md) maps each of them to its implementation issue. Later phases let the Coach model design and adapt plans under the same requirements.

- FR-19 Objective and horizon: a plan targets one main objective, resolved as the A-priority race, else the nearest dated race, else the athlete's goal focus. It runs from its start date to race day and includes the post-race recovery; other races in the window get a plan role (preparation or secondary goal) without changing the athlete's own priority.
- FR-20 Planning constraints: the athlete can declare a time zone, a maximum weekly training time and unavailable date ranges in Settings, in addition to the available weekdays, long-run day and weekday session length captured during onboarding. Plans respect all of them; the time zone defines the athlete's local today.
- FR-21 Baseline and feasibility: plans are built from the athlete's own synchronized history (volume, longest recent run, consistency, intensity distribution when available). Before building, Stride states whether the objective is realistic, ambitious or unrealistic with the facts behind it; a timeline too short for the event yields options, never a silently compressed plan. The verdict informs the athlete, who stays in control of their plan.
- FR-22 Event scope: Stride builds plans for road 5 km to marathon, trail of every distance and base building without a race. Plans for events above 60 km show a low-confidence label. With fewer than four weeks of history, Stride builds a conservative base-building plan and says so.
- FR-23 Complete sessions: every session of every week is complete when the plan is created: warm-up, work steps and repetitions, recoveries and cool-down, each step ending on time, distance or lap button, with a title, purpose and short French cues. There are no provisional weeks.
- FR-24 Training targets: every step carries a pace range, a heart-rate range or an effort (RPE) target computed from the athlete's data, with its source and confidence. Missing calibration is declared and replaced by effort targets, never by invented values. Trail climbs use effort or heart-rate targets rather than pace.
- FR-25 Validation: every plan and every change is checked by deterministic rules before the athlete sees it and again before it is applied. Blocking rules prevent the plan or change; warnings are shown with their evidence grade. A missing signal never counts as favorable, and passing the rules is never presented as medical safety.
- FR-26 Versions and frozen history: a plan is a sequence of immutable versions. Sessions dated before the athlete's local today or matched to an activity are frozen; no version change rewrites them.
- FR-27 Proposals and decisions: every plan creation or change is a proposal with a summary, rationale, evidence, assumptions, uncertainty and validator report. The athlete accepts or rejects it, optionally with a note; nothing changes before acceptance. A proposal becomes stale when the plan changed since it was made, and every decision is recorded in an auditable history.
- FR-28 Adherence: completed activities are matched to planned sessions as completed, partial or substituted, and unmatched past sessions count as missed. The athlete can correct a match, and the correction survives recomputation.
- FR-29 Régularité: Progression shows the share of planned and key sessions completed over the selected period once a plan exists, and keeps an honest empty state otherwise.
- FR-30 Plan screens: the athlete can browse the plan by blocks and weeks and open any session to see its steps, targets, totals, purpose and contingency advice. A plan computed by Stride but not yet saved is labeled as a draft; sections without a data source are hidden rather than filled.

### Notifications

- V1 includes an in-app notification center: a bell with the unread count in every application header, a desktop panel and a `/notifications` history of the last 30 days filtered by Toutes, À traiter, Staff and Données.
- The first sources are plan proposals ready for review and staff replies or questions in Coach threads. Database triggers on the existing plan and coach tables create and resolve notifications, so every call site is covered and the athlete's own decisions resolve a notification instead of creating one.
- Garmin sources follow: fresh running activities, connection problems, watch send failures and shoe questions. Stride detects them when the athlete opens the app, without changing the Garmin service.
- Stride is installable as a web app. Each device can enable Web Push from Réglages, with four switches per athlete: Séance du jour (07:00 in the plan time zone), Plan et staff, Débrief prêt and Problèmes Garmin. Shoe questions are not pushed. On iPhone, push requires the app on the home screen (#284).
- Email delivery, a configurable reminder time and a realtime badge are out of scope for V1.

### Future capabilities

Activity analytics, training load, readiness, multiple specialist agents, course segmentation, race prediction, race roadbooks, and broad provider support are not required for the candidate first release unless discovery changes the priority. Garmin race-calendar lookup, GPX course upload, Stride-derived performance predictions such as threshold pace, climbing speed, race-time estimates and heart-rate zones, and generated import insights are deferred onboarding capabilities.

## Non-functional requirements

- NFR-01 Privacy: authenticated data access is scoped to its owner; database policies and server checks prevent cross-athlete access.
- NFR-02 Consent: athletes can understand and withdraw data-source permission. Athlete data is kept for the life of the account and deleted with it; there is no separate AI-processing consent or time-based purge (decision D2).
- NFR-03 Integrity: repeated syncs do not create duplicate activities, and provider timestamps and units are normalized consistently.
- NFR-04 Explainability: each recommendation can identify its input evidence, assumptions, and important limitations.
- NFR-05 Availability and performance: define service objectives and response-time targets when hosting and the first pilot scale are selected; do not promise targets without operational evidence.
- NFR-06 Accessibility: core journeys work with keyboard navigation, assistive technology, readable contrast, and reduced motion.
- NFR-07 Maintainability: deterministic calculations remain independently testable; AI outputs are structured and validated at the server boundary.
- NFR-08 Observability: record sync and coaching failures without logging secrets or unnecessary sensitive athlete data.
- NFR-09 Resilience: onboarding remains usable while Garmin synchronization is slow or temporarily unavailable, and an interrupted save or network loss never discards athlete input without notice.
- NFR-10 Evaluation: without human expert review, coaching quality is gated by deterministic rule tests, fixture plans across event families and, once models are involved, an automated evaluation suite whose safety scenarios must pass three times out of three and whose rubric is graded by an LLM judge calibrated on seeded defects.
- NFR-11 Run limits: every coaching run has hard caps on model calls, tool calls, tokens, cost and duration; model usage and cost are recorded per call.

## Success measures

Instrument these measures for a pilot; set target thresholds after discovery establishes a baseline and pilot size:

- Activation: proportion of invited athletes who complete profile setup and reach a first useful training summary.
- Data reliability: percentage of successfully imported activities with valid ownership, source provenance, normalized units, and no duplicate record.
- Coaching usefulness: athlete rating of a weekly proposal and a brief reason for accepting, editing, or declining it.
- Repeat value: proportion of pilot athletes who return to review or discuss training in later weeks.
- Safety: results from automated evaluation scenarios covering missing data, stale data, pain or illness disclosures, and conflicting training constraints.

Do not optimize for recommendation acceptance alone; an informed decline can be a successful outcome.

## Assumptions and constraints

- Web is the first client; the domain and service boundaries should permit a native client later.
- Supabase is the initial platform. Garmin authentication, MFA and synchronization are owned by the garmin_mcp integration service; Stride calls it from its server.
- AI behavior is server-side, isolated from the UI, and uses validated structured outputs.
- Deterministic training calculations do not depend on a language model where they can be implemented directly.
- Garmin access, permitted data use, synchronization reliability, and data retention need technical and policy validation.
- No user research, market sizing, pricing decision, or validated performance target is available in the current source material.

## Out of scope

- Native apps, billing, email notifications, social features, and coach/team accounts
- Medical diagnoses or treatment plans
- Unreviewed automated changes to a training plan
- An exhaustive specialist-agent catalog
- Sending workouts to Garmin

## Decisions needed before implementation

- Confirm the first athlete segment, event type, and highest-value journey.
- Define data-source failure behavior beyond the onboarding states.
- Agree on success thresholds once real usage exists.

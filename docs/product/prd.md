# Stride product requirements

- Status: Draft for discovery
- Owner: Product
- Source: [Product vision](vision.md), [product brief](brief.md), and [product principles](principles.md)
- Scope: Candidate first release; requirements below are proposals until discovery validates them

## Product goals

1. Help road and trail runners make better training decisions using their goals and recent training context.
2. Make training recommendations understandable, appropriately cautious, and subject to athlete choice.
3. Establish a reliable foundation for normalized activity data and later coaching capabilities.

## Target athletes

The primary persona is a recreational runner training toward a road or trail event who records runs digitally and wants a plan that accounts for recent activity and real-life availability. A secondary persona may train across road and trail or progress from a road event to a trail event. These are audience hypotheses, not validated personas.

## Core journeys

### Start with useful context

An athlete creates an account, provides running background and goals, selects training availability, reviews data permissions, and can see what information Stride has or still needs.

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

### Training and coaching

- FR-06: Stride can present a proposed week of training that reflects the athlete's stated goal, availability, and available training history.
- FR-07: A coaching response identifies the relevant athlete or activity context and separates measured facts from estimates or assumptions.
- FR-08: If required context is missing or stale, Stride asks for it or limits the recommendation rather than implying certainty.
- FR-09: A proposed plan change is reviewable by the athlete and is not applied until the athlete accepts it.
- FR-10: Athlete-facing advice does not diagnose injury or disease and directs urgent or medical concerns to qualified care.

### Future capabilities

Activity analytics, training load, readiness, multiple specialist agents, course segmentation, race prediction, race roadbooks, and broad provider support are not required for the candidate first release unless discovery changes the priority.

## Non-functional requirements

- NFR-01 Privacy: authenticated data access is scoped to its owner; database policies and server checks prevent cross-athlete access.
- NFR-02 Consent: athletes can understand and withdraw data-source permission; data deletion and retention behavior must be defined before external athlete data is stored.
- NFR-03 Integrity: repeated syncs do not create duplicate activities, and provider timestamps and units are normalized consistently.
- NFR-04 Explainability: each recommendation can identify its input evidence, assumptions, and important limitations.
- NFR-05 Availability and performance: define service objectives and response-time targets when hosting and the first pilot scale are selected; do not promise targets without operational evidence.
- NFR-06 Accessibility: core journeys work with keyboard navigation, assistive technology, readable contrast, and reduced motion.
- NFR-07 Maintainability: deterministic calculations remain independently testable; AI outputs are structured and validated at the server boundary.
- NFR-08 Observability: record sync and coaching failures without logging secrets or unnecessary sensitive athlete data.

## Success measures

Instrument these measures for a pilot; set target thresholds after discovery establishes a baseline and pilot size:

- Activation: proportion of invited athletes who complete profile setup and reach a first useful training summary.
- Data reliability: percentage of successfully imported activities with valid ownership, source provenance, normalized units, and no duplicate record.
- Coaching usefulness: athlete rating of a weekly proposal and a brief reason for accepting, editing, or declining it.
- Repeat value: proportion of pilot athletes who return to review or discuss training in later weeks.
- Safety: results from reviewed scenarios covering missing data, stale data, pain or illness disclosures, and conflicting training constraints.

Do not optimize for recommendation acceptance alone; an informed decline can be a successful outcome.

## Assumptions and constraints

- Web is the first client; the domain and service boundaries should permit a native client later.
- Supabase is the initial platform and Garmin data flows through a dedicated integration service.
- AI behavior is server-side, isolated from the UI, and uses validated structured outputs.
- Deterministic training calculations do not depend on a language model where they can be implemented directly.
- Garmin access, permitted data use, synchronization reliability, and data retention need technical and policy validation.
- No user research, market sizing, pricing decision, or validated performance target is available in the current source material.

## Out of scope

- Native apps, billing, notifications, social features, and coach/team accounts
- Medical diagnoses or treatment plans
- Unreviewed automated changes to a training plan
- Garmin authentication/API implementation in the current planning task
- A production schema or an exhaustive specialist-agent catalog

## Decisions needed before implementation

- Confirm the first athlete segment, event type, and highest-value journey.
- Confirm whether Garmin is a launch dependency or a later integration.
- Define consent, retention, deletion, and data-source failure behavior.
- Choose the minimum useful coaching output and the degree of user control.
- Agree on pilot size, success thresholds, and safety review ownership.

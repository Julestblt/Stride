# Product brief

- Status: Draft for discovery
- Owner: Product
- Inputs: product vision, principles, and task brief

## Product concept

Stride is a web-first personal running coach for road and trail runners. It brings an athlete's goals, training history, activities, recovery signals, and race context together to support understandable training decisions.

## Problem hypotheses

These problems follow from the product vision and have not yet been validated with athletes:

- Training data and coaching context are split across devices, plans, activity feeds, and personal notes.
- Generic plans do not reflect an athlete's current training, schedule, recovery, or terrain.
- Road pace conventions do not describe trail demands such as elevation, surface, and technicality.
- AI advice without visible evidence, uncertainty, and athlete approval is difficult to trust.

## Initial audience hypothesis

The first audience to validate is recreational road and trail runners who are preparing for an event and already record activities digitally. Some may train across both terrain types. New runners, elite athletes, and coaches managing teams are not assumed to be the first audience.

This segment is provisional. Discovery should establish which athlete and event type has the clearest, repeated need before implementation scope is committed.

## Proposed value

Stride helps an athlete understand what their recent training and current context suggest, see a coherent next step, and decide whether a recommendation fits their goals and constraints.

## Candidate first release

Validate a narrow coaching loop before committing to a complete platform:

1. Capture an athlete's running background, goal event, preferences, and weekly availability.
2. Import and normalize the athlete's recent Garmin activity data with clear sync and data-freshness state.
3. Present a useful training summary for road and trail activity.
4. Offer a weekly training proposal with explanations grounded in the athlete's available context.
5. Let the athlete review and accept or reject changes; do not silently alter an active plan.

The value of Garmin-first onboarding, health data, and an initial weekly plan remains a discovery question, not an approved MVP decision.

## Product principles

Use the principles in [Product principles](principles.md): coach the whole athlete, make reasoning legible, respect athlete agency, support road and trail together, and prefer useful calm.

## Non-goals for the first release

- Native mobile applications or watch-first experiences
- Medical diagnosis, injury diagnosis, or emergency advice
- Social feeds, clubs, coaching marketplaces, or team administration
- Automatic write-back to Garmin or unapproved plan changes
- A general-purpose assistant unrelated to running
- Implementing every specialist agent or running skill at launch

## Risks and open questions

- Which athlete segment and event type has the strongest unmet need?
- Will athletes connect Garmin before receiving value, and which data permissions are acceptable?
- Which recovery or readiness signals are useful without overstating medical meaning?
- How should Stride handle missing, delayed, duplicated, or corrected provider data?
- What evidence makes a recommendation understandable and trustworthy?
- What first-release outcome would justify continuing product investment?

## Discovery exit criteria

- A primary athlete segment and one high-value journey are supported by direct evidence.
- The proposed first release has an explicit in-scope and out-of-scope boundary.
- Data consent, Garmin dependency, and coaching safety assumptions have owners or a planned decision.
- Success measures and a pilot approach are agreed before development epics are activated.

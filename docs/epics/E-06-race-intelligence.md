# E-06: Race intelligence

## Objective

Help athletes prepare for a selected road or trail event using relevant athlete, training, and course context.

## Scope

- Goal-event context and course ingestion where available
- Road and trail course segmentation
- Explainable pacing or effort scenarios and contingencies
- Race-day summaries or roadbooks when athletes validate the format

## Dependencies

E-01 provides athlete goals. E-03 provides trustworthy training history. Course parsing, plan integration, and conversational strategy depend on product discovery and relevant parts of E-04/E-05.

The proposed [coaching engine architecture](../architecture/coaching-engine/README.md) (#86) covers this epic's plan integration: race roles in multi-race plans and race demands feeding specific training phases. Race-day strategy stays in the race workspace.

## Expected user value

An athlete can turn a course and training context into a preparation approach that accounts for terrain and uncertainty.

## Major risks

- Incorrect elevation or course data drives unsafe pacing
- Predictions overstate accuracy or ignore weather, fueling, and athlete variability
- Race features expand before the basic coaching loop is useful

## Completion criteria

- Supported course inputs, assumptions, and failure states are documented.
- Segmentation and calculations are testable against known course fixtures.
- Strategy distinguishes measured course facts from inferred effort and time.
- A race-day artifact is validated with target athletes before broad implementation.

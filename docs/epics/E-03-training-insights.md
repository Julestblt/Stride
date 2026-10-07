# E-03: Training history and insights

## Objective

Help athletes review recent road and trail training through accurate activity history and deterministic, clearly scoped measures.

## Scope

- Activity history and detail views
- Training volume and trends with explicit units and periods
- Training load or readiness only after its definitions and limitations are agreed
- Data-quality and freshness cues that affect interpretation

## Dependencies

E-01 provides athlete context. E-02 provides normalized activity data. Metric definitions require domain review and independently testable calculations.

## Expected user value

Athletes can connect an individual activity to a broader training pattern without confusing missing data with zero or treating estimates as facts.

## Major risks

- Metrics imply more scientific precision than available evidence supports
- Trail distance, elevation, surface, and road pace are compared without suitable context
- Incomplete activity history distorts trends

## Completion criteria

- Every displayed measure has a documented definition, unit, period, and data requirement.
- Calculations have domain tests for boundary, missing-data, and terrain cases.
- Unavailable or incomplete data is visibly distinguished from a valid zero.
- Athletes can reach the source activity behind an insight.

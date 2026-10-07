# E-01: Athlete context and consent

## Objective

Let an athlete establish the minimal trusted context needed for useful running guidance and understand how personal and provider data is used.

## Scope

- Account identity and athlete-owned profile
- Running background, goals, terrain preferences, and availability
- Data-source consent, access, revocation, and deletion behavior
- Clear distinction between confirmed, missing, and stale context

## Dependencies

Product discovery must choose the initial athlete segment and define consent and retention expectations. This capability precedes Garmin ingestion and coaching.

## Expected user value

The athlete can provide relevant context once and see what Stride knows before relying on a recommendation.

## Major risks

- Collecting sensitive or unnecessary data
- Unclear consent or deletion behavior
- Profile questions create setup friction before the product demonstrates value

## Completion criteria

- Each required profile field has a defined purpose and validation rule.
- Athletes can inspect and change their context and permissions.
- Authorization tests prove one athlete cannot access another athlete's records.
- Retention and deletion behavior is documented and verifiable.

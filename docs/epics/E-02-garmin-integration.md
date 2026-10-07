# E-02: Garmin integration

## Objective

Import Garmin data through a dedicated integration service and expose normalized, provenance-aware data to Stride.

## Scope

- Provider authentication and consent in the integration boundary
- Retryable synchronization and visible sync freshness
- Normalized activity contracts for shared and road/trail-specific fields
- Duplicate detection, corrections, and provider error handling

## Dependencies

E-01 defines athlete identity, permissions, and deletion expectations. Provider access and data-use constraints must be researched before implementation.

## Expected user value

An athlete can use their existing training history without manually recreating every run.

## Major risks

- Provider policy or API changes
- Unreliable authentication, rate limits, or delayed data
- Provider-specific fields leaking into product and AI contracts

## Completion criteria

- A documented provider-to-domain mapping covers supported fields and omissions.
- Sync is idempotent and has observable success, delay, retry, and failure states.
- Disconnect and deletion behavior is tested against the agreed policy.
- Integration tests use controlled fixtures and do not require personal Garmin credentials in CI.

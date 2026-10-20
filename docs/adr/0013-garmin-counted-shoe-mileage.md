# ADR 0013: Garmin-counted shoe mileage with Stride starting km and Garmin write-back

- Status: Accepted
- Date: 2026-10-20
- Epic: [E-08](../epics/E-08-gear.md) (#221)

## Context

Athletes want each pair's mileage, wear alerts and a pair recommended for every session. Garmin already links activities to gear, counts each pair's distance and alerts at a maximum distance, but it has no field for kilometres run before the pair entered Garmin. Watches often apply a default pair, so links are frequently wrong. The athlete's Strava totals are the only record of older kilometres, and Stride has no Strava integration. Until now, sending workouts was the only Garmin write ([Garmin integration](../architecture/garmin.md)).

## Decision

- A pair's mileage is its starting km, stored in Stride, plus Garmin's total distance for that gear. Stride does not keep its own per-activity ledger.
- Stride creates pairs in Garmin, updates their wear limit and status, and sets the pair of an activity through garmin_mcp. Garmin's wear limit is the lifespan minus the starting km, so Garmin's alert fires at the real end of life. Stride sends no wear alert of its own.
- After a sync, an activity matched to a planned session without a Garmin pair receives the recommended pair, written to Garmin. When Garmin's pair differs from the planned one, the athlete chooses; any change is written to Garmin and marked as an athlete correction that later syncs do not overwrite.
- Spec sheets are extracted from a product page the athlete links, read on the server with SSRF guards, by Claude Haiku 5.5 through the Anthropic SDK with a structured output. Each value comes with a quote from the page and is kept only if the quote is on the page and holds the value; absent fields stay empty. Spec sheets are owned by each athlete.
- Recommendations are deterministic domain functions computed on read, with reasons as codes. An athlete override is stored per plan `session_key`.
- These writes run only from the athlete's own requests or the activity check of their own data. Agents keep read-only access.

## Alternatives considered

- A Stride-side ledger summing every activity, independent of Garmin: duplicates Garmin's count and drifts whenever links change in Garmin Connect.
- Seeding from Strava through an integration: not justified for a one-time value the athlete can type.
- Web search for specs: more cost and a higher risk of invented values than reading a page the athlete chose.

## Trade-offs

Garmin stays the single counter and alert, so Stride and Garmin Connect always agree, at the cost of depending on unofficial gear endpoints and on writing to Garmin for corrections. If gear creation is refused, the athlete creates the pair in Garmin Connect and imports it.

## Consequences

- garmin_mcp normalizes `provider_gear` and `provider_activity_gear` and exposes gear and activity-link write routes (Julestblt/garmin_mcp#21).
- Stride owns `athlete_shoes` (spec sheet, starting km) and per-session overrides, with owner RLS.
- The Garmin integration document lists gear writes next to workout sending.

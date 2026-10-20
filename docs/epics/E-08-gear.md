# E-08: Gear: running shoes, mileage and a pair for every session

## Objective

Let athletes manage their running shoes in Stride: exact mileage per pair, a spec sheet for each pair, a recommended pair for every planned session, and accurate activity-to-pair links in Garmin.

## Scope

- Shoes imported from Garmin or added in Stride, with a spec sheet filled from a product link or by hand, then reviewed by the athlete.
- Mileage per pair: starting km kept in Stride plus the distance Garmin counts.
- Wear shown as km used, km left and a replacement date projected from recent weekly volume. Garmin sends the wear alert.
- A recommended pair for every planned session, with an athlete override per session, on the plan session, Today and the Matériel page.
- An activity check after each sync: a missing pair is filled with the recommended one, a different pair asks the athlete which one was worn. Corrections are written back to Garmin.
- Coach and Course Strategist read access to pairs and recommendations, and the race gear checklist linked to real pairs.
- The `Matériel` page of the [design board](../design/design-board.md) and the shoe blocks of Today, plan session, activity detail and race gear artboards (board version `1792501121-06e7`).

## Decisions

See [ADR 0013](../adr/0013-garmin-counted-shoe-mileage.md).

- Garmin counts kilometres and sends the wear alert. Stride keeps only the starting km Garmin cannot hold, and sets Garmin's wear limit to the pair's lifespan minus those km.
- Stride creates pairs in Garmin and writes activity-to-pair corrections back to Garmin through garmin_mcp. Corrections made in Stride are never overwritten by a later sync.
- Spec sheets come from a product page read on the server. A field absent from the page stays empty. There is no web search, and spec sheets are private to each athlete.
- Recommendations are computed on read by deterministic domain rules: terrain, distance and D+, session kind, wear, rotation and pairs reserved for a race. The Coach phrases the reason; it never picks a pair outside these rules.
- Strava is not integrated. Athletes may type their Strava totals as starting km.
- Nothing about shoes is sent to the watch. Treadmill kilometres count.

## Delivery slices and dependencies

| Slice | Capability                                                      | Depends on |
| ----- | --------------------------------------------------------------- | ---------- |
| S0    | This epic and ADR 0013                                          | None       |
| G1    | garmin_mcp: gear sync, gear and activity-link write endpoints   | None       |
| S1    | Shoes model, Matériel list and detail, import from Garmin       | S0, G1     |
| S2    | Add a pair from a product link or by hand, created in Garmin    | S1         |
| S3    | Recommended pair for every planned session                      | S1         |
| S4    | Activity pair check, auto-assign and Garmin write-back          | S3         |
| S5    | Coach and Course Strategist gear knowledge, race gear checklist | S3         |

## Deferred capabilities

Bikes and other gear, a catalog shared between athletes, spec lookup by web search, Strava import and shoe hints on the watch.

## Expected user value

Athletes know how worn each pair is without bookkeeping, always know which pair to wear, and keep Garmin's totals right with one tap when the watch picked the wrong pair.

## Major risks

- Garmin endpoints are unofficial; gear creation may be refused for some sessions. Athletes can then create the pair in Garmin Connect and import it.
- Wrong Garmin default pairs skew mileage until the athlete answers the activity check.
- Product pages may hide specs or block automated reads; fields then stay empty.

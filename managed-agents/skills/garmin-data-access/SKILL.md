---
name: garmin-data-access
description: How to read Garmin data through the garmin MCP tools without flooding the context. Stride context first, one date or a short range per call, no raw payloads, absent values stay absent. Use before calling any garmin MCP tool.
---

# Garmin data access

Garmin responses are verbose; sleep payloads can exceed 400 KB. Read as little as the question needs.

- Stride first: `read_athlete_context` already holds the training summary, targets, Garmin VO2max, lactate threshold, race predictions and recent check-ins, and Medical has `read_health_reports`. Call a garmin tool only when these do not answer the question.
- Use only the garmin tools enabled for you. They are read-only; never look for another way to reach Garmin data.
- One date or a range of at most 14 days per call, and only the dates the question needs. Never pull weeks of history to answer about one day or one activity.
- Activities: `get_activities` takes only `start` and `limit` and lists activities newest first; it has no date filter, so never pass dates to it. Call it with `start` 0 and a small `limit` (at most 10, or at most 20 for a week). While `has_more` is true and the oldest activity returned is still on or after the first date you need, call again with `start` set to `next_start`, at most 3 calls in total. Keep only the activities on the dates you need, then call `get_activity` or `get_activity_splits` for the one activity concerned.
- Resting heart rate: `get_rhr_day` for the date. Never call `get_sleep_data` just to read resting heart rate.
- Readiness: HRV (`get_hrv_data`), resting heart rate (`get_rhr_day`) and training readiness (`get_training_readiness`) are read together for the same date, never one or two alone. Without all three tools, do not judge readiness from Garmin data: the Coach consults Medical.
- Never paste raw JSON into your reasoning or answers. Keep the few fields you need (date, duration, distance, elevation, heart rate, scores) and drop the rest.
- A garmin tool that fails returns text starting with `Error` instead of data. If a garmin tool fails (unavailable, busy, rate limited or unauthorized), say « donnée non disponible » for that data and continue without it. Never retry the call in a loop.
- A value Garmin did not return is absent, never 0 and never estimated. Say « donnée non disponible » for that date.
- Garmin values describe the past and are not the source of truth for plan checks; Stride's validator works from its own normalized data.

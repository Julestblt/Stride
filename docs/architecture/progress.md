# Progress measures

The Progression destination reads normalized garmin_mcp rows (`provider_activities`, `lap` rows of `provider_activity_segments`, and `provider_observations`) and the athlete's races. `src/server/progress` loads them; pure functions in `src/features/progress` compute every value. Dates are the activity's local day; weeks start on Monday.

## Periods

The Forme section accepts 6 weeks, 12 weeks, 6 months (default) and 1 year. Trends compare a current window ending today with a baseline window starting at the first sample inside the period. Both windows last a quarter of the period, clamped to 14–28 days, and must not overlap. A window needs at least three samples. Without a baseline the row shows its value with "Tendance à confirmer"; without a current value it shows an unavailable state, never zero. Sparklines use eight equal buckets of the period (median per bucket).

## Forme

| Measure                | Definition                                                                                                                   | Unit      | Source and requirement                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Condition              | Garmin chronic training load                                                                                                 | load      | `training_load_chronic`, daily, ≥ 7 days in the period                                                                               |
| Fatigue                | Garmin acute training load                                                                                                   | load      | `training_load_acute`, daily                                                                                                         |
| Freshness              | Condition − fatigue, weekly mean                                                                                             | load      | Derived                                                                                                                              |
| Aerobic efficiency     | Median pace of flat laps whose heart rate is within ±6 bpm of the reference, scaled to the reference with heart-rate reserve | min/km    | Reference = top of Stride zone 2 rounded to 5 bpm; flat = ≥ 400 m, (D+ + D−)/distance ≤ 1.5 %, pace 2:30–10:00/km; outdoor runs only |
| Climbing speed         | Median VAM of laps graded 8–15 % (≥ 200 m)                                                                                   | m/h       | Outdoor runs                                                                                                                         |
| Threshold pace         | Median pace of flat laps with heart rate in Stride zone 4                                                                    | min/km    | Outdoor runs                                                                                                                         |
| VO₂ max                | Latest Garmin estimate, compared with the first one in the period                                                            | ml/kg/min | `vo2_max`                                                                                                                            |
| Long-run cardiac drift | (HR/speed of the second half) ÷ (HR/speed of the first half) − 1, halves split on elapsed lap time                           | %         | Runs ≥ 90 min with ≥ 15 min of heart-rate laps per half; median of the last three                                                    |
| Consistency            | Planned sessions completed                                                                                                   | %         | Unavailable until training plans exist                                                                                               |

Trend thresholds: ±4 s/km for paces, ±30 m/h for VAM, ±1 for VO₂ max. Drift above 5 % is "watch"; above 8 %, or above 5 % and up two points since the baseline, is "investigate".

Race predictions solve the Daniels–Gilbert equations for 10K, half marathon and marathon from the latest Garmin VO₂ max (≤ 30 days old). They are labeled Stride estimates on flat roads; confidence is moderate for 10K and half marathon and low for marathon because Garmin VO₂ max is not a race-calibrated VDOT. The next goal race links to its workspace without a projection unless it is a road race already covered.

Weekly hours sum the duration of all activities over the last 16 weeks; weeks containing a past race date are highlighted and the current week is outlined. Records use outdoor runs: the fastest contiguous laps (or whole activity) covering 10 km or a half marathon with at most 5 % overshoot, scaled to the exact distance; the longest run; and the highest weekly running elevation gain. Each effort links to its activity.

## Récupération

`/progress/recovery` reads Garmin recovery observations (`training_readiness`, `sleep_duration_seconds`, `sleep_score`, `hrv_last_night_ms`, `hrv_status`, `resting_heart_rate_bpm`) plus the training loads, and the athlete's daily check-in. A measure is "today's" only when observed today or yesterday; older values show an unavailable state.

| Measure       | Definition                                                                                                                                                                              | Source and requirement                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forme du jour | Garmin training readiness, compared with the mean of the 14 previous days                                                                                                               | Levels: ≥ 75 high, 50–74 moderate, 25–49 low, < 25 poor; ±5 points sets the trend                                                                               |
| Signal gaps   | Each signal's gap to its own baseline, in its unit: sleep vs 14-night mean, HRV and resting HR vs 28-day median, acute/chronic load ratio vs 14-day mean, and the athlete's legs answer | Garmin does not export readiness contributions, so Stride shows gaps, not points. Bar size is a normalized visual only (1 h, HRV range width, 5 bpm, 0.3 ratio) |
| Sleep         | Last night's duration, 14-night mean and Garmin sleep score                                                                                                                             | Short night = 45 min below the mean; two in a row escalate                                                                                                      |
| Nightly HRV   | Last night vs the usual range: mean ± 1 SD of the previous 28 nights (≥ 7 nights)                                                                                                       | One night below is "watch", two consecutive are "investigate"                                                                                                   |
| Resting HR    | Latest value vs the 25th–75th percentiles of the previous 28 days (≥ 7 days)                                                                                                            | Above the range is unfavorable                                                                                                                                  |
| Race recovery | Days after a past Objectifs race until nightly HRV is back above the pre-race range low                                                                                                 | Pre-race range from the 28 nights before; capped at 30 days; ongoing recoveries are marked                                                                      |

The check-in stores one row per athlete and local day in `athlete_wellness_checkins` (legs, soreness, stress) under owner-only RLS. Each answer is saved on selection. Stride does not diagnose; the card says so. Plan changes stay empty until training plans exist.

## Santé

`/progress/health` shows the Semaine view by default and Mois with `?view=month`. Both use stored daily Garmin observations: the reading covers the last 7 or 30 days and the charts cover the last 14 or 30 nights.

| Block              | Definition                                                                                                                                  | Source                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Lecture de Stride  | Deterministic headline, paragraph and three takeaways (sleep, HRV, load) built from the measures below                                      | Stride                                                                                                                               |
| Sommeil            | Last night, gap to the 14-night mean, Garmin sleep phases, and the restorative share (deep + REM ÷ sleep) compared with its 28-night median | `sleep_*_seconds`, `sleep_score`                                                                                                     |
| VFC et FC au repos | Same usual ranges as Récupération (mean ± 1 SD for HRV, interquartile range for resting HR, 28 days)                                        | `hrv_last_night_ms`, `resting_heart_rate_bpm`                                                                                        |
| Énergie            | Body Battery at wake-up, overnight recharge compared with its 28-day median, the previous day's drain and average stress                    | `body_battery_wake`, `body_battery_charged`, `body_battery_drained`, `average_stress` (empty until garmin_mcp provides Body Battery) |
| Stress             | Previous full day's Garmin average: ≤ 25 calm, ≤ 50 low, ≤ 75 moderate, above high                                                          | `average_stress`                                                                                                                     |
| Charge et forme    | Acute ÷ chronic Garmin load: < 0.8 low, 0.8–1.5 productive, > 1.5 high; VO₂max, Garmin recovery time and 4-week load focus                  | `training_load_*`, `vo2_max`, `recovery_time_minutes`, `load_focus_*`                                                                |

Every chart can be inspected with a pointer, by touch or with the arrow keys; each value shows its date, unit and reference.

### Jour

`/progress/health?view=day&date=YYYY-MM-DD` (today by default, up to two years back) reads the day and the previous day from garmin_mcp's `GET /v1/wellness/days/{date}`, fetched on demand and never stored, plus the day's activities and the stored daily observations for reference ranges. The window runs from 22:00 the previous evening to 22:00, Europe/Paris time; the future part of today is hatched and never drawn.

- Indicators: sleep (phases sum, bedtime, wake time, awakenings), the night's HRV against the usual range, resting HR against its median, latest Body Battery against wake-up, average stress with its longest high episode, and steps against the Garmin goal.
- Timeline: sleep phases, heart rate (2-minute averages) with resting HR, stress (3-minute bars coloured by Garmin category), Body Battery and hourly steps. Ten-minute slots feed the inspector.
- Moments: bedtime, night awakenings of 5 minutes or more, wake-up with Body Battery and overnight recharge, recorded activities, high-stress episodes (above 50 for at least 30 minutes while awake) and the longest calm pause (25 or less for at least 20 minutes after waking) with its Body Battery change.
- Reading: a deterministic headline from sleep against the 14-night mean and the presence of a high-stress episode.

When garmin_mcp cannot provide the day, the page says why (unavailable, reconnection required, rate limit) and the week view stays available. The reference's Body Battery projection and plan actions are not shown.

## Records

`/progress/records` reads the complete owner activity and lap history, 400 days of observations, upcoming goals, and only elapsed time, cumulative distance and elevation arrays from normalized Garmin tracks. Read errors produce an explicit failure state. Track arrays are validated with Zod and capped at 240 samples; unusable tracks leave VAM unavailable.

Road estimates cover 1 km, mile, 5 km, 10 km, half marathon and marathon. Only outdoor road and track runs participate. Whole activities or adjacent lap indexes must cover the exact distance with at most 5% overshoot; duration scales to the target distance. Invalid laps break continuity. Record histories retain strict improvements in chronological order, with day then activity identifier resolving ties deterministically. These are Stride estimates from Garmin data, not official Garmin records.

Endurance histories cover longest outdoor run distance and duration, highest single outdoor run gain, highest Monday-based weekly running gain and distance, and best sustained climbing VAM. Weekly totals include treadmill runs. Missing measurements remain unavailable; measured zero elevation is valid. Activities dated after today (using their local day) and observations dated after today are excluded. Weekly gain and distance totals are eligible separately only when every running activity that week has a valid measurement for that metric.

VAM uses aligned finite elapsed/distance/elevation samples with strictly increasing time and distance. Eligible windows span exactly 1,200 seconds with interpolated endpoints, contain no descent or sample gap above 300 seconds, and average 12–16% grade. Gain multiplied by three yields estimated m/h. Whole-run gain never substitutes for a climbing window.

`?filter=all|road|trail` controls visible record sections and chronology. Road disclosures show the strict history, inspectable chart, dates, provenance and activity links. Current road predictions reuse the Stride model with VO₂ max observed no more than 30 days ago; signed gaps are prediction minus record. Upcoming goals supply factual distance comparisons and current estimates only. Completed races remain unavailable until normalized results and verified activity linkage exist; past goals and target times are never race results. Coach questions, plan actions and future improvements are unavailable capabilities.

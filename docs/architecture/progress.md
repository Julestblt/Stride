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

---
name: plan-format
description: Exact JSON format of a complete training plan for the submit_plan tool, with the rules Stride's validator enforces. Read it before writing a plan.
---

# Plan format for `submit_plan`

Call `submit_plan` with `{"plan": <plan>}` where `<plan>` is one JSON object:

```
{
  "title": string (French, max 120 chars),
  "summary": string (French explanation of the plan's logic for the athlete, max 1200 chars),
  "startsOn": "YYYY-MM-DD" (first planned day, today or later),
  "endsOn": "YYYY-MM-DD" (the objective race date, or the last planned day),
  "primaryRaceId": string | null (id of the objective race from read_athlete_context),
  "raceRoles": [{ "raceId": string, "role": "primary" | "preparation" | "secondary" }],
  "lowConfidenceReasons": string[] (French, empty when confidence is normal, max 5),
  "weeks": [{
    "weekStart": "YYYY-MM-DD" (a Monday; one entry per week from the week containing startsOn to the week containing endsOn),
    "phase": "lead_in" | "base" | "build" | "specific" | "taper" | "race" | "recovery" | "transition",
    "notes": string | null (French, max 280 chars),
    "sessions": [{
      "date": "YYYY-MM-DD",
      "sport": "run" | "trail" | "strength" | "cross",
      "kind": "easy" | "long" | "recovery" | "tempo" | "threshold" | "intervals" | "hills" | "race_specific" | "race" | "strength" | "mobility" | "cross",
      "title": string (French, max 80 chars),
      "purpose": string (French, max 280 chars),
      "key": boolean (true for the week's key sessions),
      "km": number | null,
      "elevationGainMeters": integer | null,
      "terrain": "road" | "trail" | "track" | "treadmill" | "mixed" | null,
      "steps": [ step | { "repeat": integer >= 2, "steps": [step, ...] } ]
    }]
  }]
}
```

`step` is `{ "type": "warmup" | "work" | "recovery" | "cooldown", "minutes": number, "intensity": "recovery" | "easy" | "marathon" | "threshold" | "interval" | "repetition", "target": "pace M:SS-M:SS" | "hr MIN-MAX" | "rpe MIN-MAX" | "none" }`. Paces are per kilometre.

Rules:

- Every session has at least one work step, and every work step has a target other than `"none"`. The session duration is the sum of its steps.
- Every `run` and `trail` session has `km`, including quality sessions: estimate it from the steps' durations and paces (use the easy pace for warm-up, recoveries and cool-down). Leave `km` null only for `strength`, `cross` and `mobility`.
- Do not list rest days. The objective race is a session of kind `race` on the race date.
- Every week from `startsOn` to `endsOn` is fully detailed.
- Schedule sessions only on the athlete's available weekdays, keep weekday sessions within the maximum weekday duration, respect the weekly maximum, and schedule nothing during unavailable periods.
- Races the plan does not target but that fall inside it get a role in `raceRoles` and a session of kind `race` on their date.

The tool answers with the proposal id, or with `invalid_plan` (format errors with their JSON path) or `validation_failed` (blocking rules). Fix every listed problem and submit the complete plan again. Warnings do not block; mention the important ones to the athlete.

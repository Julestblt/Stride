---
name: status-reports
description: Short factual status answers about today's session, the current week or the next race. Verdict line first, read-only, never proposes a change. Use when the athlete asks what is planned today, how the week is going, or how race preparation stands.
---

# Status reports: today, week, race

These answers report facts already on record. They never create a proposal, never call `submit_plan` or `create_plan_proposal`, never ask a question of your own, and never suggest changing the plan. If the athlete then asks for a change, handle it as a normal request. Consulting Medical and relaying its questions follow your usual rules.

Common rules:

- Call `read_athlete_context` first; its `today` is the reference date.
- Write the first line in the fixed shape below, then at most a few short lines.
- Missing data is said in one line, never filled in. Never invent a session, a number or a status.
- Write dates as JJ/MM/AAAA and distances in km.
- If no active plan exists, say « aucun plan actif » instead of inventing sessions.

## Today

First line: `Aujourd'hui — <séance prévue / repos + le motif en quelques mots>`.

- Read today's sessions with `read_active_plan` (`from` and `to` = today). Report the session's kind, duration or distance, and intensity target, or « repos » when nothing is planned.
- When `read_plan_progress` is available, report whether today's session is already done. Until then, if asked whether it was done, say « suivi de la séance pas encore disponible ».
- Morning check: report today's wellness check-in from `read_athlete_context` (legs, soreness, stress), or « pas de check-in aujourd'hui ». Do not judge readiness from Garmin data in a status answer; if the check-in or the athlete's message reports pain, illness or unusual fatigue, consult Medical as usual.
- No weather line: Stride has no weather tool for the coach yet.

## Week

First line: `Semaine — <réalisé>/<prévu>` (duration or km), with the Monday-to-Sunday week covering today.

- Planned: read the week with `read_active_plan` (Monday to Sunday).
- When `read_plan_progress` is available, use it for each session's status (`réalisée`, `manquée`, `à venir`) and the completed load.
- Until then: list the planned sessions with their date, kind and load, read the runs completed since Monday with the garmin `get_activities` tool (newest first, `start` 0 and `limit` at most 20, no dates) and keep only the runs dated from Monday to today, and give the completed total from those runs. Say « suivi séance par séance pas encore disponible » and do not pair runs with sessions yourself.
- Do not rerun guardrails: Stride's validator checks every plan and proposal.

## Race

First line: `Course — J-<jours> <nom de la course>` for the next race in `read_athlete_context`, or `Course — aucune course à venir`.

- Count the days from `today` to the race date; give the date, distance, elevation, priority and target as recorded.
- Report the deterministic feasibility reference for the objective race as one indicator among others, with its own wording; never present it as a certainty.
- Say « plan de course pas encore disponible pour le coach » rather than giving paces or fueling numbers that no tool returned.

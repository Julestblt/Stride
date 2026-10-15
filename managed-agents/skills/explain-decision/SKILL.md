---
name: explain-decision
description: Explain a plan proposal or plan change only from what was recorded with it. Read-only; says « aucune décision trouvée » rather than inventing a reason. Use when the athlete asks why a session or the plan changed or why something was proposed.
---

# Explain a decision

Explain only from recorded proposal fields: title, summary, rationale, operations, origin, specialist opinions and status, plus the validation result when `read_plan_history` returns it. Never add a reason that is not in one of these fields, never rebuild one from training load, a health signal or a general impression, and never create, change or resubmit anything while explaining.

## Which decision

- A date or a session named by the athlete: the proposal whose operations touch that date or session.
- Otherwise: the most recent proposal with status `ready`, `accepted` or `applied`.

## Where the record comes from

- When `read_plan_history` is available, read the proposals from it.
- Until then, only the proposals created in this conversation are on record: the `create_plan_proposal` input and the result returned, or for a new plan sent with `submit_plan`, its title, summary and `lowConfidenceReasons`. For anything older, say « l'historique des décisions passées n'est pas encore disponible ».
- `read_active_plan` shows the current sessions and plan version, which can confirm what changed, never why.

## Answer

First line: `Pourquoi — <résumé de la proposition>` or `Pourquoi — aucune décision trouvée`. With no matching record, stop after that line and the missing-history sentence when it applies.

Then, briefly:

- the reason as written in the rationale, and each specialist opinion with its author (« Le médecin recommandait… »);
- what changed: each operation as before and after, with dates as JJ/MM/AAAA;
- the status: when it is `ready` (waiting for the athlete) or `accepted` (approved, not yet applied), say that the plan has not changed yet.

---
name: explain-decision
description: Explain a plan proposal or plan change only from what was recorded with it. Read-only; says « aucune décision trouvée » rather than inventing a reason. Use when the athlete asks why a session or the plan changed or why something was proposed.
---

# Explain a decision

Explain only from recorded proposal fields: title, summary, rationale, operations, origin, specialist opinions and status, the validation result when one is recorded, and the decisions taken on the proposal. Never add a reason that is not in one of these fields, never rebuild one from training load, a health signal or a general impression, and never create, change or resubmit anything while explaining.

## Which decision

- A date or a session named by the athlete: the proposal whose operations touch that date or session.
- Otherwise: the most recent proposal with status `ready`, `accepted` or `applied`.

## Where the record comes from

- Read the proposals with `read_plan_history` (newest first; pass `proposalId` to read one, or `status` to filter). Each entry carries its decisions: accepted, rejected, applied, reverted, expired, superseded or stale, with dates.
- `read_active_plan` shows the current sessions and plan version, which can confirm what changed, never why.

## Answer

First line: `Pourquoi — <résumé de la proposition>` or `Pourquoi — aucune décision trouvée`. With no matching record, stop after that line.

Then, briefly:

- the reason as written in the rationale, and each specialist opinion with its author (« Le médecin recommandait… »);
- what changed: each operation as before and after, with dates as JJ/MM/AAAA;
- the status: when it is `ready` (waiting for the athlete) or `accepted` (approved, not yet applied), say that the plan has not changed yet.

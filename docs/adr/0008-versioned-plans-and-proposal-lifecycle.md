# ADR 0008: Versioned plans changed only through validated, athlete-approved proposals

- Status: Accepted, amended by decisions D3 and D6 (2026-10-13, #94)
- Date: 2026-10-13
- RFC: [agentic coaching engine](../architecture/coaching-engine/README.md) (#86)

## Context

E-04 requires that a plan can be reviewed and rejected without changing the active plan, and that changes have a visible rationale and history. The Historique design reference shows every change with its signals, proposer, decision and an undo action. The AI must never overwrite plans or rewrite completed training.

## Decision

- Plans are stored as immutable versions. Blocks, weeks and sessions are revisioned rows with a stable key and a `valid_from_version` / `valid_to_version` range, so unchanged rows are shared between versions.
- Sessions dated before the athlete's local today, or matched to an activity, are frozen; the database apply function rejects changes to them.
- Every AI-originated change is a proposal: a closed set of typed operations against an expected base version, with origin, requester, evidence, assumptions, uncertainty, specialist opinions, validator report and expiry. At most one ready proposal exists per target.
- Status moves along draft → ready → accepted → applied, or to rejected, expired, superseded, stale, invalid or reverted. Every transition writes an append-only decision record.
- The athlete accepts or rejects through ownership-checked RPCs. Only the coach worker applies an accepted proposal, after re-validating it, in one transaction that checks the base version.
- Undo creates an inverse proposal and a new version; history is never edited.
- Agents never modify athlete-owned profile, goal or race rows; plan-level race roles live in plan versions.
- Every session of every week carries its complete structure and targets from the first version (D6); there are no provisional weeks. Later weeks change only through proposals, for example from the weekly review.

## Alternatives considered

- Full snapshot copy per version.
- Event sourcing with replay on read.
- One JSON document per version.
- Letting the athlete-facing server apply changes with a service credential.

## Trade-offs

Revisioned rows need range predicates and careful indexing, and the changeset logic must be tested thoroughly. In exchange, storage grows with changes only, any version is queryable, and the single-writer rule keeps one mutation path.

## Consequences

- Plan reads filter on `valid_to_version is null` for the active version.
- Adherence links to session keys and revisions, so planned-versus-completed history stays stable after later changes.
- There are no automatic changes in V1 (D3). If the product owner revisits that decision, automatic changes reuse the same lifecycle with an explicit approval mode and undo window.

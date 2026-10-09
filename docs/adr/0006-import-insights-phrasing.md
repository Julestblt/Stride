# ADR 0006: Deterministic import insights with optional model phrasing

- Status: Accepted
- Date: 2026-10-10

## Context

The import step mockup shows "Ce que je remarque" observations. FR-16 originally excluded insights to avoid fabricated content. The owner asked for them with limited token use, using OpenCode Go with a DeepSeek model.

## Decision

- Compute every observation in code from normalized Garmin data read under RLS. A fact is shown only when enough data exists.
- Optionally ask a language model to rephrase the computed sentences once the activity import is complete. Validate its JSON output and reject added numbers, percentages or unknown keys.
- Fall back to deterministic sentences whenever the model is unconfigured, slow, failing or rejected.
- Cache per athlete and limit calls to one per ten minutes.

## Consequences

- The import step never depends on model availability, and invented figures cannot reach the athlete.
- Aggregated health metrics leave Stride for the provider; identity and raw rows do not.
- OpenCode Go is documented for coding agents. Before production, confirm its terms for application traffic or switch the OpenAI-compatible endpoint to another provider.
- Insights are not persisted yet; a restart can trigger one new call per athlete.

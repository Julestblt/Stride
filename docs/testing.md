# Testing expectations

- Use Vitest for focused unit tests of domain rules, parsing, and deterministic behavior.
- Use Playwright for user-visible browser flows and smoke coverage.
- Keep domain code framework-independent where practical so it is easy to test.
- Validate external inputs at boundaries and cover valid, invalid, and incomplete cases.
- Add integration tests when persistence or external service behavior is introduced.
- Cover database ownership, constraints and functions with pgTAP tests in `supabase/tests/database`, run with `npm run db:test` against the local Supabase stack. Every Stride table needs cross-athlete and anonymous access tests.
- AI behavior will need curated evaluations for coaching quality, safety, and regression; no evaluation framework is included yet.

Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build` before a pull request when relevant.

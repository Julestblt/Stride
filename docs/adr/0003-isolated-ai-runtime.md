# ADR 0003: Isolate AI behavior from the user interface

- Status: Accepted
- Date: 2026-10-07

## Context

Stride expects multiple specialized coaching roles and structured running-domain skills. UI-level provider calls would make behavior difficult to secure, evaluate, and evolve.

## Decision

Future AI behavior will live in a server-side runtime with separate orchestration, agents, skills, context, schemas, tool access, domain logic, observability, and evaluations.

## Consequences

No model provider or fake agent is added now. UI code will use application boundaries rather than call model providers.

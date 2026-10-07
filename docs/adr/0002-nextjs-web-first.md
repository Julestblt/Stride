# ADR 0002: Start with a web-first Next.js application

- Status: Accepted
- Date: 2026-10-07

## Context

Stride needs a responsive initial product and should preserve the option of adding native clients later.

## Decision

Use Next.js App Router, TypeScript, and React as the web application foundation. Keep domain rules and server contracts independent from page components.

## Consequences

One responsive web client is supported first. Native applications and PWA-specific behavior are deferred until they have product requirements.

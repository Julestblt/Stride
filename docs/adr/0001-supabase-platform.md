# ADR 0001: Use Supabase as the initial data platform

- Status: Accepted
- Date: 2026-10-07

## Context

Stride needs managed PostgreSQL and plans to use authentication and storage without committing to a large custom platform.

## Decision

Use Supabase for PostgreSQL, Auth, and future Storage. Keep application access behind server integration boundaries and apply row-level security to user data.

## Consequences

The application avoids a custom database operations layer at the foundation stage. Real schemas, policies, and migrations wait for product requirements.

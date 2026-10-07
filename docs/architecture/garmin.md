# Garmin integration direction

Stride will not couple its web application to a local Garmin MCP process. Garmin Connect integration belongs behind a dedicated service boundary:

```text
Garmin Connect
  -> Garmin integration service
  -> normalized application data
  -> Stride backend and Supabase
  -> Stride AI runtime
```

The integration service owns provider-specific authentication, synchronization, retries, and mapping. Stride stores normalized application data and provenance so the product and AI runtime do not depend on Garmin-specific payloads. An MCP interface may later expose approved Stride capabilities to agents; MCP is an interface, not the source of truth.

This foundation implements no Garmin authentication, API calls, synchronization, or data schema.

The [garmin_mcp project](https://github.com/taxuspt/garmin_mcp) is a reference for possible Garmin tool capabilities. Stride keeps provider connectivity behind its integration service rather than coupling the web application to a local MCP process.

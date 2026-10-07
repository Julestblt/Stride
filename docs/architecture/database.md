# Data platform

Supabase is the initial managed platform for PostgreSQL, Auth, and future Storage. Application access should use explicit server integration modules, typed domain boundaries, and migrations only when a product issue defines real data requirements.

No production schema or demonstration tables are included. Before adding athlete data, define ownership, row-level security, retention, deletion, and access paths. Never use a service-role key in a browser or bypass row-level security for convenience. Keep provider payloads and normalized domain records distinguishable.

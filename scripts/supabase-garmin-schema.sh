#!/usr/bin/env bash
set -euo pipefail

revision="${GARMIN_MCP_REVISION:-31f20f67cf1169a71bd27718f187355272f8a347}"
container="${SUPABASE_DB_CONTAINER:-supabase_db_stride}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

curl -fsSL "https://codeload.github.com/Julestblt/garmin_mcp/tar.gz/${revision}" \
  | tar -xz -C "$work" --strip-components=1 --wildcards '*/supabase/migrations/*.sql'

for migration in "$work"/supabase/migrations/*.sql; do
  echo "Applying garmin_mcp $(basename "$migration")"
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$migration"
done

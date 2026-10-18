#!/usr/bin/env bash
set -euo pipefail

revision="${GARMIN_MCP_REVISION:-56b06070da1a4f119141f2e1653ab8b4f2dcba2c}"
container="${SUPABASE_DB_CONTAINER:-supabase_db_stride}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

curl -fsSL "https://codeload.github.com/Julestblt/garmin_mcp/tar.gz/${revision}" \
  | tar -xz -C "$work" --strip-components=1 --wildcards '*/supabase/migrations/*.sql'

for migration in "$work"/supabase/migrations/*.sql; do
  echo "Applying garmin_mcp $(basename "$migration")"
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$migration"
done

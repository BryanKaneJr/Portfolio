#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres (with Supabase auth stubs) and
# runs each SQL acceptance test in its own fresh copy of that database.
#
#   npm run test:db
set -euo pipefail
source "$(dirname "$0")/lib.sh"

pg_up "${PGTEST_PORT:-54329}"
content_sql "$PG_SOCKET_DIR/content.sql"

for t in "$tests_dir"/*.test.sql; do
  name="$(basename "$t" .test.sql)"
  echo "test     $name"
  psql_on postgres -c "create database \"t_$name\" template bs_template"
  psql_on "t_$name" -v content_sql="$PG_SOCKET_DIR/content.sql" -f "$t"
done

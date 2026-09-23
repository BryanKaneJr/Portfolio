#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres (with Supabase auth stubs) and
# runs the SQL acceptance tests. Needs Postgres server binaries, not Docker.
#
#   npm run test:db
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../supabase/migrations"

pg_bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$pg_bin/initdb" ]] || pg_bin="$(dirname "$(command -v initdb)")"

tmp="$(mktemp -d)"
port="${PGTEST_PORT:-54329}"
as_pg=()
if [[ "$(id -u)" == 0 ]]; then
  # initdb refuses to run as root.
  chown postgres "$tmp"
  as_pg=(runuser -u postgres --)
fi

cleanup() { "${as_pg[@]}" "$pg_bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

"${as_pg[@]}" "$pg_bin/initdb" -D "$tmp/data" -U postgres --auth=trust >/dev/null
"${as_pg[@]}" "$pg_bin/pg_ctl" -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -w start >/dev/null

psql=(psql -h "$tmp" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${psql[@]}" -f "$here/supabase-stubs.sql"
for f in "$migrations"/*.sql; do
  echo "migrate  $(basename "$f")"
  "${psql[@]}" -f "$f"
done
"${psql[@]}" -f "$here/fixtures.sql"
for t in "$here"/*.test.sql; do
  echo "test     $(basename "$t")"
  "${psql[@]}" -f "$t"
done

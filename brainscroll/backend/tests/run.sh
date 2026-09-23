#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres (with Supabase auth stubs) and
# runs each SQL acceptance test in its own fresh copy of that database.
# Needs Postgres server binaries (no Docker) and Node (to generate content SQL).
#
#   npm run test:db
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
migrations="$here/../supabase/migrations"

pg_bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$pg_bin/initdb" ]] || pg_bin="$(dirname "$(command -v initdb)")"

tmp="$(mktemp -d)"
chmod 755 "$tmp"
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

psql_on() { psql -h "$tmp" -p "$port" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }

psql_on postgres -c "create database bs_template"
psql_on bs_template -f "$here/supabase-stubs.sql"
for f in "$migrations"/*.sql; do
  echo "migrate  $(basename "$f")"
  psql_on bs_template -f "$f"
done

# Real curriculum as an import script (drafts treated as published, like staging).
(cd "$repo" && npx --no-install tsx scripts/import-content.ts --sql "$tmp/content.sql" --publish-drafts >/dev/null)

for t in "$here"/*.test.sql; do
  name="$(basename "$t" .test.sql)"
  echo "test     $name"
  psql_on postgres -c "create database \"t_$name\" template bs_template"
  psql_on "t_$name" -v content_sql="$tmp/content.sql" -f "$t"
done

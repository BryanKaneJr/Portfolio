# Shared helpers: a throwaway Postgres with Supabase auth stubs and all migrations.
# Source this file, then call pg_up. Requires Postgres server binaries (no Docker).

pg_bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$pg_bin/initdb" ]] || pg_bin="$(dirname "$(command -v initdb)")"
tests_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$tests_dir/../.." && pwd)"

# pg_up <port>: sets PG_SOCKET_DIR / PG_PORT and creates database bs_template (migrated).
pg_up() {
  PG_PORT="$1"
  PG_SOCKET_DIR="$(mktemp -d)"
  chmod 755 "$PG_SOCKET_DIR"
  as_pg=()
  if [[ "$(id -u)" == 0 ]]; then
    chown postgres "$PG_SOCKET_DIR" # initdb refuses to run as root
    as_pg=(runuser -u postgres --)
  fi
  "${as_pg[@]}" "$pg_bin/initdb" -D "$PG_SOCKET_DIR/data" -U postgres --auth=trust >/dev/null
  "${as_pg[@]}" "$pg_bin/pg_ctl" -D "$PG_SOCKET_DIR/data" -o "-p $PG_PORT -k $PG_SOCKET_DIR -c listen_addresses=''" -w start >/dev/null
  trap pg_down EXIT

  psql_on postgres -c "create database bs_template"
  psql_on bs_template -f "$tests_dir/supabase-stubs.sql"
  for f in "$tests_dir"/../supabase/migrations/*.sql; do
    echo "migrate  $(basename "$f")"
    psql_on bs_template -f "$f"
  done
}

pg_down() {
  "${as_pg[@]}" "$pg_bin/pg_ctl" -D "$PG_SOCKET_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$PG_SOCKET_DIR"
}

psql_on() { psql -h "$PG_SOCKET_DIR" -p "$PG_PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }

# content_sql <file>: the real curriculum as an import script (drafts published, like staging).
content_sql() {
  (cd "$repo_dir" && npx --no-install tsx scripts/import-content.ts --sql "$1" --publish-drafts >/dev/null)
}

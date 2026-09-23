#!/usr/bin/env bash
# End-to-end: build the web app, serve it, and drive it with Playwright.
#
#   npm run e2e            # local mode: offline play, bundled content
#   npm run e2e:remote     # Supabase mode against real migrations + content,
#                          # via backend/tests/fake-supabase.mjs (no Docker)
#
# Needs Chromium for Playwright (PLAYWRIGHT_BROWSERS_PATH or `npx playwright install chromium`)
# and, for remote mode, Postgres server binaries.
set -euo pipefail
mode="${1:-local}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
web_port="${E2E_WEB_PORT:-8790}"
pids=()

cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  [[ "$(type -t pg_down)" == function ]] && pg_down
  rm -rf "$work"
}
trap cleanup EXIT

if [[ "$mode" == remote ]]; then
  source "$root/backend/tests/lib.sh"
  pg_up "${E2E_PG_PORT:-54331}"
  trap cleanup EXIT # pg_up installs its own trap; keep ours
  content_sql "$work/content.sql"
  psql_on postgres -c "create database e2e template bs_template"
  psql_on e2e -f "$work/content.sql" >/dev/null
  PGHOST="$PG_SOCKET_DIR" PGPORT="$PG_PORT" PGDATABASE=e2e PORT="${E2E_API_PORT:-54400}" node "$root/backend/tests/fake-supabase.mjs" &
  pids+=($!)
  export EXPO_PUBLIC_SUPABASE_URL="http://localhost:${E2E_API_PORT:-54400}"
  export EXPO_PUBLIC_SUPABASE_ANON_KEY="$(node -e "const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');console.log(b({alg:'HS256',typ:'JWT'})+'.'+b({role:'anon',iss:'e2e'})+'.x')")"
  export E2E_PSQL="psql -h $PG_SOCKET_DIR -p $PG_PORT -U postgres -d e2e -v ON_ERROR_STOP=1 -qtA"
else
  unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
fi

echo "build    web ($mode)"
(cd "$root/app" && CI=1 npx expo export --platform web --clear --output-dir "$work/web" >"$work/build.log" 2>&1) \
  || { grep -v '^\s*at ' "$work/build.log" | tail -30; exit 1; }
python3 -m http.server "$web_port" -d "$work/web" >/dev/null 2>&1 &
pids+=($!)
sleep 1

echo "e2e      $mode"
E2E_URL="http://localhost:$web_port/" node "$root/e2e/$mode.mjs"

#!/usr/bin/env bash
# The app preview (docs/app-preview.md): the web app in local mode (offline
# play, simulated sign-in, nothing sent to a server), built for Cloudflare
# Pages into app/dist-preview. `_redirects` sends each dynamic route
# (/level/ID) to its page, as e2e/serve.mjs does.
set -euo pipefail
app="$(cd "$(dirname "$0")" && pwd)"
out="$app/dist-preview"
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
# Apple and Google need the real services; email takes the simulated code shown on screen.
export EXPO_PUBLIC_SIGN_IN_METHODS=email
rm -rf "$out"
(cd "$app" && CI=1 npx expo export --platform web --clear --output-dir "$out")
: >"$out/_redirects"
for page in "$out"/*/\[*\].html; do
  dir="$(basename "$(dirname "$page")")"
  param="$(basename "$page" .html | tr -d '[]')"
  cp "$page" "$out/$dir/_$param.html"
  echo "/$dir/:$param /$dir/_$param 200" >>"$out/_redirects"
done
cat "$out/_redirects"

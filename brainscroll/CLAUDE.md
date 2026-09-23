# BrainScroll — notes for AI coding agents

Read `docs/product-rules.md` before changing anything that touches progression, XP, the daily cap, IDs or content. Those rules are contracts.

## Commands (run from `brainscroll/`)

- `npm run check`: typecheck all workspaces, run core unit tests, and validate `content/`. Run it before every commit.
- `npm run test:db`: apply `backend/supabase/migrations` to a temp Postgres and run `backend/tests/*.test.sql`.
- `npm run app`: Expo dev server. In `app/`, use `npx expo install <pkg>` to add dependencies (it picks SDK-compatible versions). See `app/AGENTS.md`.

## Invariants

- The server owns completion, XP, the daily allowance and entitlements. The client animates results returned by `complete_level`; it never computes awards itself.
- XP is an immutable ledger (`xp_events`) with a unique `(user_id, idempotency_key)`. Never add a mutable XP counter as the source of truth.
- Visible skill level = highest canonical level cleared. It is never derived from XP.
- Stable IDs only (`level.science.astronomy.001`). Never key anything by display name.
- Published `level_revisions` are immutable. To correct content, publish a new revision.
- Constants live in `packages/core/src/constants.ts` **and** `app_settings` / SQL helpers in the migration. Change both together.
- Don't add ads, currencies, hearts/lives, energy, streak punishment, leaderboards, or paywalled subjects. See "Never build" in the product rules.

## Layout

`app/` (Expo Router, routes in `app/src/app/`), `packages/core/` (shared rules + zod schema), `backend/` (Supabase), `content/` (curriculum JSON), `scripts/` (validator), `admin/` (later), `docs/`.

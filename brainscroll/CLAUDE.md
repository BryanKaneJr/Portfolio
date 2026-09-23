# BrainScroll — notes for AI coding agents

Read `docs/product-rules.md` before changing anything that touches progression, XP, the daily cap, IDs or content. Those rules are contracts.

## Commands (run from `brainscroll/`)

- `npm run check`: typecheck all workspaces, lint the app (hook-order bugs are errors), run core unit tests, and validate `content/`. Run it before every commit.
- `npm run content:build`: after editing anything in `content/`, recompile `app/src/content/bundle.json`. `check` fails if the bundle is stale.
- `npm run test:db`: apply `backend/supabase/migrations` to a temp Postgres, then run each `backend/tests/*.test.sql` in a fresh copy of the database. `content-import.test.sql` uses the real `content/`.
- `npm run content:import`: validate and publish `content/` through the `import_content` RPC. Use `--sql <file>` to write SQL instead.
- `npm run e2e` / `npm run e2e:remote`: build the web app and drive it with Playwright. Remote mode runs it against real migrations and content through `backend/tests/fake-supabase.mjs`. Run both after changing screens or progress code.
- `npm run app`: Expo dev server. In `app/`, use `npx expo install <pkg>` to add dependencies (it picks SDK-compatible versions). See `app/AGENTS.md`.

## Invariants

- The server owns completion, XP, the daily allowance and entitlements. The client animates results returned by `complete_level`; it never computes awards itself.
- XP is an immutable ledger (`xp_events`) with a unique `(user_id, idempotency_key)`. Never add a mutable XP counter as the source of truth.
- Visible skill level = highest canonical level cleared. It is never derived from XP.
- BrainScroll is a learning app, not a quiz app. Regular levels are hook → 2–4 learning cards → **3 questions** (recall, understanding, connection). Only checkpoints (~5), milestones (5–7) and the Level 100 Mastery Challenge (~10) test more. Question counts come from `LEARNING_STRUCTURE` by level `type`; never hard-code them.
- Stable IDs only (`level.science.astronomy.001`). Never key anything by display name.
- Published `level_revisions` are immutable. To correct content, publish a new revision.
- The app talks to progress only through `ProgressBackend` (`app/src/progress/backend.ts`). `remoteBackend.ts` calls Supabase RPCs, and `localBackend.ts` is for offline play. Keep both implementations in step.
- Local play (`app/src/progress/localBackend.ts`) runs `completeLevel` from `packages/core/src/completion.ts`, which mirrors the SQL `complete_level`. The same goes for `buildReviewQueue`/`submitReview` and `get_review_queue`/`submit_review`. If you change one, change the other, and keep `completion.test.ts`/`review.test.ts` in step with `core-loop.test.sql`/`review.test.sql`.
- Constants live in `packages/core/src/constants.ts` **and** `app_settings` / SQL helpers in the migration. Change both together.
- Don't add ads, currencies, hearts/lives, energy, streak punishment, leaderboards, or paywalled subjects. See "Never build" in the product rules.

## Layout

`app/` (Expo Router, routes in `app/src/app/`), `packages/core/` (shared rules + zod schema), `backend/` (Supabase), `content/` (curriculum JSON), `scripts/` (validator), `admin/` (later), `docs/`.

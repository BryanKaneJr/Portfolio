# BrainScroll: notes for AI coding agents

Read `docs/product-rules.md` before changing anything that touches progression, XP, the daily cap, IDs or content. Those rules are contracts. The full product specs live in `docs/specs/*.md` (Markdown is the working source; `docs/source/*.docx` are snapshots). When a product rule changes, update the spec, the digest in `docs/` and the code together.

## Commands (run from `brainscroll/`)

- `npm run check`: typecheck all workspaces, lint the app (hook-order bugs are errors), lint copy for em dashes, run core, scripts and admin unit tests, and validate `content/`. Run it before every commit.
- `npm run content:build`: after editing anything in `content/`, recompile `app/src/content/bundle.json`. `check` fails if the bundle is stale.
- `npm run test:db`: apply `backend/supabase/migrations` to a temp Postgres, then run each `backend/tests/*.test.sql` in a fresh copy of the database. `content-import.test.sql` uses the real `content/`.
- `npm run content:import`: validate and publish `content/` through the `import_content` RPC. Use `--sql <file>` to write SQL instead.
- `npm run e2e` / `npm run e2e:remote`: build the web app and drive it with Playwright. Remote mode runs it against real migrations and content through `backend/tests/fake-supabase.mjs`. Run both after changing screens or progress code.
- `npm run supabase:check`: validate the app's Supabase URL/key (never a secret key) and, with network, probe the project read-only. See `docs/supabase-setup.md`.
- `npm run insights:pull`: pull aggregate learner insights and open content reports from Supabase (service key) into `admin/.data/` for the admin. See `docs/analytics.md`.
- `npm run admin`: the local Content Admin (http://127.0.0.1:4321). It browses, edits, validates and previews levels in `content/` and controls draft/published (see `admin/README.md`).
- `npm run app`: Expo dev server. In `app/`, use `npx expo install <pkg>` to add dependencies (it picks SDK-compatible versions). See `app/AGENTS.md`.

## Invariants

- **No em dashes (U+2014) in anything BrainScroll-authored**: curriculum, UI copy, docs, errors, comments, generated content. Rewrite the sentence (comma, colon, semicolon, parentheses, period or conjunction); never substitute mechanically. Only verbatim source quotes (`supportingQuote`) and source title/publisher/URL are exempt. `validate:content` and `lint:copy` (both in `check`) enforce it; see `docs/content-guide.md` "Editorial rules".

- The server owns completion, XP, the daily allowance and entitlements. The client animates results returned by `complete_level`; it never computes awards itself.
- XP is an immutable ledger (`xp_events`) with a unique `(user_id, idempotency_key)`. Never add a mutable XP counter as the source of truth.
- Visible skill level = highest canonical level cleared. It is never derived from XP.
- BrainScroll is a learning app, not a quiz app. Regular levels are hook → 2–4 learning cards → **3 questions** (recall, understanding, connection). Only checkpoints (5), the Level 50 milestone (7) and the Level 100 Mastery Challenge (10) test more. These canonical counts live in `LEARNING_STRUCTURE[type].questions.standard` (also exported as `STANDARD_QUESTIONS`); never hard-code them, and never describe them as ranges.
- Weekly Knowledge Quests (post-MVP) count only new levels, and their progress is **derived from `LEVEL_COMPLETE` rows in `xp_events`**. Never add a separate quest counter, a second XP total, or anything that stores levels or trophies twice. Quests are free-completable, archive to the Chronicle, and must not block the MVP. Nothing dwarfs a level: keep every award in proportion to a regular level's 100 XP.
- Level completion is **first attempt → reinforcement → resolution → progression**. Every attempt goes through `answer_question` (first attempt recorded once, immutable); `complete_level` requires every question resolved and awards XP from first attempts only, from each level type's own pool (`LEARNING_STRUCTURE[type].firstAttemptXp` / `level_xp_curve`; never hard-code XP in the UI). Corrections never add XP. Level 100·k earns the ★ by being resolved, with no minimum score and no separate bonus. Review works the same way: `submit_review` records the first attempt per scheduled occurrence (+10 if right), a miss must be corrected with its source cards, and the answer is never revealed. **First attempts set reward and memory strength; resolution sets completion and progression.** Never grade from bundle `correct` flags in remote mode: learners get stripped bundles (`learner_bundle`).
- **An account comes first; there is no guest mode.** Learners sign in (Apple, Google, phone or email) before any progress exists. Never call `signInAnonymously`, keep device-only or guest progress, or add guest migration, merge or cleanup. The database refuses anonymous users (`handle_new_user`). Device-side state (sessions, onboarding, active skill) is keyed per account. See `docs/accounts.md`.
- **Account deletion must stay complete.** `delete_my_account()` deletes the auth user, and everything cascades through `profiles`. Any new table holding a learner's data must reference `profiles (id) on delete cascade`, and `account-deletion.test.sql` must list it.
- Every question has `sourceCardIds`. A wrong answer shows those canonical cards; never generate recovery text at runtime.
- Stable IDs only (`level.science.astronomy.001`). Never key anything by display name.
- Published `level_revisions` are immutable. To correct content, publish a new revision.
- The app talks to progress only through `ProgressBackend` (`app/src/progress/backend.ts`). `remoteBackend.ts` calls Supabase RPCs, and `localBackend.ts` is the development harness (shared rules on-device, simulated accounts, used only without Supabase config). Keep both implementations in step.
- Local play (`app/src/progress/localBackend.ts`) runs `completeLevel` from `packages/core/src/completion.ts`, which mirrors the SQL `complete_level`. The same goes for `buildReviewQueue`/`submitReview` and `get_review_queue`/`submit_review`. If you change one, change the other, and keep `completion.test.ts`/`review.test.ts` in step with `core-loop.test.sql`/`review.test.sql`.
- Constants live in `packages/core/src/constants.ts` **and** `app_settings` / SQL helpers in the migration. Change both together.
- Analytics measure learning and product health, never time spent: no durations, session lengths or engagement minutes. Client events must be in `ANALYTICS_EVENTS` (core) **and** `analytics_event_names` (SQL); props are flat and PII-free. See `docs/analytics.md`.
- Don't add ads, currencies, hearts/lives, energy, streak punishment, or paywalled subjects. Unlimited's only progression effect is removing the daily cap; it may carry cosmetic/personalization perks, but never XP, knowledge, trophies or accomplishment cosmetics (those stay earned). Leaderboards, friends and challenges are post-MVP only (friends-only, weekly reset, never time/speed-based); don't build them yet. See "Never build" in the product rules.

## UI

- Build screens from `app/src/components/ui` primitives and `theme/tokens.ts`; don't restyle raw views. **Learning mode is quiet and progression mode is loud:** no glow, gold, XP or stats on lesson screens, and gold only for mastery. See `docs/design-system.md`.
- Questions are select → CHECK. Only a checked answer is an attempt, and the first checked answer is the first attempt. Keep e2e helpers (`e2e/helpers.mjs`) in step with the interaction.

## Layout

`app/` (Expo Router, routes in `app/src/app/`), `packages/core/` (shared rules + zod schema), `backend/` (Supabase), `content/` (curriculum JSON), `scripts/` (validator), `admin/` (local content admin), `docs/`.

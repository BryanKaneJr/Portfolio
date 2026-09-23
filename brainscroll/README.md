# BrainScroll

> **Stop scrolling. Start leveling.**

BrainScroll is an anti-doomscrolling knowledge RPG. It uses the familiar feel of a vertical feed, but every session is a **finite, authored level** in a real curriculum. You level up real knowledge the way an RPG character levels up stats: Astronomy Lv. 84, Roman History Lv. 143 ★, Economics Lv. 31.

- **Canonical levels 1–100 per skill tree.** Level 63 means something. Mastery stars at 100, 200… and prestige never resets.
- **5 new levels a day, free forever.** Then the app tells you you're done: *"No more doomscrolling. Go touch grass."* Review stays unlimited.
- **Unlimited ($4.99/mo) removes the cap. That's all it does.** There's no premium knowledge, no ads, no gems, no hearts and no energy.
- **Source-backed, versioned content**, served from our own data. The app never invents facts on the fly.

## Repository layout

| Path | What it is |
| --- | --- |
| [`app/`](app) | Expo + React Native + TypeScript customer app (Expo Router, `src/app/`). |
| [`packages/core/`](packages/core) | Frozen product constants, stable ID rules, content schema (zod), and the pure progression, daily-cap and review math. Used by app, scripts and admin. |
| [`backend/`](backend) | Supabase Postgres migrations, RLS, the `start_level` / `complete_level` server functions, and SQL tests. |
| [`content/`](content) | Versioned curriculum source: subjects, skills, concepts, levels, sources and assets as JSON. |
| [`scripts/`](scripts) | Content validator (and later: importer, duplicate/licence checks, bundle export). |
| [`admin/`](admin) | Internal content authoring/review/publish tool (Stage 7; not started). |
| [`docs/`](docs) | Product rules, build order, content guide, visual direction, and the original planning docs. |

## Getting started

Requires Node 22+.

```bash
cd brainscroll
npm install

npm run check            # typecheck + unit tests + content validation + bundle freshness
npm run content:build    # recompile content/ into the app's offline bundle after editing content
npm run content:import   # publish content to Supabase (see docs/supabase-setup.md)
npm run test:db          # apply migrations to a throwaway Postgres and run SQL tests
npm run app              # start the Expo dev server (press i / a / w)
```

`npm run test:db` needs Postgres server binaries (`initdb`, `pg_ctl`) but no Docker. For a full local Supabase stack, see [`backend/README.md`](backend/README.md).

## Where we are

We're following the [build order](docs/build-order.md). **The loop comes first and the knowledge scales second.**

- [x] Stage 0: product rules frozen ([`docs/product-rules.md`](docs/product-rules.md), [`packages/core/src/constants.ts`](packages/core/src/constants.ts))
- [x] Stage 1: data contracts: content schema and validator, DB schema, RLS, and an exactly-once `complete_level` transaction
- [ ] Stage 2: the Golden 10 Astronomy levels. All 10 are drafted and validated; their sources still need editor verification
- [x] Stage 3: lesson player. All 10 levels play offline from data, with resume, exactly-once completion, XP, the character sheet and the daily cap
- [x] Stage 5: review. Due concepts come back as recall sessions, with delayed-recall XP. Review never uses daily levels
- [x] Onboarding: a first-run intro that gets to Level 1 in about a minute
- [ ] Supabase: the schema, server functions and importer are tested locally; the app isn't connected yet. See [`docs/supabase-setup.md`](docs/supabase-setup.md)

## Read first

1. [`docs/product-rules.md`](docs/product-rules.md): the authoritative rules. If code disagrees with this file, the code is wrong.
2. [`docs/build-order.md`](docs/build-order.md): what to build, in order, and what "done" means.
3. [`docs/content-guide.md`](docs/content-guide.md): how a level is structured and validated.
4. [`docs/visual-direction.md`](docs/visual-direction.md): colours, type, motion and screen intent.

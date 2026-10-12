# BrainScroll handoff

For a new AI (or person) picking this project up cold. It says where things stand, where everything lives, how the owner likes to work, what happened and what's next. It points to the detailed docs rather than repeating them. Last updated 2026-10-12.

**Read in this order:** this file, then [`CLAUDE.md`](CLAUDE.md) (the rules and invariants, kept current), [`docs/product-rules.md`](docs/product-rules.md) (the product contracts), [`docs/release.md`](docs/release.md) (builds, updates, launch list) and the top of [`CHANGELOG.md`](CHANGELOG.md) (the most recent work, newest first).

## 1. What BrainScroll is

An anti-doomscrolling learning app for iPhone (Android later): "Stop scrolling. Start leveling." Every session is a short, finished, source-backed lesson in a real curriculum, laid out as skill trees you level up like an RPG character.

- **Content:** 6 subjects, 26 skill trees, 100 levels each (2,600 levels, 4,645 concepts, 7,652 sources), all in `content/` as JSON. A regular level is a hook, 2 to 5 learning cards, then 3 questions (multiple choice, fill in the blank, match, order). Checkpoints, Level 50 and Level 100 test more.
- **Free forever, paced by Brainpower:** a new level costs 1, you refill to 5 a day, hold up to 10, and earn more by learning. Review, replays and wrong answers never cost anything.
- **Unlimited** ($4.99 a month, $39.99 a year, week-long free trial) gives unlimited Brainpower and nothing else that counts toward progress.
- **Around the lessons:** review on a schedule, chapter reviews, trophies, a learning streak that never guilts, map chests with XP boosts and cosmetics, Weekly Quests (52 dated, one a week from Monday 12 October 2026), friends, weekly leagues in eight tiers (Quartz to the Crown), an all-time world leaderboard and a feed with hearts. No ads, no lives, no chat.
- **Dr. Scroll** is the mascot: a cheerful old genius with a violet bow tie, shown only through set "spots" (`docs/mascot.md`).

## 2. Where things stand (2026-10-12)

- **iPhone 1.0.0, build 8, is submitted to App Review** (2026-10-11), set to **release manually**. Nothing is waiting on code.
- **Live already:**
  - the Supabase backend, with every level imported and the push job running every 5 minutes;
  - brainscroll.app, with the home page, privacy policy, account deletion page and invite links;
  - instant updates to installed builds;
  - TestFlight.
- **Android:** not started. No Play Console app, no Firebase, no Google sign-in.

**When Apple answers**, in this order:

1. **If approved:**
   1. The owner removes the ten screenshot test learners. In the Supabase SQL editor, run `delete from auth.users where raw_app_meta_data ->> 'brainscroll_test' = 'true';`. Everything of theirs cascades away.
   2. The owner presses **Release This Version** in App Store Connect.
   3. On the owner's word ("turn on the App Store link"), set `STORE_URLS.APP_STORE_URL` in `scripts/site-build.ts` to `https://apps.apple.com/app/id6818598156` (written in the comment there). The website and invite pages then show the App Store badge instead of "coming soon".
   4. On the owner's word, mark the skills and subjects `published` in `content/`. Nothing in the app reads that flag; it keeps the records honest.
2. **If rejected:** read Apple's message with the owner and fix it.
   - Code-only fixes can go out as an instant update.
   - Native or `app.json` changes need a new build: raise `version` first.
   - Metadata fixes happen in App Store Connect.
   - Keep the review notes in `docs/store-listing.md` in step.

**Leave sandbox purchases on, for good.** App Review buys with sandbox accounts on every version, so turning them off would make a reviewer's purchase look broken. The two switches are `app_settings.allow_sandbox_purchases` and the `ALLOW_SANDBOX_PURCHASES` function secret. The why and the one cost are in [`docs/release.md`](docs/release.md#app-review-sign-in).

## 3. Services and identifiers

All public values. Secrets live only in each service's own dashboard or secret store, never in this repo. **Never ask the owner for a secret key or password, and never handle one.**

| Service | What's there | Where it's documented |
| --- | --- | --- |
| GitHub | `BryanKaneJr/Portfolio`; BrainScroll is the `brainscroll/` folder. Default branch `master`. CI: `.github/workflows/brainscroll.yml` (`check` and `e2e`). | this file |
| Expo / EAS | Project id `9884c386-0366-45d5-ae47-fd8048a0cfa5` (`app/app.json`). Builds on EAS, no Mac needed. Channel `production`. Build numbers increment remotely: a failed build still uses up its number, which is why 8 is the first build submitted for review. | [`docs/release.md`](docs/release.md) |
| App Store Connect | Apple ID `6818598156`, bundle `app.brainscroll`, team `X3837877NX`. iPhone only (`supportsTablet: false`). Name **BrainScroll: Daily Learning**, subtitle **History, Science & More**. Category Education (secondary Reference). Age rating 9+. Free. All countries the form allows (not China mainland). | [`docs/store-listing.md`](docs/store-listing.md), [`docs/store-privacy.md`](docs/store-privacy.md) |
| Subscriptions | Group "Unlimited": `unlimited_monthly` and `unlimited_annual`, both Level 1. | [`docs/subscriptions.md`](docs/subscriptions.md) |
| RevenueCat | Entitlement `unlimited_learning`, offering `default`. Webhook into Supabase, plus `sync-entitlement` right after a purchase. The iOS public SDK key is in `app/eas.json`. | [`docs/subscriptions.md`](docs/subscriptions.md) |
| Supabase | Project `mgwjarklvintucpxuodf` (labelled "staging" in its dashboard, but it is production), on Pro. 49 migrations in `backend/supabase/migrations`. Edge Functions: `revenuecat-webhook`, `send-push`, `sync-entitlement`. The URL and publishable key are in `app/eas.json`. | [`docs/supabase-setup.md`](docs/supabase-setup.md), [`docs/notifications.md`](docs/notifications.md) |
| Cloudflare Pages | `brainscroll` builds `site/` into brainscroll.app (and invite.brainscroll.app). `brainscroll-app` is the playable web preview of the app (`brainscroll-app.pages.dev`). Both build on every push and comment preview links on PRs. The privacy policy's operator details are host environment variables (`SITE_*`), never in the repo. | [`docs/invite-links.md`](docs/invite-links.md), [`docs/app-preview.md`](docs/app-preview.md) |
| Sentry | Wired in but off until a DSN is set. | [`docs/release.md`](docs/release.md) |
| Google Play | Not set up yet. Once Android ships, its link is `https://play.google.com/store/apps/details?id=app.brainscroll`. | [`docs/release.md`](docs/release.md) |

## 4. The repository

The `Portfolio` repo also holds the owner's other projects (Cook With That, ShiftTips, older games). Leave them alone unless asked. Everything here is under `brainscroll/`:

| Path | What |
| --- | --- |
| `app/` | Expo Router app (React Native, TypeScript). Screens in `app/src/app/`, UI primitives in `app/src/components/ui/`, theme in `app/src/theme/tokens.ts`. Progress goes only through `ProgressBackend`: `remoteBackend.ts` (Supabase) and `localBackend.ts` (the offline harness). |
| `packages/core/` | Shared rules and constants (XP, Brainpower, review, chests, leagues, quests), the zod content schema, and tests. Mirrors the SQL. |
| `backend/` | Supabase migrations, Edge Functions and SQL tests (`npm run test:db`). |
| `content/` | The curriculum, quests (`content/quests.json`) and sources. `npm run content:build` compiles it for the app. |
| `scripts/` | Validator, importer, site build, art packing, splash art, update publisher and their tests. |
| `admin/` | The local Content Admin (`npm run admin`). |
| `site/` | brainscroll.app: `site/src` is built to `site/dist`. `site/screens.mjs` makes its phone screens from the promo set. |
| `store/` | App Store art: `app-store-promo/` (the promo screenshots in three sizes, plus landscape art, rebuilt by its `.mjs` scripts) and `listing-brief.md`. |
| `e2e/` | Playwright runs of the web build: local harness and remote (real migrations through a fake Supabase). |
| `docs/` | Everything else. Product specs are in `docs/specs/` (`CURRENT_PRODUCT_DECISIONS.md` wins over older wording). The image briefs are `docs/images-*.md`. |

**Commands** (from `brainscroll/`; the full list is in `CLAUDE.md`):
- `npm run check` before every commit: typecheck, lint, the copy lint, unit tests and content validation.
- `npm run e2e` and `npm run e2e:remote` after screen or progress changes.
- `npm run site:build` for the website.
- `npm run app:update -- "what changed"` for an instant update (never a plain `eas update`).

## 5. How the owner works (follow this)

**Talking to the owner**
- **Less is more.** Short answers, plain words, a recommendation rather than a survey. They often read on a phone and send screenshots or short videos. Answer what was asked, then stop.
- **They decide; you build.** Product, copy and design calls are theirs; recommend, then do what they pick. Record every decision in the docs with the date and their words (`owner, 2026-10-11: "..."`). That's how the docs stay the source of truth.
- **Don't make images unless asked.** The owner makes the art. Briefs for it are in `docs/images-*.md`.
- **Their computer is Windows (PowerShell).**
  - Give commands with `npm.cmd` / `npx.cmd`.
  - Their up-to-date clone is `$HOME\BrainScroll-latest\brainscroll`. An older `BrainScrollApp` folder is stale: don't use it, and never build from it. EAS asking "Which account should own this project?" means the copy is stale.
  - Builds: from `brainscroll/app`, after `git pull`, run `npx.cmd eas-cli@latest build --profile production --platform ios --auto-submit`.

**Rules**
- **No em dashes, anywhere** (U+2014), in code, comments, docs or content. Rewrite the sentence. `npm run lint:copy` enforces it.
- **Privacy:**
  - Never put the owner's email, name, username or phone anywhere: commits, docs, User-Agents, requests, or briefs to other agents.
  - Web requests use `User-Agent: BrainScroll content review` and nothing else identifying.
  - Never disable TLS verification.

**Changes**
- **Commit and push every unit of work,** with a `CHANGELOG.md` entry (newest first, the owner's words quoted). Keep PRs small, one topic each.
- **Merge only when the owner says "merge"** (or plainly asks for it to go live). Then:
  1. Merge with `gh api -X PUT repos/BryanKaneJr/Portfolio/pulls/N/merge -f merge_method=merge -f sha=<full head sha>`.
  2. Restart the working branch from the new `master`.
  3. Apply any new migrations to the live Supabase project.
- **Publishing content is the owner's call.** Flip skills or subjects to `published` only when told.

## 6. Product rules, the short version

The full list is in `CLAUDE.md` and `docs/product-rules.md`. The ones people trip on:

**Progress**
- The server owns completion, XP, Brainpower and entitlements; the app only animates what the server returns.
- XP is an immutable ledger (`xp_events`). Skill level is the highest level cleared, never derived from XP.
- First attempts set the reward; corrections never add XP. A wrong answer shows its source cards, never runtime-generated text.

**Design and copy**
- Learning screens are quiet: no XP, gold or stats on lesson screens. Progression screens are loud.
- The streak never guilts: no warnings, countdowns or freezes.
- Unlimited never buys knowledge, XP, trophies or earned cosmetics.
- Never add ads, other currencies, lives, paywalled subjects, chat or comments.

**Keep in step**
- Each core rule (`packages/core`) and its SQL twin, plus their tests, change together.
- The local and remote backends change together.
- Constants live in both `packages/core/src/constants.ts` and the SQL.
- Every new table holding a learner's data cascades from `profiles` and is listed in `account-deletion.test.sql`.

## 7. History

The project started on 2026-09-23. Work merged to `master` through PRs from #2 on 2026-10-02. Before that it lived on a working branch. `CHANGELOG.md` has every step; these are the phases.

- **2026-09-23 to 09-26, the loop:**
  - the monorepo, the core rules and the content schema;
  - Astronomy Levels 1 to 10 and an offline lesson player;
  - the Supabase backend (`start_level` / `complete_level`, review);
  - the Content Admin and a source-verification system.
- **09-27 to 09-29, the catalog:**
  - the catalog grows to six subjects and 26 trees of 100 levels each, the ten newest with a full claim review;
  - the premium polish pass;
  - trophies (milestone, mastery and streak), chapter reviews and Weekly Quests v1;
  - crash reporting and the opt-in reminder;
  - sign-in made mandatory (Apple and Google only; no guest mode).
- **09-30 to 10-01, polish and social:**
  - the first fixes from running on an iPhone;
  - friends, weekly leagues and the feed, plus avatars;
  - moderation and the username filter, and invite links;
  - the perfect streak bonus, and a picture on every card.
- **10-02 (PRs #2 to #11), going live:**
  - the first merge to `master`;
  - brainscroll.app, the privacy policy and the account deletion page;
  - push notifications;
  - Brainpower replaces the old 5-a-day cap;
  - database hardening from Supabase's advisor.
- **10-03 to 10-04 (#12 to #25):**
  - sound;
  - match, order and fill-in-the-blank questions in every tree;
  - Dr. Scroll animations, and hearts in the feed;
  - QA rounds;
  - faster maps, lessons and Level Complete.
- **10-05 to 10-08 (#26 to #37), rewards and launch prep:**
  - map chests, XP boosts and cosmetics (glows, name styles, titles, the Locker);
  - the playable app preview on every branch;
  - league tiers from Quartz to the Crown;
  - deep links that load;
  - a year of Weekly Quests;
  - the live backend in the store builds.
- **10-09 to 10-10 (#38 to #47), TestFlight:**
  - the first TestFlight build and a full test pass (Level 1 of every tree);
  - TestFlight fixes and the world leaderboard;
  - new tabs: Practice, Leagues, Home, Social, Profile;
  - all 52 quests dated;
  - instant updates made to fit EAS's 1,000-file limit (level art packed four to a sheet);
  - a Buy Unlimited button on the Brainpower screen, and a pinned chapter header on the map.
- **10-11 to 10-12 (#48 to #55), submission:**
  - the store listing, promo screenshots in every size App Store Connect asked for, and landscape art;
  - the sharp build fix;
  - a new flat "brainscroll" launch wordmark;
  - the gray-screen fixes: no freezing hidden screens, and tabs that switch instantly;
  - the website refreshed with the current screens and official store badges;
  - the listing's name, subtitle and keywords recorded;
  - **1.0.0 (8) submitted to App Review.**

## 8. Hard-won lessons (read before debugging)

**Builds and updates**
- **Builds vs updates.** JavaScript and images go out with `npm run app:update` (checked against the 1,000-file limit; bundles with `app/eas.json`'s values). Anything native (a package, a config plugin, `app/app.json`, `app/app.config.ts`) needs a new build with a higher `version`. Phones fetch an update when the app opens and run it on the next open, so close and reopen twice to see it at once.
- **EAS "Install dependencies" failures** come from native packages that compile on install. Script-only tools (like `sharp`) are `optionalDependencies` of `scripts/` so the build can skip them.

**App code**
- **Gray screens:**
  - React Navigation's tab `animation: 'shift'` left a newly opened tab transparent on the new architecture, so tabs use `animation: 'none'`.
  - `freezeOnBlur` is gone everywhere. `Screen` (in `app/src/components/ui/shell.tsx`) instead keeps its last frame while out of view, with `memo` and `useIsFocused`.
  - Don't bring either back without testing on a device.
- **Hosted Supabase rejects UPDATE or DELETE without a WHERE** inside functions (pg-safeupdate). Local Postgres doesn't; `scripts/test/sql-safe-update.test.ts` guards it.

**Local tools**
- **e2e:** run the suites one at a time (both serve on port 8790). Stop a stray server by its process id, never with `pkill -f` on a pattern that also matches your own shell. A couple of checks only run when a chest rolls a boost, so the check count can differ between runs.
- **Windows:** `cd` with the folder names' exact capitalisation, or Metro can't resolve `@brainscroll/core`.

**Store and site**
- **App Store Connect:**
  - Screenshots: the 6.9" slot takes 1320 × 2868, the 6.1"/6.3" slot 1206 × 2622, and the wide slot 2007 × 2853. Rebuild them with `node store/app-store-promo/build.mjs`.
  - No iPad shots: the app is iPhone only.
  - The keywords stay editable while a version is "Waiting for Review". Most other fields lock until the next version, but promotional text can change any time.
- **Site store badges** appear only once that store's link is set (`scripts/site-build.ts`, `STORE_URLS`), so the site never links to a listing that doesn't exist.

**Working with the owner**
- **Images the owner sends mid-task** may not be saved where an AI can open them. If you can't open one, ask them to send it again rather than guessing.

## 9. What's next

1. **Release day:** the checklist in section 2.
2. **Right after launch:**
   - Watch App Store Connect's search and conversion data, then tune the keywords with the next version.
   - Keep the promotional text fresh; it changes without review.
3. **1.1:** home screen widgets (This week's seven dots with Dr. Scroll, Up next, Dr. Scroll's daily fact), planned in `docs/build-order.md` ("After launch"). They're native, so they need a build and App Review.
4. **Android:** Play Console, Firebase for push, Google sign-in (not set up; the iPhone app is Apple-only), the Android RevenueCat key in `app/eas.json`, and the SHA-256 fingerprint for invite links (`docs/invite-links.md`). Then set `PLAY_STORE_URL` in `scripts/site-build.ts`, and adjust the listing (`docs/store-listing.md`, Google Play section).
5. **Ongoing:** content corrections go in as new revisions (published revisions are immutable). Learner reports are worked in the admin's queue (`docs/moderation.md`).

## 10. If something breaks

- **The app misbehaves for everyone:**
  - fix it and send an instant update;
  - or roll every phone back to its build's own code: from `brainscroll/app`, run `npx eas-cli@latest update:roll-back-to-embedded --channel production --message "Roll back"`.
- **A purchase doesn't unlock:** check the `sync-entitlement` function's logs and the `entitlements` row in Supabase. Sandbox purchases need both switches on (section 2).
- **Pushes stop:** check the `send-push` function and the cron job in Supabase (`docs/notifications.md`).
- **The website is wrong:** it builds from `site/src` on every push to `master` (Cloudflare Pages project `brainscroll`). `npm run site:build` reproduces it locally.
- **Unsure what a rule is:** `CLAUDE.md` first, then `docs/product-rules.md`, then `docs/specs/CURRENT_PRODUCT_DECISIONS.md`.

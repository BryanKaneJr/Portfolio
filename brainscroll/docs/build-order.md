# Build order

From the Build Order Blueprint ([`specs/BUILD_ORDER.md`](specs/BUILD_ORDER.md); .docx snapshot in [`source/`](source/Build_Order_Blueprint.docx)).

> **Build the loop first. Scale the knowledge second.** Build 10 excellent real levels, prove the whole experience end to end, then scale the content system around a schema that has survived real use.

A stage starts only when the previous one has produced a **stable contract**, not just because code can begin.

## First milestone

A new user can open the app, choose one skill, complete Levels 1–10, earn XP, watch their skill level rise, meet review questions, hit the daily new-level limit, and come back later with their progress intact.

## Stages

| # | Stage | Exit condition | Status |
| --- | --- | --- | --- |
| 0 | Freeze rules | Rules file is authoritative; ID format frozen; new level/review/completion/mastery/prestige are unambiguous | ✅ [`product-rules.md`](product-rules.md) |
| 1 | Data contracts | A level's JSON validates without the app; migrations rebuild from scratch; revision + source/licence fields exist; completion is an idempotent server contract | ✅ core schema + validator, migration, `complete_level`, SQL tests |
| 2 | Golden 10 levels | One real skill (Astronomy), Levels 1–10 hand-polished and source-verified | 🟡 Levels 1–9 regular (learn → 3 questions), Level 10 a 5-question checkpoint; sources need editor verification; no image asset yet |
| 3 | Lesson player | All 10 levels render from data with no level-specific UI; resume works; double tap can't duplicate XP; wrong answers teach | ✅ offline (bundled content, local progress); server fetch pending |
| 4 | Progress & character sheet | Two users see distinct sheets; reinstall restores progress; revisions never move progress back | 🟡 server-authoritative via anonymous accounts; account linking for reinstall/second device pending |
| 5 | Review & mastery | Concept-level review queue; alternative questions per concept; review never uses allowance | ✅ `get_review_queue`/`submit_review` + local review sessions, tested |
| 6 | Daily cap | 5/day enforced server-side; Daily Complete screen; review stays open | 🟡 enforced server-side and locally; Daily Complete live; paywall not wired |
| 7 | Content tooling | Editor/importer/validator so Levels 11–100 can scale safely | 🟡 validator + importer (`import_content`, immutable revisions); admin UI pending |
| 8 | Subscriptions | RevenueCat `unlimited_learning`, restore, expiry | ⬜ |
| 9 | Analytics & reporting | Mission-aligned events, content reports, funnel | ⬜ |
| 10 | Scale launch content | Flagship to 100, then a second skill of a different shape, then 6–10 trees | ⬜ |
| 11 | Beta & release | TestFlight/Play testing, QA matrix, store submission | ⬜ |

## Critical-path backlog

| # | Task | Done means | Status |
| --- | --- | --- | --- |
| 1 | Repo + environments | App boots in development; staging backend exists | 🟡 app + Supabase mode ready; staging project not yet created |
| 2 | Migrations + ID rules | Fresh DB can be recreated reliably | ✅ `npm run test:db` |
| 3 | Content JSON validator | Malformed levels fail before import | ✅ `npm run validate:content` |
| 4 | 10 golden levels | Real content available as canonical seed data | 🟡 10/10 drafted; awaiting source verification |
| 5 | Read-only content API | App can fetch skills/levels/cards/questions | ✅ app renders the server's current revision; e2e-tested |
| 6 | Mobile navigation shell | Onboarding → skill → lesson → completion path exists | ✅ |
| 7 | Generic card renderer | Golden levels render from data only | ✅ `app/src/components/cards` |
| 8 | Question engine | Answers + explanations + state/resume work | ✅ |
| 9 | Completion transaction | Exactly-once progress/XP update | ✅ server side |
| 10 | Character sheet | Skill and overall progress visible | ✅ from `get_progress()` (Supabase) or on-device |
| 11 | Review queue | Prior concepts reappear and update mastery | ✅ |
| 12 | 5/day allowance | Free path ends deliberately; review remains open | ✅ server + local; review flow pending |
| 13 | Content admin v1 | Edit/validate/preview/publish without raw DB editing | ⬜ |
| 14 | Publishing/revisions | Corrections are versioned; progress survives | ✅ tested: conflict, bump, regression |
| 15 | RevenueCat | Unlimited + restore + expiry | ⬜ |
| 16 | Analytics + reports | Detect funnel/content/technical failures | ⬜ `content_reports` table exists |
| 17 | Finish flagship 1–100 | Whole depth curve proven | ⬜ |
| 18 | Scale launch trees | Content pipeline used repeatedly | ⬜ |
| 19 | Closed beta | Unknown users complete core loop without coaching | ⬜ |
| 20 | Store release | Monitoring + correction workflow ready | ⬜ |

## After MVP: rewards, Weekly Knowledge Quests, then social

Trophies, titles, earned cosmetics, **Weekly Knowledge Quests**, friends, weekly friend leaderboards and challenges, with no currency and no feed. It is sequenced strictly after the core loop, and none of it may block the MVP. See [`social-expansion.md`](social-expansion.md) for the design, the phases and the open decisions.

Dependency order, with where we are today:

| # | Step | Status |
| --- | --- | --- |
| **Core** | | |
| 1 | Auth / user accounts | 🟡 anonymous accounts work; account linking and usernames are missing |
| 2 | Canonical curriculum | 🟡 Astronomy 1–10 drafted; sources unverified |
| 3 | Regular 3-question learning levels | ✅ |
| 4 | Level completion | ✅ exactly-once, server-authoritative |
| 5 | Skill progression | ✅ |
| 6 | XP | ✅ ledger (`xp_events`) |
| 7 | Level 1–100 progression | ✅ rules, bands and stars; content only to Level 10 |
| 8 | Daily 5-new-level free cap | ✅ |
| 9 | Unlimited subscription | ⬜ |
| 10 | Review / recall | ✅ |
| **Rewards foundation** | | |
| 11 | Canonical reward/event ledger | 🟡 `xp_events` exists; more event types needed |
| 12 | Trophy / accomplishment system | ⬜ |
| 13 | Titles | ⬜ |
| 14 | Profile display | ⬜ (basic character sheet only) |
| 15 | Earned cosmetics | ⬜ |
| **Weekly Quests** | | |
| 16 | Quest definition / data model | ⬜ |
| 17 | Requirement tracking from verified level-completion events | ⬜ |
| 18 | Active Weekly Quest screen | ⬜ |
| 19 | Quest progress on the 5/5 Daily Knowledge Complete screen | ⬜ |
| 20 | Final Encounter (3 synthesis questions) | ⬜ |
| 21 | Quest trophy / title / cosmetic rewards | ⬜ |
| 22 | Chronicle / archived quests | ⬜ |
| 23 | Quest analytics | ⬜ |
| **Social integration** | | |
| 24 | Friend progress display | ⬜ needs the friend graph |
| 25 | Weekly Quest comparison among friends | ⬜ |
| 26 | Quest activity in friend profiles | ⬜ |

## Up next

1. **Create the staging Supabase project** ([`supabase-setup.md`](supabase-setup.md)). This needs you. After that, a smoke test on a real phone.
2. **Account linking:** let anonymous players attach email or Apple/Google sign-in, so a reinstall or a second device restores progress.
3. **Verify the Golden 10:** an editor checks the facts against their sources, flips `verified: true`, and adds one licensed image asset.
4. **Subscriptions (Stage 8):** RevenueCat `unlimited_learning`, offered only at Daily Complete.
5. **Content admin v1:** a web editor, preview and publish flow on top of `validateContent` and `import_content`.

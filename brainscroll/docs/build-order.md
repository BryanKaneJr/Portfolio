# Build order

From the Build Order Blueprint ([`source/Build_Order_Blueprint.docx`](source/Build_Order_Blueprint.docx)).

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

## After MVP: Social + Rewards expansion

Friends, weekly friend leaderboards, challenges, trophies, titles and earned cosmetics, with no currency and no feed. It is sequenced strictly after the core loop. See [`social-expansion.md`](social-expansion.md) for the phases, how they map onto what exists, and the open decisions.

## Up next

1. **Create the staging Supabase project** ([`supabase-setup.md`](supabase-setup.md)). This needs you. After that, a smoke test on a real phone.
2. **Account linking:** let anonymous players attach email or Apple/Google sign-in, so a reinstall or a second device restores progress.
3. **Verify the Golden 10:** an editor checks the facts against their sources, flips `verified: true`, and adds one licensed image asset.
4. **Subscriptions (Stage 8):** RevenueCat `unlimited_learning`, offered only at Daily Complete.
5. **Content admin v1:** a web editor, preview and publish flow on top of `validateContent` and `import_content`.

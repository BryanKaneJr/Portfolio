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
| 2 | Golden 10 levels | One real skill (Astronomy), Levels 1–10 hand-polished and source-verified | 🟡 Levels 1–10 drafted and validating; sources need editor verification; no image asset yet |
| 3 | Lesson player | All 10 levels render from data with no level-specific UI; resume works; double tap can't duplicate XP; wrong answers teach | ✅ offline (bundled content, local progress); server fetch pending |
| 4 | Progress & character sheet | Two users see distinct sheets; reinstall restores progress; revisions never move progress back | 🟡 server side done; local character sheet live; needs accounts/sync |
| 5 | Review & mastery | Concept-level review queue; alternative questions per concept; review never uses allowance | ⬜ queue populated on completion; review flow pending |
| 6 | Daily cap | 5/day enforced server-side; Daily Complete screen; review stays open | 🟡 enforced server-side and locally; Daily Complete live; paywall not wired |
| 7 | Content tooling | Editor/importer/validator so Levels 11–100 can scale safely | ⬜ |
| 8 | Subscriptions | RevenueCat `unlimited_learning`, restore, expiry | ⬜ |
| 9 | Analytics & reporting | Mission-aligned events, content reports, funnel | ⬜ |
| 10 | Scale launch content | Flagship to 100, then a second skill of a different shape, then 6–10 trees | ⬜ |
| 11 | Beta & release | TestFlight/Play testing, QA matrix, store submission | ⬜ |

## Critical-path backlog

| # | Task | Done means | Status |
| --- | --- | --- | --- |
| 1 | Repo + environments | App boots in development; staging backend exists | 🟡 repo + app boot; Supabase project not yet created |
| 2 | Migrations + ID rules | Fresh DB can be recreated reliably | ✅ `npm run test:db` |
| 3 | Content JSON validator | Malformed levels fail before import | ✅ `npm run validate:content` |
| 4 | 10 golden levels | Real content available as canonical seed data | 🟡 10/10 drafted; awaiting source verification |
| 5 | Read-only content API | App can fetch skills/levels/cards/questions | ⬜ RLS read policies + `start_level` exist; importer + client pending |
| 6 | Mobile navigation shell | Onboarding → skill → lesson → completion path exists | 🟡 skill → lesson → completion → daily complete; onboarding pending |
| 7 | Generic card renderer | Golden levels render from data only | ✅ `app/src/components/cards` |
| 8 | Question engine | Answers + explanations + state/resume work | ✅ |
| 9 | Completion transaction | Exactly-once progress/XP update | ✅ server side |
| 10 | Character sheet | Skill and overall progress visible | 🟡 local progress; needs server sync |
| 11 | Review queue | Prior concepts reappear and update mastery | ⬜ |
| 12 | 5/day allowance | Free path ends deliberately; review remains open | ✅ server + local; review flow pending |
| 13 | Content admin v1 | Edit/validate/preview/publish without raw DB editing | ⬜ |
| 14 | Publishing/revisions | Corrections are versioned; progress survives | 🟡 schema ✅ |
| 15 | RevenueCat | Unlimited + restore + expiry | ⬜ |
| 16 | Analytics + reports | Detect funnel/content/technical failures | ⬜ `content_reports` table exists |
| 17 | Finish flagship 1–100 | Whole depth curve proven | ⬜ |
| 18 | Scale launch trees | Content pipeline used repeatedly | ⬜ |
| 19 | Closed beta | Unknown users complete core loop without coaching | ⬜ |
| 20 | Store release | Monitoring + correction workflow ready | ⬜ |

## Up next

1. **Verify the Golden 10.** An editor checks every fact against its source, flips `verified: true`, and adds at least one licensed image asset (NASA/CC0) so the image card is exercised. Then mark the levels `published`.
2. **Content importer** (`scripts/`): validated JSON → Supabase (`levels`, `level_revisions.bundle`, `questions`, `answer_options`, `concepts`, `sources`), run with the service role.
3. **Supabase project and auth:** create staging, add `@supabase/supabase-js`, and swap `ProgressProvider.completeLevel` for the `complete_level` RPC. The server result replaces local state. Keep local play as the offline fallback.
4. **Stage 5 review flow:** turn the Review tab's due concepts into recall sessions that serve an approved question per concept, update strength, and award `DELAYED_RECALL`, all without touching the daily allowance.
5. **Onboarding:** pick interests, explain levels and the 5/day rule, and start Level 1 within about 60 seconds.

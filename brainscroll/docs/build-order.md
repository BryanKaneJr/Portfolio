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
| 2 | Golden 10 levels | One real skill (Astronomy), Levels 1–10 hand-polished and source-verified | ✅ Astronomy and Ancient Rome 1–10 drafted, validated and fact-checked against independent sources; level art in place. The human `verified` flag is still for an editor to set |
| 3 | Lesson player | All 10 levels render from data with no level-specific UI; resume works; double tap can't duplicate XP; wrong answers teach | ✅ offline and server-backed; redesigned lesson shell (select → CHECK, Take another look) |
| 4 | Progress & character sheet | Two users see distinct sheets; reinstall restores progress; revisions never move progress back | ✅ server-authoritative; progress belongs to the signed-in account, so signing in after a reinstall or on a second device restores it (e2e-tested) |
| 5 | Review & mastery | Concept-level review queue; alternative questions per concept; review never uses allowance | ✅ `get_review_queue`/`submit_review` + local review sessions, tested |
| 6 | Daily cap | 5/day enforced server-side; Daily Complete screen; review stays open | ✅ enforced server-side and locally; Daily Complete offers Unlimited quietly |
| 7 | Content tooling | Editor/importer/validator so Levels 11–100 can scale safely | ✅ validator (quality, claims, editorial rules) + importer + Content Admin v1 |
| 8 | Subscriptions | RevenueCat `unlimited_learning`, restore, expiry | 🟡 built and tested against a sandbox and the webhook path; needs store products, RevenueCat keys and a privacy policy ([subscriptions.md](subscriptions.md)) |
| 9 | Analytics & reporting | Mission-aligned events, content reports, funnel | ✅ built and tested locally; configured once Supabase is connected (`docs/analytics.md`) |
| 10 | Scale launch content | Flagship to 100, then a second skill of a different shape, then 6–10 trees | ✅ 26 trees, each published to Level 100 (2,600 levels) across six subjects; 16 approved on a sample review and 10 on a full claim review (`content/approvals.json`); see `content/skills/` |
| 11 | Beta & release | TestFlight/Play testing, QA matrix, store submission | 🟡 EAS profiles, icons, listing and privacy drafts, QA checklist ([release.md](release.md)); needs store accounts |

## Critical-path backlog

| # | Task | Done means | Status |
| --- | --- | --- | --- |
| 1 | Repo + environments | App boots in development; staging backend exists | 🟡 app + Supabase mode ready; staging project not yet created |
| 2 | Migrations + ID rules | Fresh DB can be recreated reliably | ✅ `npm run test:db` |
| 3 | Content JSON validator | Malformed levels fail before import | ✅ `npm run validate:content` |
| 4 | 10 golden levels | Real content available as canonical seed data | ✅ fact-checked; the human `verified` flag waits on an editor |
| 5 | Read-only content API | App can fetch skills/levels/cards/questions | ✅ app renders the server's current revision; e2e-tested |
| 6 | Mobile navigation shell | Onboarding → skill → lesson → completion path exists | ✅ |
| 7 | Generic card renderer | Golden levels render from data only | ✅ `app/src/components/cards` |
| 8 | Question engine | Answers + explanations + state/resume work | ✅ |
| 9 | Completion transaction | Exactly-once progress/XP update | ✅ server side |
| 10 | Character sheet | Skill and overall progress visible | ✅ from `get_progress()` (Supabase) or on-device |
| 11 | Review queue | Prior concepts reappear and update mastery | ✅ |
| 12 | 5/day allowance | Free path ends deliberately; review remains open | ✅ server + local, including review sessions |
| 13 | Content admin v1 | Edit/validate/preview/publish without raw DB editing | ✅ `npm run admin` (file-based; publishing still goes through the importer) |
| 14 | Publishing/revisions | Corrections are versioned; progress survives | ✅ tested: conflict, bump, regression |
| 15 | RevenueCat | Unlimited + restore + expiry | ⬜ held (needs store setup) |
| 16 | Analytics + reports | Detect funnel/content/technical failures | ✅ locally; configured with Supabase |
| 17 | Finish flagship 1–100 | Whole depth curve proven | 🟡 Astronomy 1–100 published and fact-checked; pacing not yet tested on a phone |
| 18 | Scale launch trees | Content pipeline used repeatedly | ✅ 26 trees through the same pipeline, no schema changes |
| 19 | Closed beta | Unknown users complete core loop without coaching | ⬜ |
| 20 | Store release | Monitoring + correction workflow ready | ⬜ |

## After MVP: rewards, Weekly Knowledge Quests, then social

Trophies, titles, earned cosmetics, **Weekly Knowledge Quests**, friends, weekly friend leaderboards and challenges, with no currency and no feed. It is sequenced strictly after the core loop, and none of it may block the MVP. See [`social-expansion.md`](social-expansion.md) for the design, the phases and the open decisions.

Dependency order, with where we are today:

| # | Step | Status |
| --- | --- | --- |
| **Core** | | |
| 1 | Auth / user accounts | 🟡 accounts are required before any progress (Apple, Google, phone, email; no guest mode), account deletion works; Apple/Google/SMS credentials and usernames (post-MVP) are missing |
| 2 | Canonical curriculum | ✅ 26 trees published to Level 100 and fact-checked |
| 3 | Regular 3-question learning levels | ✅ |
| 4 | Level completion | ✅ exactly-once, server-authoritative |
| 5 | Skill progression | ✅ |
| 6 | XP | ✅ ledger (`xp_events`) |
| 7 | Level 1–100 progression | ✅ rules, bands and stars; every tree through Level 100 |
| 8 | Daily 5-new-level free cap | ✅ |
| 9 | Unlimited subscription | 🟡 code done; store setup pending |
| 10 | Review / recall | ✅ |
| **Rewards foundation** | | |
| 11 | Canonical reward/event ledger | ✅ `xp_events` with `LEVEL_COMPLETE`, `DELAYED_RECALL`, `QUEST_COMPLETE` and `CHAPTER_REVIEW` |
| 12 | Trophy / accomplishment system | ✅ quest trophies (stored) plus milestone, mastery and subject trophies (derived); art briefed in [`images-trophies.md`](images-trophies.md) |
| 13 | Titles | ✅ from live-week quest clears |
| 14 | Profile display | ✅ title, emblem, newest trophies and the Trophies screen |
| 15 | Earned cosmetics | ✅ quest emblems (more cosmetics are post-launch) |
| **Weekly Quests** | | |
| 16 | Quest definition / data model | ✅ (2026-09-29) |
| 17 | Requirement tracking from verified level-completion events | ✅ derived from the ledger (plus chapter reviews once a skill has nothing new left) |
| 18 | Active Weekly Quest screen | ✅ (2026-09-29) |
| 19 | Quest progress on the 5/5 Daily Knowledge Complete screen | ✅ (2026-09-29) |
| 20 | Final Round (a card, then a question, per quest skill) | ✅ (2026-09-29) |
| 21 | Quest trophy / title / cosmetic rewards | ✅ trophy, title and emblem (live-week clears) + XP bonus |
| 22 | Archive / archived quests | ✅ (2026-09-29) |
| 23 | Quest analytics | ✅ |
| **Social integration** | | |
| 24 | Friend progress display | ⬜ needs the friend graph |
| 25 | Weekly Quest comparison among friends | ⬜ |
| 26 | Quest activity in friend profiles | ⬜ |

## Also built beyond the blueprint

Learning streak (derived, never used for fear), Choose for me, an opt-in daily reminder, crash reporting (off until a Sentry DSN is set), the admin's content reports queue, and chapter reviews (any cleared chapter, up to 30 XP; see [`product-rules.md`](product-rules.md#chapter-reviews)).

## Up next

The app side is complete for launch; what's left needs accounts, keys or a phone.

1. **Create the staging Supabase project** ([`supabase-setup.md`](supabase-setup.md)), run the migrations and `npm run content:import`, then smoke-test on a real phone.
2. **Sign-in credentials:** the Apple Services ID and key and the Google OAuth clients, then test the native sheets on a device build ([`accounts.md`](accounts.md)). Add `brainscroll://auth-callback` to the Supabase redirect URLs.
3. **Store setup for Unlimited:** products, RevenueCat keys and the published privacy policy ([`subscriptions.md`](subscriptions.md), [`privacy-policy.md`](privacy-policy.md)).
4. **The device QA pass** in [`release.md`](release.md), including VoiceOver and TalkBack.
5. **Owner content:** quest dates once there's a launch week (`content/quests.json`), the 20 trophy images ([`images-trophies.md`](images-trophies.md)), sound files, and an editor setting `verified` where they've checked the sources.

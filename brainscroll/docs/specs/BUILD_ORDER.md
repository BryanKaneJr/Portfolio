---
title: "BrainScroll Build Order Blueprint"
status: canonical
source_docx: "Knowledge_RPG_Build_Order_Blueprint(1).docx"
merged_decisions: "CURRENT_PRODUCT_DECISIONS.md (2026-09-23)"
---

| ENGINEERING & DELIVERY PLAN |
|-----------------------------|

**KNOWLEDGE RPG**

Build Order Blueprint — from empty repository to production beta

**BUILD THE LOOP FIRST. SCALE THE KNOWLEDGE SECOND.**

> Primary rule
> Do not build the full curriculum before the product loop works. Build 10 excellent real levels, prove the entire experience end-to-end, then scale the content system around a schema that has survived actual use.

This document is intentionally implementation-first. It defines dependencies, build sequence, data contracts, test gates, and what “done” means at each stage. Visual identity, color system, typography, component styling, motion, and screen mockups belong in the separate Visual Direction document that follows this one.

| 01 \| THE BUILD STRATEGY |
|--------------------------|

# The shortest safe path to a real app

The product has two engines that must meet cleanly: the learning application and the curriculum factory. If either is built in isolation, the project risks expensive rework. The fastest route is a vertical slice that uses real content from day one.

> The first milestone is not “an app.”
> The first milestone is: a new user can open the app, choose one skill, complete Levels 1–10, earn XP, see their skill level rise, encounter review questions, hit the daily new-level limit, and return later with progress intact.

## Build order at a glance

| **Stage** | **Build**                 | **Exit condition**                                                       |
|-----------|---------------------------|--------------------------------------------------------------------------|
| 0         | Freeze rules              | Product constants, IDs, progression rules, definition of a level         |
| 1         | Create data contracts     | Database schema, content JSON schema, revisions, source/licensing fields |
| 2         | Author 10 golden levels   | One real skill, manually polished; these become the reference standard   |
| 3         | Build lesson player       | Card renderer, questions, answer feedback, completion state              |
| 4         | Build progress engine     | XP ledger, skill levels, character sheet, resume state                   |
| 5         | Build review/mastery      | Recall queue, mastery checks, no-loss progression rules                  |
| 6         | Build daily limit         | 5 new levels/day, completion screen, review remains open                 |
| 7         | Build content tooling     | Internal editor/importer/validator so Levels 11–100 can scale safely     |
| 8         | Add subscription          | RevenueCat entitlement, unlimited new levels, restore purchases          |
| 9         | Add analytics & reporting | Mission-aligned events, content error reports, funnel visibility         |
| 10        | Scale launch content      | Complete launch trees using the proven content pipeline                  |
| 11        | Beta & release            | TestFlight/Play testing, QA, store submission, operations                |
| Post-MVP  | Rewards foundation → Weekly Knowledge Quests → friends | Only after the MVP ships; see the Social + Rewards Expansion Spec. Never blocks launch. |

> Critical-path principle
> A later stage should not begin merely because code can begin. It begins when the previous stage has produced a stable contract. The biggest rework risks are the content schema, completion/progress rules, and publication/versioning model.

| 02 \| RECOMMENDED TECHNICAL FOUNDATION |
|----------------------------------------|

# Use a boring stack on purpose

The app’s differentiation is curriculum, progression, tone, and visual identity—not infrastructure. The foundation should be mainstream, mobile-first, AI-coding-friendly, and easy to operate with a very small team.

| **Layer**     | **Choice**                                    | **Why**                                                                                |
|---------------|-----------------------------------------------|----------------------------------------------------------------------------------------|
| Mobile app    | Expo + React Native + TypeScript              | One codebase for iOS/Android; fast iteration; EAS build/submission path.               |
| Database      | Supabase Postgres                             | Relational model fits subjects → skills → levels → concepts → progress extremely well. |
| Auth          | Supabase Auth                                 | Accounts, Apple/Google/email options, Row Level Security around user progress.         |
| Assets        | Supabase Storage or CDN-backed object storage | Images, diagrams, source-licensed media, content bundles.                              |
| Server logic  | Supabase Edge Functions / Postgres functions  | Secure completion transactions, entitlements, daily allowance, admin operations.       |
| Subscriptions | RevenueCat                                    | Single entitlement layer over App Store / Play billing; restore and status handling.   |
| Build/release | Expo EAS                                      | Development builds, internal distribution, App Store / Play binaries.                  |
| Admin/content | Small internal web tool                       | Not customer-facing. Author, validate, preview, publish, revise.                       |

> Avoid premature platform work
> Do not build a separate web learning client, custom billing backend, microservices, recommendation service, or live AI tutor for MVP. None are required to prove the product.

## Repository structure

- app/ — Expo/React Native customer application.

- backend/ — migrations, SQL functions, RLS policies, seed scripts, server functions.

- content/ — versioned source files for subjects, skills, levels, concepts, cards, questions, source metadata.

- admin/ — internal content authoring/review/publishing tool.

- scripts/ — importers, validators, duplicate checks, license checks, content build/export utilities.

- docs/ — product rules, schemas, editorial standards, release checklists.

| 03 \| STAGE 0 — FREEZE PRODUCT CONSTANTS |
|------------------------------------------|

# Decide the rules before writing code

These are not visual decisions. They are contracts that every screen, database row, test, and content tool will depend on. Changing them late is expensive.

## Freeze these first

- One released skill is a deterministic ordered sequence of levels.

- Base mastery band is Levels 1–100. Level 100 is a meaningful mastery checkpoint.

- Prestige continues upward (101–200, 201–300...) and adds a star/badge without deleting earlier progress.

- A level is a small learning encounter: mostly short reading/visual cards, then 3 light questions (recall, understanding, connection)—not a single trivia fact and not a test. Question count is fixed by level type: regular 3; every 10th-level checkpoint 5; the Level 50 milestone 7; the Level 100 Mastery Challenge 10; review sessions vary with what is due.

- Free accounts may complete 5 NEW levels per local calendar day. Review does not consume the allowance.

- Progress is earned from completion/recall; passive scrolling never awards skill level progression.

- Published knowledge is pre-generated, source-backed, versioned, and served from our own data.

- User progress references stable level IDs and survives later editorial revisions.

- No ads, hearts, energy, gems, purchasable XP, or paywalled subjects.

- Paid entitlement removes the daily new-level cap; it does not create exclusive curriculum.

## Naming and stable IDs

> Never use display names as keys.
> Use stable machine IDs from the beginning, e.g. subject.history, skill.history.rome, level.history.rome.001, concept.rome.republic, question.rome.001.q2. Display names can change later without breaking progress.

| **Object** | **Example stable ID**          | **Display meaning**  |
|------------|--------------------------------|----------------------|
| Subject    | subject.science                | Science              |
| Skill      | skill.science.astronomy        | Astronomy            |
| Level      | level.science.astronomy.001    | Astronomy 1          |
| Concept    | concept.astronomy.gravity      | Gravity              |
| Revision   | level.science.astronomy.001@r3 | Published revision 3 |

## Stage 0 exit gate

- A one-page rules file exists and the team agrees it is authoritative.

- Stable ID format is frozen.

- The definition of “new level,” “review,” “completion,” “mastery,” and “prestige” is unambiguous.

| 04 \| STAGE 1 — DATA & CONTENT CONTRACTS |
|------------------------------------------|

# Build the schema before the screens

The learning app should render content; it should not contain hard-coded lesson logic. A level must be representable as data, so the same level can be previewed in the admin tool, rendered on iOS/Android, revised, validated, and tested consistently.

## Core curriculum tables

| **Table**      | **Purpose**                          | **Minimum fields**                                        |
|----------------|--------------------------------------|-----------------------------------------------------------|
| subjects       | Top-level user-facing domains        | id, name, order, status                                   |
| skills         | Levelable subcategories              | id, subject_id, name, order, max_published_level          |
| levels         | Canonical progression nodes          | id, skill_id, number, title, summary, revision_id, status |
| concepts       | Atomic knowledge objects             | id, title, description, difficulty, canonical facts       |
| level_concepts | Which concepts a level teaches/tests | level_id, concept_id, role, weight                        |
| cards          | Ordered lesson units                 | id, level_id, type, payload, order                        |
| questions      | Assessments                          | id, level_id, concept_ids, source_card_ids, purpose, prompt, explanation, difficulty |
| answer_options | Question choices                     | question_id, label, correct, rationale                    |
| sources        | Source registry                      | id, title, URL, publisher, license, accessed_at           |
| source_links   | Fact/content provenance              | source_id, object_type, object_id, note                   |
| assets         | Media registry                       | id, type, file, alt_text, rights, attribution             |

## Core user/progression tables

| **Table**            | **Purpose**                                                   |
|----------------------|---------------------------------------------------------------|
| profiles             | User-visible identity / settings                              |
| user_skill_progress  | Highest cleared level, total XP, prestige/mastery state       |
| user_level_progress  | Started/completed/score/completion revision                   |
| user_question_attempts | First attempt (immutable), attempt count, resolved flag per question |
| user_concept_mastery | Seen count, correct/incorrect, strength, last reviewed        |
| review_queue         | Concept/question due date and priority                        |
| xp_events            | Immutable XP ledger; every award has a reason/idempotency key |
| daily_allowances     | New levels used for a date and entitlement state              |
| entitlements         | Cached current premium state / provider identifiers           |
| content_reports      | User-reported factual, wording, or media issues               |

> Make completion transactional
> A level completion should be one secure operation that validates eligibility, marks the level complete, writes XP, updates skill progress, updates concept mastery/review queue, and increments the daily new-level allowance exactly once. Do not let five separate client calls produce partial progress.

## Stage 1 exit gate

- A JSON representation of one level can be validated without the mobile app.

- Database migrations can recreate the schema from scratch.

- Publication revision and source/licensing fields are present before content ingestion.

- Level completion has an idempotent server-side contract.

| 05 \| STAGE 2 — THE GOLDEN 10 LEVELS |
|--------------------------------------|

# Create real content before building the lesson UI

Pick one flagship skill—Astronomy or Ancient Rome are strong choices—and hand-polish Levels 1–10. These are the product’s calibration set. Do not use placeholder text because placeholder content hides the real problems: pacing, card length, image needs, quiz ambiguity, and how much learning fits on a phone screen.

## What the golden levels must exercise

- At least 4 card types: hook/explanation, visual or diagram, connection/context, question.

- Multiple-choice and at least one non-multiple-choice interaction if planned for MVP.

- Short and longer explanations so the renderer must handle realistic text lengths.

- At least one source-backed image/media asset.

- At least one question that recalls a concept taught several levels earlier.

- An end-of-level completion payload with XP and concept mastery updates.

- Enough variety that Levels 1–10 do not feel like ten copies of the same template. Levels 1–9 are regular levels (3 questions each); Level 10 is the first checkpoint (5 questions).

## Golden-level editorial standard

| **Dimension** | **Pass standard**                                                         |
|---------------|---------------------------------------------------------------------------|
| Accuracy      | Every factual claim source-backed; no unsupported AI filler.              |
| Scope         | One level has a clear learning objective; no encyclopedia dump.           |
| Readability   | Mobile-length cards; split ideas instead of shrinking type.               |
| Questions     | Three per regular level (recall, understanding, connection); one defensible answer; plausible distractors; explanation after response. |
| Connection    | Show how new knowledge relates to earlier knowledge.                      |
| Tone          | Smart and conversational, not childish, academic, or preachy.             |
| Completion    | A user can explain at least one new thing after finishing the level.      |

> Do not generate Levels 11–100 yet.
> If the first 10 levels reveal that a level needs different card metadata, question structure, review tags, or progression rules, changing 10 levels is cheap. Changing 1,000 is not.

| 06 \| STAGE 3 — LESSON PLAYER VERTICAL SLICE |
|----------------------------------------------|

# Build the smallest app that can teach

## Build in this exact order

1.  Create the Expo app shell and navigation structure.

2.  Add content fetching for one published skill and its ten levels.

3.  Build a generic CardRenderer keyed by card.type; cards are data, not bespoke screens.

4.  Implement explanation/text cards with proper scroll/continuation behavior.

5.  Implement media cards with alt text, aspect-ratio handling, caption/attribution support.

6.  Implement question cards and answer selection.

7.  Show immediate feedback. After a wrong answer, keep the question visible, show its source card beneath it (“Take another look”) and require the correct answer before moving on.

8.  Persist in-progress position locally so an interrupted level resumes correctly.

9.  Implement the level-complete event and a temporary completion screen.

10. Only then add polish such as haptics or transitions.

## Card renderer contract

| **Card type** | **Payload**                                           |
|---------------|-------------------------------------------------------|
| text          | headline, body, optional emphasis/callout             |
| image         | asset_id, caption, alt_text, attribution display rule |
| fact          | short memorable fact + context                        |
| timeline      | ordered events payload                                |
| comparison    | two-or-more item comparison payload                   |
| mcq           | question_id; graded server-side; question.source_card_ids name the teaching cards shown after a miss |
| recall        | question_id tagged as prior-concept review            |
| checkpoint    | summary of learned concepts / transition              |

## Lesson-player acceptance tests

- All ten real levels render with zero hard-coded level-specific UI.

- Back/forward/resume never loses already submitted answers.

- Double tapping Complete cannot duplicate XP or completion.

- Wrong answers teach: the missed question shows its source card and must be answered correctly; nothing locks the learner out or consumes a “life.” The first attempt is recorded once, server-side, and restarting the level cannot replace it.

- App handles long text, missing optional media, offline interruption, and app restart safely.

- A published content revision can be fetched without shipping a new app binary.

| 07 \| STAGE 4 — PROGRESSION & CHARACTER SHEET |
|-----------------------------------------------|

# Make progress feel permanent

This is where the product stops feeling like a lesson viewer and starts feeling like an RPG. Build the progression engine before sophisticated home-screen discovery because the character sheet is the long-term retention object.

## Progress engine order

11. Create immutable XP event types and server-side award rules.

12. Create user_skill_progress and user_level_progress update functions.

13. Compute visible skill level from cleared canonical levels—not from arbitrary XP alone.

14. Add overall Knowledge Level as a derived aggregate metric.

15. Build the Character Sheet screen from real backend progress.

16. Add skill detail view: current level, 1–100 band progress, completed milestones, next level.

17. Add Level 100 mastery state and star/prestige representation in the data model even if 101+ content is not yet published.

18. Add achievements only after level/XP semantics are stable.

## XP should be a ledger, not a mutable counter

> Why the ledger matters
> If the user reports “my XP changed,” support should be able to inspect exactly why every point exists. An immutable xp_events table also prevents duplicate awards and makes later tuning possible without corrupting skill-level meaning.

| **Event**        | **Purpose**                | **Guardrail**                          |
|------------------|----------------------------|----------------------------------------|
| LEVEL_COMPLETE   | Completion XP by first-attempt accuracy from the level type’s own pool: regular 100 / 70 / 35 / 15; checkpoint 150 / 105 / 60 / 25; milestone 250 / 175 / 90 / 40; Mastery Challenge 500 / 350 / 175 / 75 | Once per canonical level; corrections add nothing; values configurable, never hard-coded in the UI |
| QUESTION_CORRECT | Retired per-answer bonus   | First-attempt accuracy now sets LEVEL_COMPLETE XP |
| DELAYED_RECALL   | +10: scheduled review item right on the first attempt | Once per scheduled review occurrence; replays/reopening earn nothing; a wrong first answer earns 0 and its required correction earns nothing |
| MASTERY_CLEAR    | Retired +250 Level 100 bonus | The Mastery Challenge’s own XP pool replaces it; the ★ comes from resolving Level 100 (no minimum score) |
| QUEST_COMPLETE (post-MVP) | Weekly Quest bonus | Once per quest per user. Quest progress itself is read from LEVEL_COMPLETE events, never counted separately. |
| CORRECTION       | Admin repair               | Explicit audited reason; not silent    |

## Stage 4 exit gate

- Two users can complete different paths and see distinct character sheets.

- Reinstall/login on a second device restores authoritative progress.

- Progress cannot move backward because a lesson is later revised.

- Skill level and mastery/star state are reproducible from stored progress data.

| 08 \| STAGE 5 — REVIEW & MASTERY ENGINE |
|-----------------------------------------|

# Make levels represent remembered knowledge

The app can feel game-like without pretending that completing a card equals mastery. Review should be lightweight, invisible enough not to feel like homework, and attached to concepts rather than specific wording of a question.

## Minimum review system

- Every question maps to one or more concept IDs.

- Completion creates or updates concept mastery records.

- First attempts adjust a simple strength score; corrections do not.

- Review_queue stores due concepts, not a frozen copy of one question.

- The app can present a different approved question that tests the same concept.

- Review never consumes one of the 5 daily new levels.

- Review items work like level questions: the first attempt is recorded once per scheduled review (+10 XP if right); a miss lowers strength, raises review priority, shows the source card beneath the question and requires the correct answer. Never just reveal the answer.

- Missing a review does not delete levels or prestige; it only leaves items due.

## Start simple

> Do not implement a research-grade spaced-repetition algorithm in V1.
> Use a small set of intervals driven by result quality (for example: soon, tomorrow, several days, later). The data model should preserve enough history to improve the scheduler later. The learning experience matters more than algorithmic sophistication at launch.

## Review entry points

- Home: “12 things worth refreshing.”

- After daily 5/5 completion: “Keep going with review.”

- Inside a skill: mastery/refresher button.

- Occasional recall card embedded into a new level when prerequisites make sense.

| 09 \| STAGE 6 — DAILY CAP & ANTI-DOOMSCROLL LOOP |
|--------------------------------------------------|

# Build the free limit as a completion mechanic

The limit must be enforced server-side, but it should be experienced as a successful finish rather than an energy wall. This is a core brand behavior and must be tested before subscriptions are connected.

## Implementation order

19. Define the user’s daily-boundary rule consistently; store allowance dates explicitly.

20. On starting a new level, check eligibility and current daily usage.

21. On successful first-time completion, increment new_levels_used exactly once.

22. At 5/5, route the next “Learn new level” intent to Daily Complete, not to an error.

23. Keep Review, Character Sheet, skill browsing, achievements, and completed levels accessible.

24. Add the premium entitlement bypass only after the free path is stable.

## Daily Complete screen content contract

| **Element**         | **Requirement**                                     |
|---------------------|-----------------------------------------------------|
| Completion          | 5 / 5 new levels                                    |
| Progress            | XP gained + skill-level changes                     |
| Learning            | Concepts learned/refreshed                          |
| Weekly Quest (post-MVP) | When a quest is active: quest name, x / 25 overall, x / 5 per skill, levels remaining, “Come back tomorrow and keep building.” |
| Voice               | “No more doomscrolling. Go touch grass.”            |
| Primary free action | Review what I learned                               |
| Secondary action    | Come back tomorrow                                  |
| Paid action         | Keep going — Unlimited \$4.99/mo                    |
| Trust line          | All knowledge remains unlockable for free over time |

> Abuse resistance without hostility
> Do not rely only on a device clock. Treat the backend as authoritative for daily completions. The goal is preventing accidental/obvious abuse—not building a bank-grade anti-fraud system.

| 10 \| STAGE 7 — CONTENT FACTORY & ADMIN |
|-----------------------------------------|

# Only now scale beyond the golden levels

Once the mobile renderer, progress model, and review tags have survived real levels, build the internal tool that lets AI-assisted content production move quickly without turning publishing into a trust problem.

## Internal content workflow

| **Step**     | **Operation**                                                                  |
|--------------|--------------------------------------------------------------------------------|
| 1\. Outline  | Create Level 1–100 syllabus with learning objective and concept IDs.           |
| 2\. Source   | Attach structured facts and approved references to each concept.               |
| 3\. Draft    | Generate candidate cards/questions from approved concept facts.                |
| 4\. Validate | Run schema, duplicate, answer, source, length, rights, and consistency checks. |
| 5\. Review   | Human approves sequence, accuracy, wording, difficulty, tone, and media.       |
| 6\. Preview  | Render exactly as the mobile app will render it.                               |
| 7\. Publish  | Create immutable revision; app can now fetch it.                               |
| 8\. Correct  | Publish a new revision without destroying earned user progress.                |

## Admin screens to build

- Subject/skill tree manager with published-level counts.

- Level editor with ordered cards and learning objectives.

- Concept editor with canonical facts and source links.

- Question editor with correctness, distractors, rationale, concept tags, difficulty.

- Asset picker with license, source, attribution, alt text, and usage restrictions.

- Validation panel with blocking errors vs warnings.

- Mobile preview of the full level.

- Publish/revision history and rollback visibility.

- Content issue inbox from user reports.

## Automated validation before publish

- Missing source or rights metadata.

- Question has zero or multiple correct answers.

- Answer is leaked verbatim in nearby card text when not intentional.

- Duplicate/near-duplicate question in the same skill band.

- Level exceeds mobile text budgets or has too many cards.

- Concept prerequisite appears after the level that depends on it.

- Broken asset/reference link.

- Revision changes a stable ID incorrectly.

| 11 \| STAGE 8 — SUBSCRIPTIONS |
|-------------------------------|

# Add payment last, but architect entitlement early

The free experience must already feel complete and trustworthy. Premium is a simple entitlement: unlimited new levels. Keep the product promise understandable in one sentence.

## Subscription implementation order

25. Create a single internal entitlement name, e.g. unlimited_learning.

26. Configure monthly and annual products in App Store Connect / Google Play.

27. Connect products to RevenueCat offerings and entitlement.

28. Integrate the mobile SDK and identify/log in the user consistently.

29. Cache entitlement status locally for UX but validate authoritative state through the subscription provider/backend strategy.

30. Build paywall UI around the established Daily Complete moment.

31. Implement restore purchases and account-transfer edge cases.

32. Add subscription-management/customer-center path.

33. Test sandbox purchases, renewals, cancellation, expiration, restore, offline launch, and device change.

> Do not create “premium XP.”
> A paid learner may progress faster only because they can complete more new levels per day. The meaning of Level 50 must remain the same for free and paid users.

| 12 \| STAGE 9 — ANALYTICS, REPORTING & OPERATIONS |
|---------------------------------------------------|

# Measure learning and product health, not addiction

## Minimum event taxonomy

| **Event**                                | **Why it exists**                                                             |
|------------------------------------------|-------------------------------------------------------------------------------|
| onboarding_started / completed           | Where activation drops.                                                       |
| skill_selected                           | Which initial interests drive activation.                                     |
| level_started / completed                | Pacing and completion rate by canonical level.                                |
| question_answered                        | Correctness and ambiguity diagnostics; never send unnecessary sensitive text. |
| review_due / completed                   | Whether recall loop is functioning.                                           |
| daily_5_complete                         | Core free habit completion.                                                   |
| paywall_viewed                           | Natural monetization exposure.                                                |
| subscription_started / renewed / expired | Business health.                                                              |
| content_reported                         | Trust/quality incident signal.                                                |
| app_error                                | Technical reliability.                                                        |

## Primary product metrics

- Percent of new users who finish Level 1.

- Percent who complete all 5 free levels on a day.

- Day-1 / Day-7 return among users who completed at least one level.

- Review completion and first-attempt recall accuracy.

- Level-specific abandon rate and question error rate.

- Content report rate per 1,000 level completions.

- Free-to-paid conversion after naturally hitting the cap.

- Retention by skill depth, not minutes spent.

> Do not optimize for session length.
> A 14-minute session that teaches five levels and ends cleanly can be a better outcome than a 55-minute session. “Time spent” is diagnostic, not the product’s north-star metric.

| 13 \| STAGE 10 — SCALE THE LAUNCH CURRICULUM |
|----------------------------------------------|

# Expand only through a proven pipeline

At this point the lesson schema, mobile renderer, review tagging, progression semantics, and publish workflow are stable enough to scale. The bottleneck becomes editorial quality, not code.

## Recommended scale sequence

34. Finish the flagship skill to Level 100 and test the entire 1–100 pacing curve.

35. Build a second skill with a different structure (for example geography instead of chronology) to prove the schema is not overfit.

36. Create reusable content templates for maps, timelines, comparisons, people, processes, and cause/effect.

37. Expand to 6–10 launch skill trees with complete 1–100 bands.

38. Only then broaden the top-level subject catalog if needed.

39. Prepare 101–200 outlines, but do not prioritize production until real users approach Level 100.

## Content release gate for every 100-level tree

- All 100 levels have distinct learning objectives and coherent progression.

- No unsupported or ambiguously licensed media.

- Question distributions do not become repetitive/predictable.

- Major prerequisite concepts appear before dependent concepts.

- Level 100 feels like a synthesis/mastery checkpoint, not just “one more lesson.”

- Content is previewed on actual small and large phone widths.

- Sources and revision metadata are complete.

| 14 \| STAGE 11 — BETA, QA & RELEASE |
|-------------------------------------|

# Test the system the way users will break it

## Private alpha

- 5–15 testers who did not watch the app get built.

- Ask them to start with no explanation beyond the onboarding itself.

- Observe whether “levels,” skills, XP, the 5/day rule, review, and prestige concept are self-explanatory.

- Collect every factual/content complaint separately from UI/technical feedback.

- Instrument where users abandon individual cards/levels.

## Technical QA matrix

| **Area**      | **Must test**                                                                                  |
|---------------|------------------------------------------------------------------------------------------------|
| Account       | Guest/first run, sign-up/login, logout/login, second device, account deletion flow             |
| Progress      | Resume midway, double completion, retry, revision after completion, offline interruption       |
| Daily limit   | 4→5→blocked-new flow, next-day reset, premium bypass, clock manipulation edge case             |
| Subscription  | Purchase, restore, cancel, expire, renew, no-network launch, store error                       |
| Content       | Missing image, long text, malformed payload blocked before publish, source/attribution display |
| Accessibility | Dynamic text, screen reader labels, contrast, tap targets, reduce motion                       |
| Release       | Development, staging, production configs; logs/errors; migration rollback plan                 |

## Release sequence

40. Internal development build.

41. Private TestFlight / Play internal testing.

42. Closed beta with production-like backend/content.

43. Fix activation, crash, content accuracy, and progression bugs.

44. Store metadata/privacy/subscription review.

45. Public release with limited but complete launch curriculum.

46. Monitor errors and content reports daily during initial release window.

| 15 \| CORE REQUEST FLOWS |
|--------------------------|

# Keep the client thin

The app should ask the backend for eligibility and authoritative progress; it should not be trusted to award itself levels or XP. This is both safer and easier to debug.

## Start a new level

47. Client requests next canonical level for a skill.

48. Server checks publication status, prerequisite/completion state, daily allowance, and entitlement.

49. Server returns the published level bundle and a start/session identifier if needed.

50. Client renders locally and records in-progress UI state.

## Complete a level

51. Each attempt goes to the server as it happens (answer_question); the first attempt per question is stored once and never replaced. The client then submits level ID, revision and a completion idempotency key.

52. Server verifies that the level is eligible, not already awarded, and that every question has been correctly resolved; XP is set by first-attempt accuracy.

53. One transaction writes level completion, XP events, skill progress, concept mastery/review updates, and daily allowance increment.

54. Server returns authoritative updated character/progress summary.

55. Client plays completion animation from the returned result.

## Fetch review

56. Server selects due concept IDs and appropriate approved questions.

57. Client presents review without consuming new-level allowance.

58. Results update concept mastery and next due time.

59. Skill level never decreases because of a bad review; mastery indicators may reflect items needing refresh.

> UI should animate facts, not invent them.
> The client may animate “Astronomy 9 → 10,” but that result must come from the authoritative completion response. This keeps the app visually fun while the data model remains deterministic.

| 16 \| CRITICAL-PATH BACKLOG |
|-----------------------------|

# What to build, literally in order

| **\#** | **Task**                | **Done means**                                         |
|--------|-------------------------|--------------------------------------------------------|
| 1      | Repo + environments     | App boots in development; staging backend exists.      |
| 2      | Migrations + ID rules   | Fresh database can be recreated reliably.              |
| 3      | Content JSON validator  | Malformed levels fail before import.                   |
| 4      | 10 golden levels        | Real content available as canonical seed data.         |
| 5      | Read-only content API   | App can fetch skills/levels/cards/questions.           |
| 6      | Mobile navigation shell | Onboarding → skill → lesson → completion path exists.  |
| 7      | Generic card renderer   | Golden levels render from data only.                   |
| 8      | Question engine         | Answers + explanations + state/resume work.            |
| 9      | Completion transaction  | Exactly-once progress/XP update.                       |
| 10     | Character sheet         | Skill and overall progress visible.                    |
| 11     | Review queue            | Prior concepts reappear and update mastery.            |
| 12     | 5/day allowance         | Free path ends deliberately; review remains open.      |
| 13     | Content admin v1        | Edit/validate/preview/publish without raw DB editing.  |
| 14     | Publishing/revisions    | Corrections are versioned; progress survives.          |
| 15     | RevenueCat              | Unlimited entitlement + restore + expiration behavior. |
| 16     | Analytics + reports     | Can detect funnel/content/technical failures.          |
| 17     | Finish flagship 1–100   | Whole depth curve proven.                              |
| 18     | Scale launch trees      | Content pipeline used repeatedly.                      |
| 19     | Closed beta             | Unknown users complete core loop without coaching.     |
| 20     | Store release           | Production monitoring and correction workflow ready.   |

| 17 \| DEFERRED FEATURES |
|-------------------------|

# Things that are tempting but should wait

| **Defer**                 | **Why**                                                                                 |
|---------------------------|-----------------------------------------------------------------------------------------|
| Complex avatars/equipment | Visual fun, but does not validate the learning/progression loop.                        |
| Social graph/followers    | Creates moderation/privacy/product complexity before core retention is proven.          |
| Leaderboards              | Can reward grinding and conflict with anti-doomscrolling mission.                       |
| Live AI tutor             | Cost, safety, and hallucination surface; deterministic curriculum is the MVP advantage. |
| User-generated lessons    | Requires moderation, rights, quality, and source verification infrastructure.           |
| Web/desktop learning app  | Splits UI work; launch mobile-first.                                                    |
| Deep prestige content     | Do not produce 201–300 while most users have not approached 100.                        |
| Recommendation ML         | Simple continue/choose-skill logic is enough initially.                                 |
| Custom billing backend    | RevenueCat/store systems already solve the hard cross-platform pieces.                  |
| Microservices             | A relational backend and a few server functions are sufficient.                         |
| Weekly Knowledge Quests   | Built on the proven loop plus trophies, titles, profile and cosmetics; must not block the MVP. |

> The product can be deep without being technically complicated.
> Depth comes from hundreds of coherent canonical levels, visible mastery, and trustworthy review—not from a large number of software subsystems.

| 18 \| MVP DEFINITION OF DONE |
|------------------------------|

# The MVP is ready when all of this is true

☐ A new user can understand the premise and enter a real skill quickly.

☐ At least one complete 1–100 skill tree is published; additional launch trees may be added before public release.

☐ Every published lesson is source-backed, versioned, and rendered from the content system.

☐ Level completion and XP are exactly-once and server-authoritative.

☐ Character Sheet clearly shows persistent skill progression.

☐ Review brings back older concepts and remains available after the free cap.

☐ Free users can complete 5 new levels/day; premium users can continue without that cap.

☐ Subscription purchase/restore/expiration works on both iOS and Android.

☐ Users can report a content problem from the app.

☐ An editor can correct and republish content without deleting earned user progress.

☐ Analytics can reveal activation, completion, cap hits, review behavior, conversion, crashes, and content issues.

☐ Core screens are accessible, responsive, and performant on representative devices.

☐ No unfinished social, Weekly Quest, currency, avatar, or AI-tutor system is required for the core loop.

## The next document: Visual Direction

Once this build order is accepted, the Visual Direction document should define the aesthetic system that the engineering work will implement: brand mood, color palette, light/dark behavior, typography, iconography, skill colors, cards, navigation, character sheet, skill tree, level-up animation, daily-complete screen, paywall, illustration/media rules, and component states. It should include actual screen-style examples rather than only adjectives.

> Recommended next move
> Lock the visual language before polishing the mobile shell—but after the functional card types and screen list above are known. That gives design something concrete to style without letting design dictate unstable product architecture.

| APPENDIX \| STACK REFERENCES |
|------------------------------|

# Official implementation references

| **Reference**                | **URL**                                                                        | **Use**                                                                         |
|------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Expo EAS Build               | https://docs.expo.dev/build/introduction/                                      | Hosted Android/iOS build and distribution workflow.                             |
| Supabase + Expo React Native | https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native | Official Expo quickstart for Postgres/Data API client setup and RLS guidance.   |
| Supabase Auth + React Native | https://supabase.com/docs/guides/auth/quickstarts/react-native                 | Official mobile authentication quickstart.                                      |
| RevenueCat + Expo            | https://www.revenuecat.com/docs/getting-started/installation/expo              | Official Expo integration and development-build requirements for subscriptions. |

Stack choices are recommendations, not irreversible product requirements. The data contracts and build sequence are intentionally more important than any individual vendor.

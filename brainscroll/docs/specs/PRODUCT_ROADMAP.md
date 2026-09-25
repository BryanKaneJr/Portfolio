---
title: "BrainScroll Product & Build Roadmap"
status: canonical
source_docx: "Knowledge_RPG_Product_Build_Roadmap(2).docx"
merged_decisions: "CURRENT_PRODUCT_DECISIONS.md (2026-09-23)"
---

PRODUCT ROADMAP

KNOWLEDGE RPG

A practical roadmap to build the anti-doomscrolling learning app

Stop scrolling. Start leveling.

|  |  |  |
| --- | --- | --- |
| 5<br>new levels/day free forever | 1-100<br>canonical levels per skill tree | $4.99<br>monthly unlimited launch hypothesis |

Working product specification - MVP through launch and first expansion

# 1. Product North Star

|  |  |
| --- | --- |
|  | The product in one sentence<br>A social-media-shaped learning app where users level up real knowledge like an RPG character, with finite, source-backed Level 1-100 skill trees instead of an endless feed. |

The app should feel satisfying for the same reason an RPG feels satisfying: users can see exactly what they have built. History, astronomy, geography, economics, art, and practical-world knowledge become persistent character stats. The feed is not the product; the character sheet and the knowledge graph are the product. The feed is simply the fastest interface for making progress.

## Non-negotiable product principles

- Canonical progression. Every Level 1-100 has a defined place in a real curriculum. Level 63 means something.

- Progress represents learning, not time spent. XP and levels should reward completion, recall, and mastery rather than raw scrolling.

- Finite daily free progression. Free users get 5 new levels per day, then the app tells them they are done rather than manufacturing more engagement.

- Everything can be learned for free over time. Paying removes the daily cap; it does not buy exclusive knowledge.

- No ads, energy systems, gems, loot boxes, or punitive hearts. The business model should be understandable in one sentence.

- Source-backed content. Lessons are generated and reviewed before publication; the live app should not invent knowledge on demand.

- Tone: clever, self-aware, and slightly irreverent. Never preachy. The app should be comfortable saying, “No more doomscrolling. Go touch grass.”

## Definition of success

A user should be able to open the app after six months and immediately see a character sheet that tells a story about what they actually know: “Astronomy Lv. 84, Roman History Lv. 143 ★, Economics Lv. 31.” That identity and accumulated progress are the long-term retention engine.

# 2. MVP Product Design

| **System**          | **MVP rule**                                              | **Why it matters**                                                      |
|---------------------|-----------------------------------------------------------|-------------------------------------------------------------------------|
| **Subjects**        | Launch with 6 broad subjects.                             | Keeps choice simple while allowing very different knowledge “builds.”   |
| **Skill trees**     | Each subcategory has canonical Levels 1-100.              | Makes progress legible and comparable.                                  |
| **Daily free cap**  | 5 new levels/day; reviews remain unlimited.               | Monetizes without blocking eventual access.                             |
| **Paid plan**       | \$4.99/month; \$39.99/year as launch hypotheses.          | Simple “remove friction” subscription.                                  |
| **First-day bonus** | Test 10-15 new levels on day one.                         | Lets new users experience enough progression before the normal cap.     |
| **Review**          | Unlimited spaced-repetition recall from completed levels. | Improves retention and gives free users something useful after the cap. |
| **Character sheet** | Overall Knowledge Level + subject + skill levels.         | Turns learning into an RPG identity.                                    |
| **Prestige**        | Level 101-200 unlocks after Mastery I; no reset.          | Adds depth without invalidating prior progress.                         |
| **Weekly Knowledge Quests** | Post-MVP. One themed quest a week: ~25 new levels across 5 related skills. | Short-term purpose and a real choice for each day’s five free levels. |

## Recommended launch subjects

| **Subject**             | **Flagship launch trees**                        |
|-------------------------|--------------------------------------------------|
| **History**             | Ancient Rome; World War II                       |
| **Science**             | Astronomy; Human Body                            |
| **Geography**           | Countries & Capitals; Earth & Physical Geography |
| **Money & Economics**   | Money, Markets & Everyday Economics              |
| **Arts & Culture**      | Art History & Major Movements                    |
| **How the World Works** | Computing & Internet; Infrastructure & Energy    |

|  |  |
| --- | --- |
|  | Content target<br>Closed beta can begin with roughly 6 complete trees (600 levels). A public launch feels much stronger around 8-10 complete trees (800-1,000 levels). Every released tree should be complete through Level 100; do not launch half-finished trees that end at Level 27. |

## What one level contains

A level should usually take about 2-5 minutes and feel like a compact learning encounter, not a chapter and not a test. The learning content is the main experience; questions support it. A typical level includes:

- 1 short hook or setup card

- 3-5 focused explanation or visual cards (roughly 180-320 words in total, making one concept memorable: learn > interesting > fun)

- 1 connection to previously learned knowledge

- 3 light questions: one recall (the core fact), one understanding (why or how), one connection (to another concept, event or idea). A wrong answer shows the card that teaches it and must be answered again correctly; there is no penalty and no restart

- optional image, map, timeline, diagram, or comparison card

- a completion event, once every question is correctly resolved, that awards XP by first-attempt accuracy, advances the skill level and shows the next level immediately

Testing scales with the moment, not with every level: regular levels have 3 questions; every 10th-level checkpoint has 5; the Level 50 milestone has 7; the Level 100 Mastery Challenge has 10; review sessions vary with the concepts currently due. Wrong answers are corrected in context with the lesson’s own evidence, never penalized.

# 3. RPG Progression System

The progression system should be deep enough to feel like a game but simple enough that a new user understands it within one minute.

| **Layer**    | **Example**                       | **Rule**                                                    |
|--------------|-----------------------------------|-------------------------------------------------------------|
| **Overall**  | Knowledge Level 37                | Derived from total verified progression across all skills.  |
| **Subject**  | History Lv. 17                    | Roll-up of related skill trees.                             |
| **Skill**    | Roman History Lv. 63              | Directly tied to canonical Level 63 completion.             |
| **Mastery**  | 87% recall                        | Tracks durable recall separately from progression.          |
| **Prestige** | Roman History Lv. 143 ★           | 101-200 is a deeper second curriculum, not a replay.        |
| **Title**    | Historian / Polymath / Astronomer | Earned from transparent requirements, not arbitrary status. |

## Level bands for every 1-100 tree

| **Band**  | **Purpose**                                                                                                |
|-----------|------------------------------------------------------------------------------------------------------------|
| **1-10**  | Absolute fundamentals: vocabulary, orientation, major people/places, the basic map of the topic.           |
| **11-25** | Core events, systems, relationships, and frequently referenced knowledge.                                  |
| **26-50** | Intermediate depth, chronology, causes/effects, comparisons, and important exceptions.                     |
| **51-75** | Broader context, second-order connections, deeper mechanisms, and less obvious material.                   |
| **76-95** | Advanced synthesis, nuanced relationships, challenging recall, and more specialized concepts.              |
| **96-99** | Integration: questions that force the learner to connect the full tree rather than recall isolated facts.  |
| **100**   | Mastery Challenge (10 questions: the fullest test in the tree). Completing it, with every question correctly resolved, grants the first mastery star and unlocks the 101-200 expansion when available. No minimum first-attempt score. |

## Prestige without the annoying reset

Normal games often prestige by deleting progress. This app should do the opposite. The star signals depth while the level continues upward.

|  |  |
| --- | --- |
|  | Example<br>Roman History Lv. 100 -> ★ Mastery I -> Levels 101-200 unlock. Level 101 begins more specialized material such as dynasties, provincial administration, military reform, architecture, primary-source context, and historical debates. |

## XP rules

- New level completion: XP by first-attempt accuracy: 3/3 → 100 (Perfect Recall), 2/3 → 70, 1/3 → 35, 0/3 → 15. Correcting a missed question completes the level but never restores XP; replays award nothing; XP is never negative.

- First attempts count once: each question’s first answer is recorded on the server and can’t be replaced by restarting the level, so leaderboards and mastery stay honest.

- Review: +10 XP for a scheduled review item answered correctly on the first attempt, once per scheduled review (replaying or reopening it earns nothing). A wrong first answer earns 0 XP, lowers that concept’s recall strength, brings it back sooner, and must still be corrected with its source card on screen; corrections never add XP.

- Checkpoints, milestones and Mastery Challenges have their own first-attempt XP pools (initial balancing, configurable):

  | **Encounter**                       | **Questions** | **First-attempt XP bands**                               |
  |-------------------------------------|---------------|----------------------------------------------------------|
  | **Regular level**                   | 3             | 3/3 → 100 · 2/3 → 70 · 1/3 → 35 · 0/3 → 15               |
  | **10-level checkpoint**             | 5             | 5/5 → 150 · 4/5 → 105 · 3/5 → 60 · 0–2/5 → 25            |
  | **Level 50 milestone**              | 7             | 7/7 → 250 · 6/7 → 175 · 4–5/7 → 90 · 0–3/7 → 40          |
  | **Level 100 Mastery Challenge**     | 10            | 10/10 → 500 · 8–9/10 → 350 · 5–7/10 → 175 · 0–4/10 → 75  |

  There is no separate mastery bonus.

- Mastery star: resolving every Level 100 question earns the ★ and opens Levels 101-200, with no minimum first-attempt score. The star shows depth reached; the first-attempt score shows quality of recall. Perfect Mastery (10/10 first try) may become a future accomplishment. Everywhere: first attempts set reward and memory strength; correct resolution sets completion and progression.

- No XP for passive feed time. Scrolling without completing learning should not level the character.

## Weekly Knowledge Quests (post-MVP)

Permanent skill trees answer “What kind of knowledgeable person am I becoming?” Weekly Knowledge Quests answer “What am I building toward this week?” A standard quest asks for about 25 new levels across 5 related skills (The Roman World: Roman History, European Geography, Art & Architecture, Government & Society, Mythology & Religion, +5 each), then a 3-question Final Encounter, and awards a trophy, a title, an earned cosmetic and an XP bonus. The full design lives in the Social + Rewards Expansion Spec.

- Only new levels completed during the quest count. Existing levels never auto-complete it, and replays and reviews never count.

- A free user finishes a standard quest in about five learning days and chooses where each day’s five levels go. Unlimited only lets a user finish faster or keep other skills moving; it never unlocks exclusive quests, knowledge or rewards.

- Ended quests move to the Chronicle and stay completable with the same trophy, title and primary cosmetic. A live-week clear adds only a subtle dated marker.

# 4. Knowledge & Curriculum Architecture

The most important implementation decision is to store knowledge as structured, versioned curriculum objects rather than a pile of questions. Questions are views of knowledge; they are not the knowledge itself.

| **Object**        | **Stores**                                                                                  |
|-------------------|---------------------------------------------------------------------------------------------|
| **Subject**       | History, Science, Geography, Money & Economics, Arts & Culture, How the World Works         |
| **Skill tree**    | A focused learnable domain such as Ancient Rome or Astronomy                                |
| **Level**         | Ordered curriculum unit: 1-100, 101-200, etc.                                               |
| **Concept**       | Canonical fact, relationship, mechanism, event, person, place, or idea                      |
| **Source record** | Source URL/identifier, license, retrieval date, notes, verification status                  |
| **Card**          | The explanation, visual, comparison, timeline, question, or recap shown to a user           |
| **Question**      | Prompt, answer set, rationale, difficulty, concept IDs, ambiguity checks                    |
| **Asset**         | Image/map/diagram metadata, rights status, attribution when needed                          |
| **Revision**      | Published version and correction history so content can improve without corrupting progress |

## Canonical-level rule

|  |  |
| --- | --- |
|  | Do this from day one<br>A user’s progress should point to stable Level IDs and Concept IDs. If the wording of a card changes later, the user does not lose credit. If a factual correction materially changes a concept, the revision system can selectively requeue that concept for review. |

## Recommended stored content shape

> skill_id: history_rome level_number: 37 title: The Second Triumvirate concept_ids: [octavian, antony, lepidus, triumvirate_43_bce] prerequisites: [history_rome_36] cards: [hook, explainer, timeline, connection, quiz, quiz, quiz] source_ids: [wikidata_Q..., source_...] difficulty: 0.37 revision: 1.2 status: published

# 5. Free & Legal Knowledge Sourcing

Use open data and public-domain-friendly sources to build the factual backbone, then publish original educational explanations and questions. Keep provenance attached to every concept and every media asset.

| **Source**                          | **Best use**                                                | **Roadmap rule**                                                                                                  |
|-------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| **Wikidata**                        | Structured entities, dates, relationships, identifiers.     | Primary structured backbone. Main/property/lexeme structured data is CC0.                                         |
| **Wikipedia**                       | Research context, topic discovery, references, gap finding. | Do not blindly copy prose. Wikipedia text is generally CC BY-SA; track licensing when reused/adapted.             |
| **Smithsonian Open Access**         | Museum objects, art, history, cultural images/data.         | Prefer assets explicitly marked CC0; keep source metadata.                                                        |
| **NASA**                            | Space/science imagery and educational factual material.     | Use according to NASA media guidelines; avoid implying endorsement and watch third-party/copyright-marked assets. |
| **Other public-domain/CC0 sources** | Government data, archives, museums, scientific datasets.    | Only ingest after the license is recorded in the source registry.                                                 |

|  |  |
| --- | --- |
|  | Legal hygiene<br>Build a source registry before scaling content. “We found it online” is never a license. Every reusable asset needs a rights status. Every concept should have enough provenance to let an editor quickly verify or correct it. Have an IP attorney review the final commercial ingestion and attribution rules before public launch. |

## Content production pipeline

**1. Define syllabus** Human/AI drafts the Level 1-100 outline and prerequisite order.

**2. Gather source facts** Pull structured facts and references into the concept database.

**3. Generate lesson drafts** AI creates card variants and question candidates from the approved concept set.

**4. Automated checks** Detect duplicates, answer leakage, contradictory dates, unsupported claims, ambiguous distractors, bad reading length, missing sources, and license gaps.

**5. Editorial review** A reviewer approves facts, sequence, tone, difficulty, and questions.

**6. Publish version** Freeze a deterministic lesson bundle with IDs and revision numbers.

**7. Observe and correct** Use user reports, question performance, and source updates to revise content without changing the learner’s earned progression.

# 6. Practical MVP Technical Architecture

The architecture should be boring on purpose. The novelty is the curriculum and progression system, not infrastructure.

| **Layer**           | **Practical recommendation**                                                 | **Responsibility**                                                         |
|---------------------|------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| **Mobile app**      | React Native + Expo + TypeScript                                             | iOS/Android UI, local cache, skill tree, lessons, review flow.             |
| **Backend**         | Postgres-backed BaaS such as Supabase                                        | Auth, user progress, content delivery, admin/editor data.                  |
| **Subscriptions**   | Native App Store / Play billing with an entitlement layer such as RevenueCat | Monthly/annual Unlimited access and restore purchases.                     |
| **Content tooling** | Internal web/admin tool + scripts                                            | Generate, review, source, validate, version, and publish lessons.          |
| **Analytics**       | Privacy-conscious event analytics                                            | Activation, retention, completion, cap hits, conversion, question quality. |
| **Errors**          | Crash/error reporting                                                        | Production reliability and debugging.                                      |
| **Offline/cache**   | Local database/cache                                                         | Prefetch lessons and reviews so the app feels instant.                     |

## Backend tables to create first

- subjects, skills, levels, concepts, level_concepts

- cards, questions, answer_options, assets, sources, source_links

- users, user_skill_progress, user_level_progress, user_concept_mastery

- review_queue, xp_events, achievements, user_achievements

- daily_allowances, entitlements, content_revisions, content_reports

- Post-MVP: cosmetics, user_cosmetics, quests, quest_requirements, user_quests. Quest progress is derived from the same xp_events ledger, never a separate counter.

## One critical backend rule

|  |  |
| --- | --- |
|  | Server-authoritative progress<br>The phone can cache aggressively, but the server should own level completion, XP, daily new-level allowance, and entitlements. This prevents easy local tampering and keeps progress consistent across devices. |

# 7. Build Roadmap - In the Order It Should Actually Happen

Two tracks run in parallel: Product Engineering and Curriculum Production. The app can be technically functional very quickly, but the launch quality will be determined by content quality and depth.

| **Phase**               | **Engineering deliverable**                                                      | **Content deliverable**                               | **Exit gate**                                                             |
|-------------------------|----------------------------------------------------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------|
| **0 - Lock rules**      | Written product spec; navigation map; schema draft.                              | 6 subjects; initial launch tree list; level template. | No unresolved rules around levels, daily cap, mastery, or prestige.       |
| **1 - Data foundation** | Database, auth, content APIs, progress model, source registry.                   | One complete 1-100 syllabus outline.                  | Can store a level, its concepts, cards, sources, and user completion.     |
| **2 - Content factory** | Admin/editor workflow; import/generation scripts; validations.                   | First 25 production-quality levels.                   | A reviewer can create -\> verify -\> publish without touching app code.   |
| **3 - Core app loop**   | Onboarding, subject/skill select, feed/lesson player, questions, XP, completion. | First full 100-level tree.                            | New user can start at Level 1 and progress cleanly through a real tree.   |
| **4 - RPG layer**       | Character sheet, skill tree, level bars, titles, mastery, review queue.          | Second/third 100-level trees.                         | Progress feels persistent and game-like, not like a quiz app.             |
| **5 - Free/paid loop**  | 5-level daily allowance, first-day bonus, paywall, subscriptions, restore.       | Paywall copy and post-cap review content.             | Free user can finish the day gracefully; paid user continues immediately. |
| **6 - Closed alpha**    | Crash reporting, analytics, content reporting, onboarding cleanup.               | Approx. 300 complete levels.                          | Small testers can use it for a week without hand-holding.                 |
| **7 - Closed beta**     | Performance, offline/prefetch, accessibility, account recovery, polish.          | Approx. 600 complete levels across 6 trees.           | Retention and question-quality data are good enough to scale.             |
| **8 - Public launch**   | Store assets, subscriptions, support flows, privacy/legal pages, release build.  | Approx. 800-1,000 complete levels across 8-10 trees.  | No half-built trees; source registry and correction workflow operational. |
| **9 - Expansion**       | Rewards foundation (trophies, titles, profile, earned cosmetics), then Weekly Knowledge Quests, then friends / comparisons. | 101-200 prestige packs; new trees; weekly quest themes that pair 5 related trees. | Expansion adds depth without changing the simple core loop; quests never block it. |

## Suggested solo/AI-assisted timeline

A focused MVP can be treated as an approximately 8-10 week launch track if engineering and content production run in parallel. Content review, not code volume, is the likely bottleneck. If quality slips, reduce the number of launch trees rather than shortening them below Level 100.

| **Window**     | **Primary focus**                                                                      |
|----------------|----------------------------------------------------------------------------------------|
| **Days 1-3**   | Lock product rules, information architecture, schema, and one full 1-100 syllabus.     |
| **Week 1**     | Backend foundation + content registry + lesson JSON/schema + first production content. |
| **Week 2**     | Admin/content factory + app shell + onboarding + lesson player.                        |
| **Weeks 3-4**  | Progression, questions, XP, character sheet, skill tree, review system.                |
| **Weeks 4-5**  | Subscriptions, daily cap, first-day bonus, analytics, content reporting.               |
| **Weeks 5-7**  | Closed alpha/beta while content factory scales toward 600 polished levels.             |
| **Weeks 7-10** | Polish, offline/cache, store preparation, and scale toward 800-1,000 launch levels.    |

# 8. Screens to Build - Minimal Set

| **Priority** | **Screen**            | **Must do**                                                                   |
|--------------|-----------------------|-------------------------------------------------------------------------------|
| **P0**       | Sign-in               | Account required before any progress: Apple, Google, phone or email (fallback). One tap where possible. No guest mode. |
| **P0**       | Onboarding            | Right after sign-in: pick interests, explain levels, start first tree within ~60 seconds. |
| **P0**       | Home / Continue       | One obvious “continue leveling” action plus daily progress.                   |
| **P0**       | Subject / Skill tree  | Show 1-100 progress, locked future levels, mastery star, current node.        |
| **P0**       | Lesson feed           | Swipe/tap through cards, answer questions, finish level.                      |
| **P0**       | Level complete        | XP animation, new level, concept summary, continue action.                    |
| **P0**       | Character sheet       | Overall, subject, skill, mastery, titles, achievements.                       |
| **P0**       | Daily cap             | Celebrate 5/5, offer unlimited review, and optionally Unlimited subscription. Post-MVP: also show active Weekly Quest progress. |
| **P0**       | Review                | Spaced-repetition queue from previously completed concepts.                   |
| **P0**       | Subscription          | Monthly/annual, restore, clear free-vs-paid explanation.                      |
| **P1**       | Achievements / titles | Transparent requirements and earned rewards.                                  |
| **P1**       | Content report        | Flag factual issue, confusing question, typo, or bad image.                   |
| **P2**       | Friends / comparisons | Only after the solo loop is proven; avoid anxiety mechanics.                  |
| **Post-MVP** | Weekly Quest + Chronicle | Theme emblem, five 0/5 requirements, 0/25 total, reward preview, Final Encounter; archive of past quests. |

# 9. Monetization & Anti-Doomscrolling Rules

|  |  |
| --- | --- |
|  | Launch offer<br>Free forever: 5 new levels per day, unlimited review, all subjects available. Unlimited: $4.99/month or $39.99/year as initial pricing hypotheses. No ads. No premium-only knowledge. Weekly Knowledge Quests follow the same rule: the standard quest is finishable free, and Unlimited only lets a user finish it faster. |

The free limit should feel like completion rather than punishment. After the fifth new level, show a satisfying daily-complete screen and keep the app useful through review, character stats, achievements, and previously unlocked content.

## Brand voice at the cap

> DAILY KNOWLEDGE COMPLETE
> 5 / 5 new levels
> WEEKLY QUEST · THE ROMAN WORLD · 14 / 25
> Roman History 5/5 ✓ · European Geography 5/5 ✓ · Art & Architecture 3/5 · Government & Society 1/5 · Mythology & Religion 0/5
> 11 levels remaining. Come back tomorrow and keep building.
> No more doomscrolling. Go touch grass.
> Review Knowledge | Keep Leveling · Unlimited $4.99/month

The Weekly Quest block appears only while a quest is active (post-MVP).

## Monetization guardrails

- Do not lock whole subjects behind payment.

- Do not make incorrect answers consume lives or energy.

- Do not sell XP, mastery, levels, or prestige. Knowledge progression must remain earned.

- Do not use interstitial ads between learning cards.

- Do not punish missed days by deleting progress or destroying a streak investment.

- Do not use fake urgency. Subscription prompts should appear at natural friction points, especially when the free user asks to continue after 5 levels.

- Do not make Weekly Quests, their knowledge or their core rewards Unlimited-only. Pay for freedom, not knowledge.

- Do not use FOMO. When a Weekly Quest ends it moves to the Chronicle; nothing is lost forever.

# 10. Analytics That Match the Mission

Do not optimize the product around minutes spent. The mission is better served by useful progress and durable return behavior.

| **Metric**                        | **What it tells us**                                                      |
|-----------------------------------|---------------------------------------------------------------------------|
| **Activation**                    | Percent of new users who complete 3 levels in their first session.        |
| **Day 1 / Day 7 / Day 30 return** | Whether leveling knowledge becomes a habit.                               |
| **Daily 5/5 completion**          | Whether the free allowance is achievable and satisfying.                  |
| **Cap hit rate**                  | How often engaged free users naturally reach the monetization moment.     |
| **Paid conversion after cap**     | Whether Unlimited is valuable without aggressive prompting.               |
| **Review participation**          | Whether users care about retaining knowledge, not only unlocking levels.  |
| **Delayed recall accuracy**       | A learning-quality signal independent of progression speed.               |
| **First-attempt accuracy / Perfect Recall rate** | Whether levels teach well enough to be remembered minutes later; outlier questions flag ambiguity. |
| **Tree completion**               | Whether 1-100 pacing and difficulty stay interesting.                     |
| **Question dispute/report rate**  | Fast signal for ambiguous or incorrect content.                           |
| **Weekly Quest completion (post-MVP)** | Whether quests create purposeful breadth; free-user completion shows the quest size is fair. |
| **Subscription retention**        | Whether users continue valuing unlimited progression after novelty fades. |

|  |  |
| --- | --- |
|  | Primary product health question<br>Are people returning because they want to level real knowledge - and do they still remember what they learned later? |

# 11. Content Quality & Safety Gates

A wrong fact or ambiguous quiz answer damages trust faster than a minor UI bug. Treat content QA as a production system.

| **Gate**             | **Minimum check**                                                                                          |
|----------------------|------------------------------------------------------------------------------------------------------------|
| **Source coverage**  | Every factual concept has provenance; every media asset has a rights record.                               |
| **Answer integrity** | Exactly one intended answer unless explicitly designed otherwise; rationale is stored.                     |
| **Ambiguity**        | Distractors are clearly wrong under the wording used; time periods and geography are explicit when needed. |
| **Difficulty**       | Levels increase in depth without becoming obscure trivia for its own sake.                                 |
| **Duplication**      | No accidental re-teaching unless it is intentional spaced recall or synthesis.                             |
| **Tone**             | Concise, interesting, adult-friendly, not condescending or school-textbook stiff.                          |
| **Revision**         | Corrections are versioned; prior user progression is preserved.                                            |
| **Reporting**        | Users can flag an issue in two taps and the report preserves card/question IDs.                            |

# 12. What NOT to Build Before Launch

These are attractive distractions. Defer them until the core loop proves itself.

- A social feed, messaging system, clans, or follower counts.

- Complex avatars, equipment, combat animations, currencies, shops, or cosmetic inventory.

- Live AI chat tutoring as a core dependency. It can come later as an optional layer.

- User-generated lessons before moderation and source systems are mature.

- Dozens of subjects. Six broad choices are enough to establish the product.

- A web app, desktop app, and mobile app simultaneously. Nail the mobile experience first.

- Prestige 201-300 before users have meaningfully completed 1-100.

- Weekly Knowledge Quests. They build on a proven loop plus trophies, titles and cosmetics, and must not block launch.

- Leaderboards that reward raw time or speed; they incentivize behavior that conflicts with actual learning.

# 13. Immediate Build Sprint

If development starts now, this is the exact order of work for the first build sprint:

1.  Freeze the six subject names and choose the first 6-10 skill trees.

2.  Fully outline one flagship 1-100 tree before building the app around guesses. Astronomy or Ancient Rome are strong prototypes because they naturally support visuals, chronology, and clear knowledge depth.

3.  Define the content JSON/database schema and stable ID rules.

4.  Create the source registry and rights fields before ingesting media.

5.  Build a tiny internal content generator/editor that can draft one level from approved concepts and sources.

6.  Manually perfect Levels 1-10 of the flagship tree. These become the quality bar and examples for AI generation.

7.  Build the mobile lesson player against those real levels, not placeholder lorem ipsum.

8.  Add completion, XP, skill level, and character sheet.

9.  Add the 5-new-level daily allowance and post-cap review flow.

10. Add review scheduling: first attempts recorded per scheduled review, missed items corrected with their source card.

11. Add subscriptions only after the free loop is satisfying by itself.

12. Alpha test; fix pacing/content issues; then scale the content pipeline instead of hand-writing the remaining hundreds of levels.

|  |  |
| --- | --- |
|  | The first milestone that matters<br>A brand-new tester can install the app, choose a topic, complete five polished levels, see their character improve, hit the daily-complete moment, and want to come back tomorrow. Everything else is secondary until that loop works. |

# 14. Public Launch Checklist

| **Area**          | **Launch gate**                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Curriculum**    | 8-10 complete Level 1-100 trees or a deliberately smaller set with no incomplete released trees. |
| **Content**       | All published concepts source-backed; all questions reviewed; correction workflow live.          |
| **Core loop**     | Onboarding -\> learn -\> 3 quick questions -\> XP -\> level up -\> character sheet is smooth.                 |
| **Daily loop**    | 5 free new levels enforced server-side; review remains useful after cap.                         |
| **Paid**          | Monthly/annual subscription, restore purchases, entitlement sync, graceful billing errors.       |
| **Trust**         | Source/about page, privacy policy, terms, clear media attribution where required.                |
| **Reliability**   | Crash reporting, offline/retry behavior, account recovery, progress sync tested.                 |
| **Accessibility** | Readable text, VoiceOver/TalkBack labels, sufficient contrast, large tap targets.                |
| **Analytics**     | Activation, level completion, cap hits, recall, reports, conversion, retention.                  |
| **Support**       | Simple contact/report flow with content IDs attached automatically.                              |
| **Brand**         | Consistent anti-doomscrolling voice; no manipulative notification or monetization patterns.      |

# 15. Post-Launch Expansion Order

| **Order** | **Expansion**                               | **Why**                                                                          |
|-----------|---------------------------------------------|----------------------------------------------------------------------------------|
| **1**     | Add more complete 1-100 trees               | Breadth without changing the product model.                                      |
| **2**     | Release first 101-200 prestige packs        | Tests whether power users want true depth.                                       |
| **3**     | Improve personalized review                 | Makes mastery more durable as user histories grow.                               |
| **4**     | Titles, rare achievements, profile showcase, earned cosmetics | Strengthens identity without pay-to-win.                       |
| **5**     | Weekly Knowledge Quests                     | Short-term purpose and themed breadth on top of a proven loop and reward system. |
| **6**     | Friends / comparison features, including friend quest progress | Adds social accountability only after solo value is proven. |
| **7**     | Optional AI tutor/explanations              | Useful on-demand depth without making the canonical curriculum nondeterministic. |
| **8**     | Web/desktop surfaces                        | Expand access once content, accounts, and progress are stable.                   |

# 16. Product Decisions Already Made

- The app is an RPG-style knowledge progression system, not a generic trivia app.

- Six broad subjects at launch; avoid overwhelming users with dozens of top-level choices.

- Every released subcategory uses deterministic Level 1-100 progression.

- Progression can continue through 101-200, 201-300, etc., with mastery stars rather than resets.

- Knowledge content is stored and served from our own dataset; the app does not scrape or generate live facts on every swipe.

- Free users receive 5 new levels per day and can review previous knowledge without a daily cap.

- Unlimited is initially positioned at \$4.99/month with a lower effective annual price.

- No ads and no manipulative mobile-game currency systems.

- The app explicitly celebrates stopping: “No more doomscrolling. Go touch grass.”

- A level completes only when every question is correctly resolved; missed questions show their teaching card again. First-attempt accuracy sets the XP; resolution sets progression.

- Weekly Knowledge Quests (post-MVP) count only new levels, are fully completable free, and move to the Chronicle when they end instead of disappearing.

# Appendix A. Source & Licensing References

These references support the content-sourcing strategy. They are not a substitute for legal review of the final product, brand use, attribution, or a specific asset.

**Wikidata Licensing**

> https://www.wikidata.org/wiki/Wikidata:Licensing
>
> Structured data in Wikidata main/property/lexeme namespaces is made available under CC0.

**Wikimedia Foundation - Wikipedia reuse**

> https://wikimediafoundation.org/what-we-do/wikimedia-projects/wikipedia/
>
> Wikipedia text is generally reusable under CC BY-SA subject to the license; individual media can have separate rights.

**Smithsonian Open Access FAQ**

> https://www.si.edu/openaccess/faq
>
> Smithsonian assets explicitly designated CC0 can be reused, including commercially, subject to other possible rights.

**NASA Images and Media Guidelines**

> https://www.nasa.gov/nasa-brand-center/images-and-media/
>
> NASA content is generally not subject to U.S. copyright, with important branding, endorsement, people, and third-party exceptions.

|  |  |
| --- | --- |
|  | Build mantra<br>Make the first 100 levels so good that a user is proud to finish them. Then scale the machine that made them. |

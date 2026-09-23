# Product rules (Stage 0: frozen)

This file is authoritative. Every screen, migration, test and content tool depends on it. Changing a rule means updating this file, `packages/core/src/constants.ts` and the backend migration (`app_settings` and SQL helpers) **in the same change**.

## The product in one sentence

A social-media-shaped learning app where users level up real knowledge like an RPG character, with finite, source-backed Level 1–100 skill trees instead of an endless feed.

## Frozen rules

1. **A released skill is a deterministic, ordered sequence of levels.** Levels are cleared in order; you can't skip ahead.
2. **The base mastery band is Levels 1–100.** Level 100 is a meaningful mastery checkpoint (★ Mastery I).
3. **Prestige continues upward** (101–200 = ★★ at 200, and so on). It adds a star and deeper material, and it never deletes, resets or devalues earlier progress.
4. **BrainScroll is a learning app, not a quiz app.** A level is a 2–5 minute learning encounter: read or discover something interesting, understand it, answer a few light questions, gain XP, continue. **Questions support the learning. They are not the product.** A standard level has **3 questions**, and testing only grows at milestones (see *Level types* below).
5. **Free accounts may complete 5 NEW levels per local calendar day.** Review, replays, the character sheet and skill browsing never consume the allowance.
   - *Launch experiment:* on a user's first local day the cap is 10 (`FIRST_DAY_NEW_LEVELS`).
   - The local day is computed **server-side** from the profile's IANA time zone, never from the device clock.
6. **Progress is earned by completion and recall.** Passive scrolling never awards XP or levels.
7. **Published knowledge is pre-generated, source-backed, versioned** and served from our own data.
8. **User progress references stable level/concept IDs** and survives editorial revisions. A revision never moves progress backwards.
9. **No ads, hearts, lives, energy, gems, loot boxes, purchasable XP, or paywalled subjects.**
10. **Unlimited removes the daily new-level cap. That is all it does.** There's no exclusive curriculum, no exclusive quests and no premium XP. Level 50 means the same thing for free and paid users. *Pay for freedom, not knowledge.*

## Definitions

| Term | Meaning |
| --- | --- |
| **Level type** | `regular`, `checkpoint`, `milestone` or `mastery`, derived from the level number. It sets the expected question count and learning structure. |
| **New level** | The next canonical level in a skill that the user has never completed. Completing one consumes 1 daily allowance. |
| **Completion** | A single server transaction (`complete_level`) that validates eligibility, grades every answer, writes XP events, advances the skill, updates concept mastery and the review queue, and increments the daily allowance, **exactly once per canonical level**. |
| **Replay** | Re-opening a cleared level. It is always allowed, costs no allowance, and awards nothing. |
| **Review** | Recall of concepts from completed levels, scheduled by concept strength. It is unlimited and never consumes allowance. A bad review never lowers a skill level. |
| **Skill level** | The highest canonical level cleared in that skill. It is **never** derived from XP. |
| **Mastery** | Clearing level 100·k awards star *k* and `MASTERY_CLEAR` XP. |
| **Knowledge Level** | Derived overall stat: `1 + floor(sqrt(4 × total levels cleared))`. Tunable, but always sublinear. |
| **Daily Knowledge Complete** | What the user sees when they ask for a 6th new level. It's a celebration, not an error. (Post-MVP, it also shows active Weekly Quest progress.) |
| **Weekly Knowledge Quest** | Post-MVP. A themed objective of ~25 **new** levels across 5 related skills, then a 3-question Final Encounter. It's finishable free in about five learning days, and archived to the Chronicle when its week ends. See [`social-expansion.md`](social-expansion.md#weekly-knowledge-quests). |

## Level types (how much testing, and when)

Testing is proportional to the moment. The type comes from the level number (`levelTypeFor()` in `packages/core/src/progression.ts`). Its structure is defined once, in `LEARNING_STRUCTURE` in `packages/core/src/constants.ts`, and the content validator enforces it.

| Type | Which levels | Shape | Questions |
| --- | --- | --- | --- |
| **Regular** | Almost all of them | Hook → 2–4 short learning cards (~100–250 words) → questions → level complete | **3**: recall, understanding, connection |
| **Checkpoint** | Every 10th level | Still teaches, then a slightly longer check across the chapter | ~5 |
| **Milestone** | Level 50 (150, 250 …) | A bigger synthesis moment | 5–7 |
| **Mastery Challenge** | Level 100 (200, 300 …) | The fullest test in a tree; passing earns ★ | ~10 |
| **Review** | Not a level | Spaced repetition; one question per concept due | Varies, up to 10 per session |

The three questions in a regular level each have a job:
- **Recall:** did the learner absorb the core fact or idea?
- **Understanding:** do they get why it happened, how it works, or why it matters?
- **Connection:** can they link it to another concept, event, system or idea (often from an earlier level)?

A ten-question assessment is a special milestone experience, never the normal learning loop.

## Completing a level: first attempt → reinforcement → resolution → progression

> **Learning is the product. Questions prove and reinforce understanding.** BrainScroll doesn't punish forgetting: it shows the evidence and teaches it again, right away. A level isn't complete until every question has been answered correctly. **First-attempt retention sets the reward; eventual correction sets progression.** Strong knowledge earns more XP. Mistakes earn more teaching.

1. **Learn:** the hook and 2–4 learning cards.
2. **First attempt:** each question's first answer is recorded **once, on the server, and never replaced**. Restarting the level can't improve it.
3. **Reinforce:** after a wrong answer the question stays on screen. Beneath it comes **"Take another look"**, showing the question's source cards (`sourceCardIds`), the canonical content that teaches the answer, never generated at runtime. The options stay open (wrong picks are crossed out) until the right one is chosen. There's no failure screen, no restart, no lives and no waiting.
4. **Resolve:** every question must end correctly answered. `complete_level` refuses otherwise (`UNRESOLVED_QUESTIONS`).
5. **Progress:** the level completes, the skill advances (Lv. 18 → 19), and it counts as one new level toward the daily 5, whatever the score.

**XP by first-attempt accuracy (regular levels):**

| First try | Outcome | XP |
| --- | --- | --- |
| 3 / 3 | **Perfect Recall** (a slightly bigger celebration) | 100 |
| 2 / 3 | Strong | 70 |
| 1 / 3 | Reinforced | 35 |
| 0 / 3 | Heavily reinforced | 15 |

Corrections never restore XP (1/3 then two corrections is still 35), XP is never negative, and replays award nothing. The curve lives in `LEARNING_STRUCTURE[type].firstAttemptXp` and in `level_xp_curve` in SQL. Checkpoint, milestone and mastery levels use the same bands **provisionally**, by share of questions, until their own rules are decided.

**Review priority from first attempts:** right first time → normal interval. Missed once → strength 0, due soon, priority 1. Missed repeatedly (3+ tries) → due now, priority 2. Review serves higher priority first; a correct review clears it. *"You learned this with help. We'll check it again sooner."*

**Words to use:** Level Complete, Perfect Recall, Take another look, Quick refresher, Reinforced, We'll bring this back later. **Never:** pass, fail, passing score, failed lesson, exam result.

## Stable IDs

Machine IDs are lowercase `snake_case` segments separated by dots. Display names can change freely; IDs never change.

| Object | Format | Example |
| --- | --- | --- |
| Subject | `subject.<subject>` | `subject.science` |
| Skill | `skill.<subject>.<skill>` | `skill.science.astronomy` |
| Level | `level.<subject>.<skill>.<NNN>` (3+ digits) | `level.science.astronomy.001` |
| Revision | `<level id>@r<n>` | `level.science.astronomy.001@r3` |
| Concept | `concept.<skill>.<name>` | `concept.astronomy.light_year` |
| Card | `card.<skill>.<NNN>.c<n>` | `card.astronomy.001.c2` |
| Question | `question.<skill>.<NNN>.q<n>` | `question.astronomy.001.q2` |
| Source | `source.<name>` | `source.nasa_sun_facts` |
| Asset | `asset.<name>` | `asset.milky_way_diagram` |

The patterns live in `packages/core/src/ids.ts` and as `CHECK` constraints in the migration.

## XP (an immutable ledger)

| Event | XP | Guardrail |
| --- | --- | --- |
| `LEVEL_COMPLETE` | 100 / 70 / 35 / 15 | Once per canonical level, ever. The amount comes from first-attempt accuracy; corrections add nothing |
| `QUESTION_CORRECT` | retired | The old per-answer bonus. Kept only for historical rows |
| `DELAYED_RECALL` | 5 | Only a correct review after ≥ 20 h (Stage 5) |
| `MASTERY_CLEAR` | 250 | Levels 100, 200, … |
| `CORRECTION` | ± | Admin-only, with an audited reason |
| `QUEST_COMPLETE` (post-MVP) | 50 / 75 / 100 (tunable) | Once per quest per user (Standard / Epic / Legendary). Quest *progress* is read from `LEVEL_COMPLETE` events, never counted separately |

A regular level answered perfectly on the first try awards **+100 XP**. **Nothing dwarfs a level:** no single award should outweigh a few levels of real learning. One `LEVEL_COMPLETE` event feeds account XP, the weekly friend leaderboard, skill progression, Weekly Quest progress and achievements; there is no second XP calculation.

## Review scheduling (V1: deliberately simple)

Concept strength runs from 0 to 5. A correct answer adds one step and a wrong answer resets to 0. The due intervals by strength are: 10 min, 1 day, 3 days, 7 days, 21 days, 60 days.

## Pricing (launch hypotheses)

$4.99/month, $39.99/year, one entitlement: `unlimited_learning`. The paywall only appears at 5/5 or when the user explicitly asks for a 6th new level. **It never interrupts a lesson.** Always say it plainly: *"All knowledge can be unlocked free over time."*

## Weekly Knowledge Quests (post-MVP)

These are the guardrails. The design lives in [`social-expansion.md`](social-expansion.md#weekly-knowledge-quests).

- **Only new levels count.** Existing levels never auto-complete a quest, and replays and reviews never count.
- **One source of truth.** Quest progress is derived from `LEVEL_COMPLETE` events in the XP ledger. It is never a separate counter.
- **Free-completable.** A standard quest (~25 levels) fits in about five free learning days. Unlimited only lets you finish faster.
- **No FOMO.** Ended quests move to the Chronicle with the same rewards. A live clear earns only a subtle dated mark.
- **Learning first.** The Final Encounter is 3 synthesis questions and uses no daily level. Quests are never 20-question exams.
- **Nothing dwarfs a level.** The quest bonus is small (+50 standard, +75 Epic, +100 Legendary: at most one level's worth), never moves a skill level, and counts on the friend leaderboard once like any other event.
- **Only resolved levels count.** Quest progress comes from `LEVEL_COMPLETE`, which exists only after every question is correctly resolved. Opening or swiping through levels counts for nothing.
- **Overlap.** A new level counts toward every active quest that needs its skill. At most one Chronicle quest is active at a time.
- **Rarity** is the share of all active learners who earned a trophy, shown only once there's enough data to be honest.
- **Quests never block the core MVP.**

## Never build (before launch)

The post-MVP [Social + Rewards expansion](social-expansion.md) later adds friends-only weekly leaderboards, challenges and trophies, under its own guardrails. Everything below stays out of the core loop.


Social feeds, followers, clans, messaging · leaderboards that reward time or speed · avatars, equipment, currencies, shops · live AI tutor as a core dependency · user-generated lessons · web/desktop learning clients · 201–300 prestige content · recommendation ML · custom billing · microservices · streak punishment or fake urgency.

## Metrics we optimize

Level 1 completion, daily 5/5 completion, D1/D7/D30 return among users who cleared a level, review participation, delayed-recall accuracy, tree completion, content report rate, and conversion after a *natural* cap hit. **Session length is diagnostic, never the goal.**

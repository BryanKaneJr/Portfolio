# Social + Rewards expansion (post-MVP)

This summarizes [`source/Social_Rewards_Expansion_Spec.docx`](source/Social_Rewards_Expansion_Spec.docx) and maps it onto what already exists. **Nothing here starts until the core loop is stable.** That means authored levels, progression, review, the daily cap and subscriptions.

This expansion also carries **Weekly Knowledge Quests**, the recurring short-term objective for a learner's build. See [Weekly Knowledge Quests](#weekly-knowledge-quests) below.

> **Principle:** make accumulated knowledge social, collectible and prestigious, without coins, pay-to-win or fear-based engagement. *Don't reward people for staying. Reward them for becoming more knowledgeable.*

## What it adds

| System | Rule |
| --- | --- |
| Currency | **None.** XP is progression; knowledge is the asset. There are no coins, gems, crates, gifting or paid boosts. |
| Profile | Username → Knowledge Level → equipped title → three rarest trophies → skill levels with ★ → full trophy room → other stats. Weekly Quest trophies compete for the top three like any other. |
| Trophies | Permanent and never lost to inactivity. Tiers come from **real** earn rates: Common 25%+, Uncommon 10–25%, Rare 3–10%, Epic 0.5–3%, Legendary <0.5%. Rarity is recalculated by a scheduled job, and the showcase refreshes at most daily. |
| Ranks | Student at Lv 10, Scholar at 25, Specialist at 50, Expert at 75. Mastery ★ at 100, ★★ at 200 and ★★★ at 300. |
| Titles | Identity rewards unlocked by combinations, e.g. *The Astronomer* (Astronomy Lv 100) or *Polymath* (mastery in 5 skill families). |
| Friends | Mutual requests only, found by exact username or invite link. Friend-only visibility by default. **Block and report ship with friends.** There are no DMs, comments, posts or feed. |
| Leaderboard | Friends-only and reset weekly. Scores come server-side from verified Knowledge XP only: no review farming, no purchase multiplier, and **no Weekly Quest bonus XP** (the quest's own levels already score). |
| Challenges | An asynchronous 5-question duel. Both players get the same versioned set, drawn **only from concepts both have unlocked** (no gotcha duels). Answers are sealed, and there's a small XP bonus that can't be farmed. |
| Weekly Quests | ~25 new levels across 5 related skills, then a 3-question Final Encounter. They award a trophy, a title, a cosmetic and bonus XP, are finishable free, and are archived to the **Chronicle** rather than lost. See below. |
| Cosmetics | Earned from accomplishments (frames, backgrounds, nameplates, emblem variants, and quest emblems or ornaments). Paid themes, if they ever exist, may **never** imitate mastery, rarity or rank. |
| Streaks | A quiet stat only. Permanent 7/30/100/365-day trophies, no loss-framed messaging, and "Welcome back. Your levels are right where you left them." |
| Notifications | About outcomes ("Mike challenged you in Roman History"), never anxiety ("Your friends are passing you!"). |

## Build order (from the spec)

| Phase | Build | Exit gate | Where we are |
| --- | --- | --- | --- |
| 0 | Prerequisite audit | Core progress events are server-validated; account identity and analytics are stable | 🟡 server validation ✅; **account linking, usernames, subscriptions, analytics missing** |
| 1 | Reward event ledger | Retries can't double-award XP; every reward event is auditable | 🟡 largely exists as `xp_events` (unique idempotency key per user, tested). Missing: `CONCEPT_RECALLED`, `SKILL_MASTERED`, `PRESTIGE_REACHED` and challenge event types |
| 2 | Achievement engine | A trophy unlocks from real criteria, permanently; the rarity job is deterministic | ⬜ |
| 3 | Profile v2 | Renders with 0, 1 or hundreds of trophies; rarest-three is deterministic | ⬜ (the Profile tab is a basic character sheet today) |
| 4 | Earned cosmetics | Can't equip without ownership; paid themes can't impersonate mastery | ⬜ (moved ahead of friends because quests award cosmetics) |
| 5 | **Weekly Knowledge Quests** | Progress only from verified new-level events inside the quest window; existing levels, replays and reviews never count; free users finish a standard quest in ~5 learning days; archived quests award the same rewards | ⬜ |
| 6 | Friend graph | Request/accept/remove/block/report work; privacy can't be bypassed client-side | ⬜ |
| 7 | Friend profiles | Inspect a build quickly without exposing hidden data | ⬜ |
| 8 | Weekly friend leaderboard | Time-zone-safe reset; can't be farmed via reviews, purchases or quest bonuses | ⬜ |
| 9 | Friend challenges | Identical versioned questions; eligibility prevents unseen-content duels | ⬜ |
| 10 | Quest friend integration | Friend quest progress within privacy settings; no pressure copy | ⬜ |
| 11 | Weekly recap | Knowledge gains and quest progress first, social rank second | ⬜ |
| 12 | Tuning | XP weights, trophy thresholds, quest sizes, notification frequency | ⬜ |

Rules from the spec: no Weekly Quests until the ledger, trophies, titles, profile and cosmetics work, and quests never block the core MVP; no leaderboards until the friend graph works; no challenges until friendships and canonical progress are trustworthy; no cosmetics until trophies and titles make the profile worth visiting.

## Weekly Knowledge Quests

Permanent skill trees answer *"What kind of knowledgeable person am I becoming?"* Weekly Knowledge Quests answer *"What am I building toward this week?"* It's BrainScroll's version of a quest or boss encounter, with no combat, enemies, health bars, swords or parchment. The challenge is building the knowledge.

| Rule | Detail |
| --- | --- |
| Standard quest | ~25 **new** levels, usually 5 related skills × 5. For example, *The Roman World*: Roman History, European Geography, Art & Architecture, Government & Society, Mythology & Religion. |
| What counts | Only new canonical levels completed while the quest is active. Roman History Lv. 180 doesn't complete it; five new Roman History levels do. Replays and reviews never count. Existing knowledge may later earn secondary recognition, never a skip. |
| Final Encounter | Unlocks at 25/25: **3 synthesis questions** connecting the week's subjects. It's a short capstone, not an exam, and it doesn't use a daily level. Completing it awards the rewards. |
| Rewards | Trophy (*The Roman World*), title (*Citizen of Rome*), earned cosmetic (*Marble Laurel*), bonus XP (+1,000, tunable). Also possible: backgrounds, frames, ornaments, emblem variants, mastery effects, set progress. **No coins, gems, loot boxes or store.** |
| Free tier | 5 new levels a day means a standard quest takes about **5 learning days**, finishable free every week. Choosing where each day's five levels go (your Astronomy build or the quest's Art requirement) is the intended RPG decision. |
| Unlimited | Removes only the daily cap: finish faster, or keep other skills moving the same week. No exclusive quests, knowledge, stats or rewards. *Pay for freedom, not knowledge.* |
| Tiers | Standard ~25 (weekly); Epic ~35 (occasional, still free-possible across 7 days); Legendary 50+ (rare, optional, may be a long-term goal). Difficulty is never Premium-only. |
| No FOMO | Ended quests move to **the Chronicle** and stay completable with the same knowledge, trophy, title and primary cosmetic. A live-week clear gets only a subtle mark ("Live Clear — Week 39, 2026"). Never "You missed this forever." |
| Daily cap screen | *Daily Knowledge Complete* shows active-quest progress: 14 / 25 overall, x / 5 per skill, levels remaining, and "Come back tomorrow and keep building." Unlimited appears as an optional way to keep going. |
| Friends | A plain progress list (Mike 25/25 ✓, Sarah 19/25, You 14/25). Never "Mike is beating you!" Group quests are a later Parties candidate. |
| Visuals | One central emblem per quest that illuminates as requirements complete, five 0/5 rows, 0/25 overall, a reward preview and a locked Final Encounter. Gold and glow stay scarce. See [`visual-direction.md`](visual-direction.md). |

**Themes** combine five related trees: The Roman World, The Moon Landing, Age of Dinosaurs, The Renaissance, Age of Exploration, The Atomic Age, and later conceptual quests (Survive on Mars, Build a Civilization). The catalog should reach hundreds of combinations.

**Data model** (data-driven, not hard-coded; names follow our snake_case SQL / camelCase TS conventions):

| Table | Fields |
| --- | --- |
| `quests` | `id` (e.g. `quest.roman_world`), `title`, `subtitle`, `description`, `visual_key`, `tier` (`standard`/`epic`/`legendary`), `starts_at`, `featured_until`, `archive_available`, `final_encounter` (3 question IDs), `reward_trophy_id`, `reward_title_id`, `reward_cosmetic_ids`, `xp_reward` |
| `quest_requirements` | `quest_id`, `skill_id`, `new_levels_required` |
| `user_quests` | `user_id`, `quest_id`, `started_at` (the quest start for the live week; the moment the user starts it from the Chronicle otherwise), `final_encounter_passed_at`, `live_clear`, `completed_at` |

Per-requirement progress is **computed, not stored**: count `xp_events` of type `LEVEL_COMPLETE` for the requirement's `skill_id` created since `user_quests.started_at`. There's no second counter. The completion reward writes one `QUEST_COMPLETE` ledger event, plus trophy, title and cosmetic grants, and it's exactly-once via the idempotency key `quest_complete:<quest_id>`.

## Fit with what's built

- **The ledger already exists.** `xp_events` is immutable, keyed by `(user_id, idempotency_key)`, and written only by server functions. The e2e suite proves a double-tapped completion awards XP once. Phase 1 is mostly adding event types, not a new system. The spec calls the table `reward_events`; renaming isn't worth it.
- **Delayed-recall XP is already anti-farm.** It pays once per concept per review cycle, and only after a 20-hour gap. That's what the leaderboard rule "no infinite review farming" needs.
- **XP never moves skill levels.** Levels come from canonical completions, so challenge or recall XP can feed leaderboards without distorting "Level 63 means something."
- **Concept mastery data exists** (`user_concept_mastery`: seen/correct/strength). Challenge eligibility ("concepts both have unlocked") and trophies like *Thousand Strong* or *Wrong Turn* can be computed from it.
- **Quest progress needs no new counting.** Every first completion already writes one `LEVEL_COMPLETE` row to `xp_events` with `skill_id` and `created_at`, and only once per canonical level. So "new levels in skill X since the quest started" is a single query over the existing ledger, and replays already produce no event.
- **Concept-level question pools exist** (`question_concepts`), which is what a fixed 5-question challenge set draws from.

## Gaps and decisions to make

1. **Accounts come first.** Players are anonymous today. Friends need persistent identity plus a **unique username**, so account linking (email/Apple/Google) and a username table are prerequisites. This makes account linking the next core task either way.
2. **Premium themes vs. "Unlimited only removes the cap".** The spec says premium *may eventually* offer neutral themes or extra customization slots. [`product-rules.md`](product-rules.md) rule 10 currently says Unlimited removes the cap and nothing else. **This needs a product decision.** Until it's made, rule 10 stands.
3. **Challenge XP.** "Small verified XP bonus" needs a number and a cap (e.g. per-day or per-opponent) before Phase 7.
4. **"Oddities" trophies** (*Night Owl*, *Rabbit Hole*) arguably fail the spec's own reward test ("what did you learn / how deeply / how consistently / what difficult combination"). *Wrong Turn* passes because it's about eventually mastering a concept. Decide per trophy.
5. **Underage users.** The spec asks for a policy review before any public discovery. That needs deciding before friends ship, not after.
6. **Weekly Quest decisions.**
   - **Leaderboard:** I've defaulted to excluding quest bonus XP from the weekly friend leaderboard (+1,000 would dwarf ~26 XP per level and invite archived-quest farming).
   - **Overlap:** can a level count toward the live quest and an active Chronicle quest at once, and how many Chronicle quests can be active?
   - **Content:** do Final Encounter questions live in the quest definition (new content type) or reuse approved questions from the requirement skills?
   - **Rarity:** is the rarity population "all active learners" or "learners who started the quest"?
7. **Quest content depth.** A quest can only use skills with enough published levels for every learner to make +5 new progress. A learner near the end of a published tree can't. Early quests must be built from launch trees, and most example themes (Mythology, Government, Engineering) need trees that don't exist yet.
8. **Rank names vs. titles.** Ranks (Student → Expert) are per-skill and automatic; titles are chosen. The Profile UI needs to keep them visually distinct.

## Explicitly deferred

Group/party Weekly Quests (first release is solo + friend progress only), global public leaderboards, DMs, public posts/comments, clans/guilds, coin/gem economy, gifting/trading, random loot/crates, and paid XP boosts. If groups ever come, the spec's candidate is private **Parties** (families, classrooms, teams), and only after 1:1 friends are healthy.

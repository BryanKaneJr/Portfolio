# Social + Rewards expansion (post-MVP)

This summarizes [`source/Social_Rewards_Expansion_Spec.docx`](source/Social_Rewards_Expansion_Spec.docx) and maps it onto what already exists. **Nothing here starts until the core loop is stable.** That means authored levels, progression, review, the daily cap and subscriptions.

> **Principle:** make accumulated knowledge social, collectible and prestigious, without coins, pay-to-win or fear-based engagement. *Don't reward people for staying. Reward them for becoming more knowledgeable.*

## What it adds

| System | Rule |
| --- | --- |
| Currency | **None.** XP is progression; knowledge is the asset. There are no coins, gems, crates, gifting or paid boosts. |
| Profile | Three rarest trophies first, then top skills (exact levels + ★), then stats, then the full trophy room. One equipped title. |
| Trophies | Permanent and never lost to inactivity. Tiers come from **real** earn rates: Common 25%+, Uncommon 10–25%, Rare 3–10%, Epic 0.5–3%, Legendary <0.5%. Rarity is recalculated by a scheduled job, and the showcase refreshes at most daily. |
| Ranks | Student at Lv 10, Scholar at 25, Specialist at 50, Expert at 75. Mastery ★ at 100, ★★ at 200 and ★★★ at 300. |
| Titles | Identity rewards unlocked by combinations, e.g. *The Astronomer* (Astronomy Lv 100) or *Polymath* (mastery in 5 skill families). |
| Friends | Mutual requests only, found by exact username or invite link. Friend-only visibility by default. **Block and report ship with friends.** There are no DMs, comments, posts or feed. |
| Leaderboard | Friends-only and reset weekly. Scores come server-side from verified Knowledge XP only: no review farming, no purchase multiplier. |
| Challenges | An asynchronous 5-question duel. Both players get the same versioned set, drawn **only from concepts both have unlocked** (no gotcha duels). Answers are sealed, and there's a small XP bonus that can't be farmed. |
| Cosmetics | Earned from accomplishments (frames, backgrounds, nameplates, emblem variants). Paid themes, if they ever exist, may **never** imitate mastery, rarity or rank. |
| Streaks | A quiet stat only. Permanent 7/30/100/365-day trophies, no loss-framed messaging, and "Welcome back. Your levels are right where you left them." |
| Notifications | About outcomes ("Mike challenged you in Roman History"), never anxiety ("Your friends are passing you!"). |

## Build order (from the spec)

| Phase | Build | Exit gate | Where we are |
| --- | --- | --- | --- |
| 0 | Prerequisite audit | Core progress events are server-validated; account identity and analytics are stable | 🟡 server validation ✅; **account linking, usernames, subscriptions, analytics missing** |
| 1 | Reward event ledger | Retries can't double-award XP; every reward event is auditable | 🟡 largely exists as `xp_events` (unique idempotency key per user, tested). Missing: `CONCEPT_RECALLED`, `SKILL_MASTERED`, `PRESTIGE_REACHED` and challenge event types |
| 2 | Achievement engine | A trophy unlocks from real criteria, permanently; the rarity job is deterministic | ⬜ |
| 3 | Profile v2 | Renders with 0, 1 or hundreds of trophies; rarest-three is deterministic | ⬜ (the Profile tab is a basic character sheet today) |
| 4 | Friend graph | Request/accept/remove/block/report work; privacy can't be bypassed client-side | ⬜ |
| 5 | Friend profiles | Inspect a build quickly without exposing hidden data | ⬜ |
| 6 | Weekly friend leaderboard | Time-zone-safe reset; can't be farmed via reviews or purchases | ⬜ |
| 7 | Friend challenges | Identical versioned questions; eligibility prevents unseen-content duels | ⬜ |
| 8 | Earned cosmetics | Can't equip without ownership; paid themes can't impersonate mastery | ⬜ |
| 9 | Weekly recap | Knowledge gains first, social rank second | ⬜ |
| 10 | Tuning | XP weights, trophy thresholds, notification frequency | ⬜ |

Rules from the spec: no leaderboards until Phases 1–4 work end to end; no challenges until friendships and canonical progress are trustworthy; no cosmetics until trophies and titles make the profile worth visiting.

## Fit with what's built

- **The ledger already exists.** `xp_events` is immutable, keyed by `(user_id, idempotency_key)`, and written only by server functions. The e2e suite proves a double-tapped completion awards XP once. Phase 1 is mostly adding event types, not a new system. The spec calls the table `reward_events`; renaming isn't worth it.
- **Delayed-recall XP is already anti-farm.** It pays once per concept per review cycle, and only after a 20-hour gap. That's what the leaderboard rule "no infinite review farming" needs.
- **XP never moves skill levels.** Levels come from canonical completions, so challenge or recall XP can feed leaderboards without distorting "Level 63 means something."
- **Concept mastery data exists** (`user_concept_mastery`: seen/correct/strength). Challenge eligibility ("concepts both have unlocked") and trophies like *Thousand Strong* or *Wrong Turn* can be computed from it.
- **Concept-level question pools exist** (`question_concepts`), which is what a fixed 5-question challenge set draws from.

## Gaps and decisions to make

1. **Accounts come first.** Players are anonymous today. Friends need persistent identity plus a **unique username**, so account linking (email/Apple/Google) and a username table are prerequisites. This makes account linking the next core task either way.
2. **Premium themes vs. "Unlimited only removes the cap".** The spec says premium *may eventually* offer neutral themes or extra customization slots. [`product-rules.md`](product-rules.md) rule 10 currently says Unlimited removes the cap and nothing else. **This needs a product decision.** Until it's made, rule 10 stands.
3. **Challenge XP.** "Small verified XP bonus" needs a number and a cap (e.g. per-day or per-opponent) before Phase 7.
4. **"Oddities" trophies** (*Night Owl*, *Rabbit Hole*) arguably fail the spec's own reward test ("what did you learn / how deeply / how consistently / what difficult combination"). *Wrong Turn* passes because it's about eventually mastering a concept. Decide per trophy.
5. **Underage users.** The spec asks for a policy review before any public discovery. That needs deciding before friends ship, not after.
6. **Rank names vs. titles.** Ranks (Student → Expert) are per-skill and automatic; titles are chosen. The Profile UI needs to keep them visually distinct.

## Explicitly deferred

Global public leaderboards, DMs, public posts/comments, clans/guilds, coin/gem economy, gifting/trading, random loot/crates, and paid XP boosts. If groups ever come, the spec's candidate is private **Parties** (families, classrooms, teams), and only after 1:1 friends are healthy.

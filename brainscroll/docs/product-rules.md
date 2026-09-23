# Product rules (Stage 0: frozen)

This file is authoritative. Every screen, migration, test and content tool depends on it. Changing a rule means updating this file, `packages/core/src/constants.ts` and the backend migration (`app_settings` and SQL helpers) **in the same change**.

## The product in one sentence

A social-media-shaped learning app where users level up real knowledge like an RPG character, with finite, source-backed Level 1–100 skill trees instead of an endless feed.

## Frozen rules

1. **A released skill is a deterministic, ordered sequence of levels.** Levels are cleared in order; you can't skip ahead.
2. **The base mastery band is Levels 1–100.** Level 100 is a meaningful mastery checkpoint (★ Mastery I).
3. **Prestige continues upward** (101–200 = ★★ at 200, and so on). It adds a star and deeper material, and it never deletes, resets or devalues earlier progress.
4. **A level is a small learning encounter** of cards and questions (usually 4–7 cards, 2–5 minutes), not a single trivia fact.
5. **Free accounts may complete 5 NEW levels per local calendar day.** Review, replays, the character sheet and skill browsing never consume the allowance.
   - *Launch experiment:* on a user's first local day the cap is 10 (`FIRST_DAY_NEW_LEVELS`).
   - The local day is computed **server-side** from the profile's IANA time zone, never from the device clock.
6. **Progress is earned by completion and recall.** Passive scrolling never awards XP or levels.
7. **Published knowledge is pre-generated, source-backed, versioned** and served from our own data.
8. **User progress references stable level/concept IDs** and survives editorial revisions. A revision never moves progress backwards.
9. **No ads, hearts, lives, energy, gems, loot boxes, purchasable XP, or paywalled subjects.**
10. **Unlimited removes the daily new-level cap. That is all it does.** There's no exclusive curriculum and no premium XP. Level 50 means the same thing for free and paid users.

## Definitions

| Term | Meaning |
| --- | --- |
| **New level** | The next canonical level in a skill that the user has never completed. Completing one consumes 1 daily allowance. |
| **Completion** | A single server transaction (`complete_level`) that validates eligibility, grades every answer, writes XP events, advances the skill, updates concept mastery and the review queue, and increments the daily allowance, **exactly once per canonical level**. |
| **Replay** | Re-opening a cleared level. It is always allowed, costs no allowance, and awards nothing. |
| **Review** | Recall of concepts from completed levels, scheduled by concept strength. It is unlimited and never consumes allowance. A bad review never lowers a skill level. |
| **Skill level** | The highest canonical level cleared in that skill. It is **never** derived from XP. |
| **Mastery** | Clearing level 100·k awards star *k* and `MASTERY_CLEAR` XP. |
| **Knowledge Level** | Derived overall stat: `1 + floor(sqrt(4 × total levels cleared))`. Tunable, but always sublinear. |
| **Daily Complete** | What the user sees when they ask for a 6th new level. It's a celebration, not an error. |

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
| `LEVEL_COMPLETE` | 20 | Once per canonical level, ever |
| `QUESTION_CORRECT` | 2 per correct answer | Capped at 6 per level, so guessing never pays |
| `DELAYED_RECALL` | 5 | Only a correct review after ≥ 20 h (Stage 5) |
| `MASTERY_CLEAR` | 250 | Levels 100, 200, … |
| `CORRECTION` | ± | Admin-only, with an audited reason |

A typical level with 2 correct answers awards **+24 XP**.

## Review scheduling (V1: deliberately simple)

Concept strength runs from 0 to 5. A correct answer adds one step and a wrong answer resets to 0. The due intervals by strength are: 10 min, 1 day, 3 days, 7 days, 21 days, 60 days.

## Pricing (launch hypotheses)

$4.99/month, $39.99/year, one entitlement: `unlimited_learning`. The paywall only appears at 5/5 or when the user explicitly asks for a 6th new level. **It never interrupts a lesson.** Always say it plainly: *"All knowledge can be unlocked free over time."*

## Never build (before launch)

The post-MVP [Social + Rewards expansion](social-expansion.md) later adds friends-only weekly leaderboards, challenges and trophies, under its own guardrails. Everything below stays out of the core loop.


Social feeds, followers, clans, messaging · leaderboards that reward time or speed · avatars, equipment, currencies, shops · live AI tutor as a core dependency · user-generated lessons · web/desktop learning clients · 201–300 prestige content · recommendation ML · custom billing · microservices · streak punishment or fake urgency.

## Metrics we optimize

Level 1 completion, daily 5/5 completion, D1/D7/D30 return among users who cleared a level, review participation, delayed-recall accuracy, tree completion, content report rate, and conversion after a *natural* cap hit. **Session length is diagnostic, never the goal.**

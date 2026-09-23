# BrainScroll — Current Product Decisions

This file records product decisions made after parts of the converted DOCX specifications were authored. Until these items are merged into the active specs, this file overrides conflicting older wording.

## 1. Learning first, testing second

BrainScroll is a learning app, not a quiz app. A normal level should feel like a short, interesting learning encounter followed by lightweight checks that reinforce the material.

Typical normal level:

- 2–4 short learning/reading cards.
- Roughly 100–250 words total, depending on topic.
- Optional image, map, timeline, diagram, comparison, or connection card.
- 3 questions.
- Roughly 2–5 minutes total.

The normal three questions should generally cover:

1. **Recall** — did the learner retain the core fact or idea?
2. **Understanding** — do they understand why it happened, how it works, or why it matters?
3. **Connection** — can they connect it to another concept, event, system, or previously learned idea?

## 2. Canonical encounter question counts

These counts are locked:

| Encounter | Questions |
|---|---:|
| Regular level | 3 |
| 10-level checkpoint | 5 |
| Level 50 milestone | 7 |
| Level 100 mastery challenge | 10 |
| Review | Variable, based on due concepts |

The UI does not need to advertise the count. These are content/product rules.

## 3. Wrong answers teach; they do not create failure loops

Every question in a normal level must eventually be correctly resolved before the level completes.

If a learner answers incorrectly:

1. Keep the question in context.
2. Show the specific learning card / verified evidence that supports the answer directly beneath it.
3. Let the learner skim the material.
4. Present the choices again.
5. Require the learner to select the correct answer.

Do not restart the whole lesson. Do not use hearts, lives, negative XP, or a traditional fail screen.

Core rule:

> First-attempt retention determines reward quality. Correct resolution determines progression.

## 4. Regular-level XP: first attempt only

The first-attempt score determines the XP award. Correcting missed answers is required for completion but does not restore lost XP.

| First-attempt result | XP |
|---|---:|
| 3 / 3 | 100 XP |
| 2 / 3 | 70 XP |
| 1 / 3 | 35 XP |
| 0 / 3 | 15 XP |

Additional rules:

- Primary level XP is awarded only once.
- Replaying a completed level cannot farm leaderboard XP.
- The first-attempt result is immutable for that completion.
- Correction attempts award no extra XP.
- Missed concepts receive earlier/higher-priority review scheduling.

## 5. Checkpoint / milestone / mastery XP

Use separate configurable bands rather than scaling normal-level XP linearly.

### 5-question checkpoint — max 150 XP

| First-attempt result | XP |
|---|---:|
| 5 / 5 | 150 |
| 4 / 5 | 105 |
| 3 / 5 | 60 |
| 0–2 / 5 | 25 |

### Level 50 milestone — 7 questions, max 250 XP

| First-attempt result | XP |
|---|---:|
| 7 / 7 | 250 |
| 6 / 7 | 175 |
| 4–5 / 7 | 90 |
| 0–3 / 7 | 40 |

### Level 100 mastery — 10 questions, max 500 XP

| First-attempt result | XP |
|---|---:|
| 10 / 10 | 500 |
| 8–9 / 10 | 350 |
| 5–7 / 10 | 175 |
| 0–4 / 10 | 75 |

All missed questions still require evidence-based correction before the encounter resolves.

## 6. Level 100 mastery star

The normal mastery/prestige star does **not** require a minimum first-attempt score.

The star means the learner completed and correctly resolved Levels 1–100 and the Level 100 mastery encounter.

After all 10 mastery questions are correctly resolved:

- Award the first mastery/prestige star.
- Award XP according to the first-attempt mastery band above.
- Unlock Levels 101–200 when available.

Do not stack a separate old `+250` Level 100 mastery bonus on top of the 500-XP mastery encounter.

A future rare accomplishment may recognize exceptional first-attempt mastery performance, but it is not required for the standard star.

## 7. Review behavior

Review also requires correct resolution.

If a scheduled review question is wrong:

1. Record the first-attempt miss.
2. Show the relevant supporting learning card/evidence.
3. Require the learner to select the correct answer before the review item resolves.
4. Increase review priority / reduce recall confidence as appropriate.

Review XP:

- Correct on the first attempt: **+10 XP** for that scheduled review occurrence.
- Wrong on the first attempt: **0 XP** for that item, even after correction.
- Corrections award no additional XP.
- The same scheduled review occurrence cannot be replayed for farming.

Review never consumes one of the 5 daily new-level allowances.

## 8. Daily free progression

- Free users: **5 new resolved levels per day**.
- Unlimited users: no new-level daily cap.
- Review remains available after the cap.
- No ads, hearts, energy, gems, loot boxes, or exclusive paid knowledge.
- The subscription sells freedom to continue, not stronger stats or exclusive curriculum.
- Current working price: **$4.99/month**, with an annual option around **$39.99/year**.

At 5 / 5, completion should feel successful, not like running out of energy.

Brand voice example:

> No more doomscrolling. Go touch grass.

## 9. Weekly Knowledge Quests

Weekly Knowledge Quests are the BrainScroll equivalent of RPG questlines / boss-like objectives without literal combat.

### Standard weekly quest

Default target:

- **25 new levels total**.
- Usually **5 related skills × 5 levels each**.
- A free learner can finish in five learning days if they devote their daily allowance to the quest.
- Unlimited users can finish faster or continue unrelated skill progression in the same week.

Example: **The Roman World**

- Roman History +5
- European Geography +5
- Art & Architecture +5
- Government & Society +5
- Mythology & Religion +5

Quest progression must consume canonical **resolved level-completion events**. Merely opening or swiping through a lesson never counts.

### Final encounter

After the level requirements are complete, unlock a short final encounter — normally **3 synthesis questions** connecting the skills studied that week.

### Rewards

Weekly quests can award:

- Trophy
- Title
- Earned profile cosmetic
- Knowledge XP bonus

No coins or gems.

### No FOMO

Featured quests move into an archive such as **The Chronicle** after their live week. The main trophy, title, cosmetic, and learning remain obtainable later. A live-week completion can receive a subtle dated marker, but not exclusive permanent knowledge/status that becomes impossible to earn.

## 10. Social and reward philosophy

- No fake currency economy.
- Profile should prominently show the three rarest / most prestigious trophies, then skill levels and the broader trophy collection.
- Weekly friend leaderboards reset; lifetime mastery remains on profiles.
- Leaderboard XP must come from canonical server-side reward events.
- Premium must not multiply leaderboard XP.
- Streaks may exist quietly, but BrainScroll should celebrate accumulated knowledge rather than threaten users with streak loss.

## 11. Server-authoritative anti-farming rule

The client never decides how much XP it earned.

Canonical backend events should drive:

- XP
- skill progression
- concept mastery / review priority
- leaderboard totals
- Weekly Knowledge Quest progress
- trophies / achievements
- daily new-level allowance

Reward events must be idempotent so retries do not duplicate awards.

## 12. Build-order implications

Keep the core learning loop ahead of expansion systems.

Recommended dependency order:

1. Canonical curriculum and level schema.
2. Normal lesson player with 3-question reinforcement flow.
3. Server-authoritative resolved completion + first-attempt XP.
4. Skill progression / character sheet.
5. Review and mastery engine.
6. 5-new-level daily cap.
7. Subscription entitlement.
8. Reward event ledger / achievements / titles / profile rewards.
9. Weekly Knowledge Quest model and progress tracking.
10. Quest UI, final encounter, Chronicle/archive.
11. Friends / friend profiles / weekly leaderboards.
12. Friend-facing quest progress and later social extensions.

# BrainScroll: Current Product Decisions

This file records product decisions made after parts of the converted DOCX specifications were authored.

> **Status: merged (2026-09-23).** Every item below is now reflected in `PRODUCT_ROADMAP.md`, `BUILD_ORDER.md`, `VISUAL_DIRECTION.md` and `SOCIAL_REWARDS.md`, and implemented where it applies to the MVP (`packages/core/src/constants.ts`, the SQL migrations). This file remains as a concise decision record.

## 1. Learning first, testing second

BrainScroll is a learning app, not a quiz app. A normal level should feel like an interesting learning encounter followed by lightweight checks that reinforce the material.

**Depth (owner decision, 2026-09-25):** the goal is to make the concept being taught *memorable*. Priority order: **learn > interesting > fun**. Each card makes its one idea interesting (how we know it, why it happens, a concrete sense of scale) and never wanders into neighboring topics, however interesting: those get their own level. A level should never feel like reading a bare fact, and never like a tour of tangents. This replaced the earlier 2–4 short cards of 100–250 words.

Typical normal level:

- 3–5 focused learning/reading cards, each one short paragraph (about 50–90 words).
- Roughly 180–320 words total, depending on topic.
- Optional image, map, timeline, diagram, comparison, or connection card.
- 3 questions.
- Roughly 3–6 minutes total.

The normal three questions should generally cover:

1. **Recall:** did the learner retain the core fact or idea?
2. **Understanding:** do they understand why it happened, how it works, or why it matters?
3. **Connection:** can they connect it to another concept, event, system, or previously learned idea?

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

### 5-question checkpoint (max 150 XP)

| First-attempt result | XP |
|---|---:|
| 5 / 5 | 150 |
| 4 / 5 | 105 |
| 3 / 5 | 60 |
| 0–2 / 5 | 25 |

### Level 50 milestone (7 questions, max 250 XP)

| First-attempt result | XP |
|---|---:|
| 7 / 7 | 250 |
| 6 / 7 | 175 |
| 4–5 / 7 | 90 |
| 0–3 / 7 | 40 |

### Level 100 mastery (10 questions, max 500 XP)

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
- Unlimited’s only gameplay/progression advantage is removing the daily new-level cap. Unlimited may also include non-progression cosmetic or personalization benefits (themes, profile customization).
- Unlimited never provides exclusive knowledge, stronger progression, better XP rates, exclusive achievement trophies, or anything that implies greater mastery.
- Cosmetics that signify accomplishment (mastery frames, quest rewards, rare trophy treatments, prestige effects) are always earned, never purchasable or subscription-gated.
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

After the level requirements are complete, unlock a short final encounter: normally **3 synthesis questions** connecting the skills studied that week.

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

## 13. Editorial rule: no em dashes

BrainScroll-authored text never uses em dashes (U+2014). This covers both curriculum and product copy:

- **Curriculum:** learning cards, questions, answer choices, explanations, reinforcement text, headings.
- **Product copy:** UI copy, onboarding, achievements, trophies, titles and descriptions, Weekly Quests, notifications, subscription copy, error messages.
- **Everything else:** seed/demo content, admin-generated content, and future AI-generated content.

Replace each one by rewriting the sentence according to its purpose: a comma, colon, parentheses, a semicolon, a conjunction, a period, or no punctuation at all. Never use a mechanical global substitution.

- Exact source quotations keep their original punctuation, and so does source metadata such as source titles.
- Paraphrased, summarized or adapted material follows the rule.
- An authored em dash is a validation error, so it blocks publish-ready status until corrected.

See `docs/content-guide.md` ("Editorial rules").

## 14. Accounts are required; there is no guest mode

BrainScroll requires an account before persistent learning progress begins.

- **Flow:** open the app → choose a sign-in method → account created or signed in → onboarding → start learning. Signing in creates the account on first use, so there's no separate sign-up form. The goal is extremely low friction: one tap with Apple or Google.
- **Methods:** Sign in with Apple, Sign in with Google, phone number (SMS code), and email (code) as the fallback. A method appears only once it's configured. A missing credential never turns into a guest fallback.
- **Never:** anonymous user records, guest progress, guest-to-account migration, guest cleanup jobs, or merge logic.
- **Persistence:** progress belongs to the authenticated account, so it survives reinstalls and follows the learner to any device.
- **Enforcement:** anonymous sign-ins are off in the project, and the database refuses anonymous users (`20261001000000_accounts_required.sql`).

See `docs/accounts.md`.

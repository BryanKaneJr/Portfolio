# Content guide

Levels are **data**. The same JSON is validated by `scripts/`, previewed in admin, published as an immutable revision, and rendered by the app's generic `CardRenderer`. No level gets bespoke UI.

The schema is in [`packages/core/src/content-schema.ts`](../packages/core/src/content-schema.ts) and the cross-file rules are in [`packages/core/src/validate.ts`](../packages/core/src/validate.ts).

## Files

```
content/
  subjects.json                     # the 6 launch subjects
  sources.json                      # source registry (every fact cites one)
  assets.json                       # media registry (licence + attribution + alt text)
  skills/<subject>.<skill>/
    skill.json
    concepts.json                   # atomic knowledge objects with sourced facts
    levels/001.json, 002.json, ...  # one file per canonical level
```

Run `npm run validate:content`. **Errors** block import and publish. **Warnings** are for editors. After editing, run `npm run content:build` to refresh the app's offline bundle.

## The learning structure

BrainScroll is a learning app first. A learner should finish a level thinking *"I just learned something interesting,"* not *"I just finished another test."*

A **regular level** runs hook → 2–4 short learning cards (roughly 100–250 words) → **3 questions** → level complete. Checkpoints (every 10th level), milestones (Level 50) and the Level 100 Mastery Challenge test more. Review sessions size themselves to what's due.

| `type` | Levels | Questions (standard) | Learning cards (norm) | Learning words (norm) |
| --- | --- | --- | --- | --- |
| `regular` | everything else | **3** | 2–4 | 100–250 |
| `checkpoint` | 10, 20, 30 … | **5** | 2–4 | 80–250 |
| `milestone` | 50, 150, 250 … | **7** | 1–4 | 50–250 |
| `mastery` | 100, 200, 300 … | **10** | 0–3 | 0–200 |

The source of truth is `LEARNING_STRUCTURE` in `packages/core/src/constants.ts` (`questions.standard`). A **published** level must have exactly the standard number of questions. A draft that differs gets a **warning**; one outside the drafting tolerance (`questions.min`–`max`) is an **error**. Learning-card and word counts outside the norm are warnings. Each level declares `"type"`, and it must match its number (`levelTypeFor`).

**Question purposes.** Every question has a `purpose`. Regular levels use one of each:
- `recall`: the core fact or idea from this level.
- `understanding`: why it happened, how it works, or why it matters.
- `connection`: links it to another concept, event or system. It's often a `recall` card that reaches back to an earlier level.

**Evidence.** A question must never exist without the card that proves it. Write the card first, then the question, then point `sourceCardIds` at the card. A good wrong-option `rationale` ("That's Jupiter.") plus the source card should make the right answer findable in seconds.

**Order.** Learn first, then check: hook, learning cards, then the questions, then the recap card. The validator warns if a question comes before the last learning card.

## Anatomy of a level

- `objective`: one clear learning goal, phrased as "After this level you can …".
- `concepts`: what the level `teach`es, `reinforce`s, or `recall`s. `recall` must point at something an earlier level taught.
- `type`: `regular`, `checkpoint`, `milestone` or `mastery` (see above).
- `cards`: hook → learning cards → question cards → a `checkpoint` recap card. (The `checkpoint` *card* is the end-of-level recap. It isn't the same thing as a checkpoint *level*.)
- `questions`: count set by `type` (3 for a regular level). Each needs a `purpose`, **exactly one** correct option, 2–4 options, an explanation, the concept IDs it tests, and **`sourceCardIds`**: the learning or hook cards that teach the answer. After a wrong first attempt, those cards appear under the question ("Take another look") until it's answered correctly. They can be in this level or an earlier level of the same skill, which is typical for connection questions. The validator rejects missing, unknown, later-level or question/recap cards. Make sure the card actually contains the evidence. Each question is shown by exactly one `mcq` or `recall` card.
- `sourceIds`: every source the level relies on. A **published** level can't cite an unverified source or one with an `unknown` licence.

### Card types

| Type | Payload |
| --- | --- |
| `text` | `role` (hook / explain / connect), `headline`, optional `body`, `callout` |
| `image` | `assetId`, optional `caption` (alt text + attribution come from the asset) |
| `fact` | short memorable `fact` + optional `context` |
| `timeline` | `headline`, 2–6 `events` `{when, label}` |
| `comparison` | `headline`, 2–3 `items` `{label, points[]}` |
| `mcq` | `questionId` |
| `recall` | `questionId`, which must test a concept taught in an earlier level |
| `checkpoint` | `headline`, 1–5 `learned` bullet points |

### Answer positions

Vary which option is correct across a skill. The validator warns when one letter holds more than 45% of the correct answers. If the options have a natural order (numbers, dates, sequences), keep that order and let the correct answer land wherever it falls.

### Text budgets (mobile)

Headline ≤ 80 chars · body ≤ 360 · question prompt ≤ 200 · answer ≤ 80 · explanation ≤ 300. **If a card doesn't fit, split the idea. Don't shrink the type.**

## Editorial standard (Golden levels)

| Dimension | Pass standard |
| --- | --- |
| Accuracy | Every factual claim is source-backed, with no unsupported AI filler |
| Scope | One clear objective per level, not an encyclopedia dump |
| Readability | Mobile-length cards |
| Questions | Three per regular level (recall, understanding, connection). One defensible answer, plausible distractors, a short explanation after the response. They reinforce the lesson and shouldn't feel like an exam |
| Connection | Shows how the new knowledge relates to earlier knowledge |
| Tone | Smart and conversational. Not childish, academic or preachy |
| Completion | The learner can explain at least one new thing afterwards |

## Level bands (every 1–100 tree)

| Band | Purpose |
| --- | --- |
| 1–10 | Absolute fundamentals: vocabulary, orientation, the basic map of the topic |
| 11–25 | Core events, systems and relationships |
| 26–50 | Intermediate depth, chronology, cause and effect, comparisons, exceptions |
| 51–75 | Broader context, second-order connections, deeper mechanisms |
| 76–95 | Advanced synthesis, nuance, specialised concepts |
| 96–99 | Integration across the whole tree |
| 100 | Mastery Challenge (10 questions): resolving it earns ★ Mastery I and unlocks 101–200. There's no minimum first-attempt score |

## Sourcing and licences

Prefer **Wikidata** (CC0) for structured facts, and **NASA**, **Smithsonian Open Access (CC0)** and government sources for media. Use Wikipedia for research and discovery only, and don't copy its prose (CC BY-SA). **"We found it online" is never a licence.** Record every source in `sources.json` before citing it, and set `verified: true` only after an editor has checked the fact against the page. Get an IP attorney to review the final commercial ingestion and attribution rules before public launch.

## Weekly Quests (post-MVP)

Quests are content too: data-driven definitions, never hard-coded. When they're built they'll live in `content/quests/<id>.json`, be validated like levels, and be imported by the same pipeline. Rules for authors:

- Five related skills, usually +5 new levels each (~25 total; Epic ~35, Legendary 50+).
- Every requirement skill needs enough **published** levels for every learner to make that many new levels of progress. Themes can exist in the catalog before their trees do; attach requirements when the trees are published.
- The Final Encounter needs no new questions. It reuses **3** approved questions from the levels the learner completed for the quest, drawn from different requirement skills and preferring `purpose: connection`. It isn't an exam. So write strong `connection` questions in regular levels.
- Rewards reference trophy, title and cosmetic IDs. Never a currency.

## Publishing

A publish creates `level_revisions(level_id, revision, bundle)`. That record is immutable. To correct a level, bump `revision` and publish again. User progress points at the level ID, so it survives the change.

# Content guide

Levels are **data**. The same JSON is validated by `scripts/`, previewed in admin, published as an immutable revision, and rendered by the app's generic `CardRenderer`. No level gets bespoke UI.

The schema is in [`packages/core/src/content-schema.ts`](../packages/core/src/content-schema.ts) and the cross-file rules are in [`packages/core/src/validate.ts`](../packages/core/src/validate.ts).

## Files

```
content/
  subjects.json                     # the 6 launch subjects
  sources.json                      # source registry (every fact cites one)
  verification.json                 # claim verification ledger: one record per (fact, source)
  assets.json                       # media registry (licence + attribution + alt text)
  skills/<subject>.<skill>/
    skill.json
    concepts.json                   # atomic knowledge objects; each fact is one verifiable claim
    levels/001.json, 002.json, ...  # one file per canonical level
```

Run `npm run validate:content`. **Errors** block import and publish. **Warnings** are for editors. After editing, run `npm run content:build` to refresh the app's offline bundle.

## The learning structure

BrainScroll is a learning app first. A learner should finish a level thinking *"I just learned something interesting,"* not *"I just finished another test."*

A **regular level** runs hook → 3–5 focused learning cards (roughly 150–320 words) → **3 questions** → level complete. See *Writing to interest* below: the goal is to make the concept memorable. Checkpoints (every 10th level), milestones (Level 50) and the Level 100 Mastery Challenge test more. Review sessions size themselves to what's due.

| `type` | Levels | Questions (standard) | Learning cards (norm) | Learning words (norm) |
| --- | --- | --- | --- | --- |
| `regular` | everything else | **3** | 3–5 | 150–320 |
| `checkpoint` | 10, 20, 30 … | **5** | 2–4 | 120–320 |
| `milestone` | 50, 150, 250 … | **7** | 1–4 | 80–320 |
| `mastery` | 100, 200, 300 … | **10** | 0–3 | 0–250 |

The source of truth is `LEARNING_STRUCTURE` in `packages/core/src/constants.ts` (`questions.standard`). A **published** level must have exactly the standard number of questions. A draft that differs gets a **warning**; one outside the drafting tolerance (`questions.min`–`max`) is an **error**. Learning-card and word counts outside the norm are warnings. Each level declares `"type"`, and it must match its number (`levelTypeFor`).

**Question purposes.** Every question has a `purpose`. Regular levels use one of each:
- `recall`: the core fact or idea from this level.
- `understanding`: why it happened, how it works, or why it matters.
- `connection`: links it to another concept, event or system. It's often a `recall` card that reaches back to an earlier level.

**Evidence.** A question must never exist without the card that proves it. Write the card first, then the question, then point `sourceCardIds` at the card. A good wrong-option `rationale` ("That's Jupiter.") plus the source card should make the right answer findable in seconds.

**Order.** Learn first, then check: hook, learning cards, then the questions, then the recap card. The validator warns if a question comes before the last learning card.

## Anatomy of a level

- `objective`: one clear learning goal, phrased as "After this level you can …".
- `concepts`: what the level `teach`es, `reinforce`s, `recall`s, or `preview`s. `recall` must point at something an earlier level taught. `preview` is for a concept the level mentions in passing to make the story richer ("the nearest star is 4.2 light-years away") before a later level teaches it fully; some later level must teach it. Every level teaches at least one concept, except a `mastery` level, which may be pure recall across the tree (its structure allows zero learning cards).
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

Headline ≤ 80 chars · body ≤ 600 (one focused paragraph) · question prompt ≤ 200 · answer ≤ 80 · explanation ≤ 300. **If a card doesn't fit, split the idea. Don't shrink the type.**

## Writing to interest

The goal is to make **the concept being taught memorable**. Priority order: **learn > interesting > fun**. A card that states a fact and stops is a flashcard; a card that wanders into neighboring topics is a tour. BrainScroll cards take one idea and make it stick.

- **Stay on the concept.** Every sentence must help the learner understand or remember *this level's* idea. A fascinating neighbor (Pluto in a level about Earth's address) is a tangent: cut it and let it have its own level.
- **Keep it tight.** One idea per card, one short paragraph (about 50–90 words). If a sentence could be deleted without the concept getting less clear or less memorable, delete it.

What turns information into something interesting (owner-approved, 2026-09-25):

- **One idea per card, with a payoff.** Build each card to one surprising line a learner would repeat to a friend: "If the Sun vanished right now, you'd keep seeing it for about 8 more minutes."
- **Tell one story across the level.** Cards should feel like steps in one story (the address gets written line by line), not separate mini-lectures.
- **Numbers only when they're the point.** Keep the number that is the fact (8 minutes); cut the supporting figures (300,000 km per second, 150 million km) unless the card is about them. Stacked numbers read as an info dump.
- **Everyday pictures.** Postcards, suburbs, front doors, rust on an old bike. Talk to the learner as "you".
- **A sense of humor.** A light joke or a wry aside is welcome ("We're the crumbs." "You could stand on any of them. You wouldn't enjoy most of them."). One per card is plenty, and it never replaces the learning.

And to make the concept itself interesting, ask what would make a curious friend lean in:

- **Open with a hook, not a definition.** A question, a surprise, a scene, a problem people once had. "In 1543, a dying man published a book that moved the Sun" beats "Copernicus proposed heliocentrism."
- **Tell how we know.** Who noticed, what they measured, what they got wrong first. Discovery is the most interesting part of most facts.
- **Explain the why.** Don't stop at *what*: say why it happens or why it matters.
- **Make scale concrete.** Turn big numbers into something you can picture ("if the Sun were a front door, Earth would be a nickel").
- **Connect it** to the learner's life or to an earlier level, when that makes the concept clearer.
- **Vary rhythm:** a short sentence lands a point after a long one.
- **Stay accurate.** Stories and analogies make facts vivid, but every factual statement is still a registered claim with a source. Analogies must be true to scale, and nothing is invented for color: no made-up quotes, scenes or motives.

## Editorial standard (Golden levels)

| Dimension | Pass standard |
| --- | --- |
| Accuracy | Every factual claim is source-backed, with no unsupported AI filler |
| Scope | One clear objective per level, told fully: a story with context, not a list of facts |
| Readability | One paragraph per card, easy to read on a phone |
| Questions | Three per regular level (recall, understanding, connection). One defensible answer, plausible distractors, a short explanation after the response. They reinforce the lesson and shouldn't feel like an exam |
| Connection | Shows how the new knowledge relates to earlier knowledge |
| Tone | Smart and conversational. Not childish, academic or preachy |
| Punctuation | **No em dashes**, ever (see *Editorial rules*) |
| Completion | The learner can explain at least one new thing afterwards |

## Dr. Scroll asides

A learning card (never a question card) can carry an optional Dr. Scroll aside: `"mascot": { "pose": "whisper", "line": "..." }`. He appears after the card with one short line.

- **Poses:** calm ones only: `pointing`, `thinking`, `idea`, `explaining`, `magnifier`, `whisper`, `thumbs-up`, `oops`. Anything louder is a validation error.
- **The line:** at most 140 characters, in his voice (warm, delighted, never scolding). It reacts to the card. **It never adds a new fact**, because asides aren't in the claim ledger and aren't fact-checked.
- **How often:** at most 2 per level (more is a warning), and most levels need none. He stays special.
- The content admin has a "Dr. Scroll" pose picker and a "Says" field on every learning card. See `docs/mascot.md`.

## Editorial rules (all BrainScroll-authored text)

These apply to everything BrainScroll writes:

- **Curriculum:** learning cards, questions, answer choices, rationales, explanations, reinforcement text, headings, summaries, objectives, recaps, concept and claim text, syllabus titles.
- **Product copy:** UI, onboarding, achievements, trophies, titles, Weekly Quests, notifications, subscription copy, error messages, seed and demo content, admin-generated content.
- **Documentation and templates**, and any AI-generated content.

### Hard rule: no em dashes

BrainScroll-authored text never uses the em dash (U+2014). Don't swap in a hyphen or any other single substitute. **Rewrite the sentence** by what the dash was doing:

| The dash was… | Rewrite with | Example |
|---|---|---|
| adding a detail | a comma | Venus is extremely hot, even hotter than Mercury. |
| introducing an explanation or list | a colon | There was one major problem: the atmosphere trapped heat. |
| setting off an aside | parentheses | The planet rotates slowly (about once every 243 Earth days), which creates an unusual day cycle. |
| joining two related clauses | a semicolon | Mercury is closer to the Sun; Venus is still hotter. |
| contrasting or linking | a conjunction | Rome expanded rapidly, but its government struggled to keep up. |
| adding emphasis | a period, or restructure | The empire survived, but only in the east. / Surprisingly, the result was a colder climate. |

En dashes in ranges (Levels 1–100) and hyphens in compound words are fine.

**Source-material exception.** An exact quotation from a source keeps its original punctuation: the verification ledger's `supportingQuote`, and anything marked as a verbatim quote. Source metadata (a source's `title`, `publisher`, `url`) also stays faithful to the source. Anything BrainScroll paraphrases, summarizes or adapts follows the rule.

**Enforcement.**
- `npm run validate:content` reports an authored em dash as an **error** anywhere in levels, concepts and claims, skills, subjects, syllabi, source notes and ledger notes. It exempts only `supportingQuote` and source title, publisher and URL. Errors block publishing: the importer, Content Admin's publish control and `npm run check` all refuse.
- `npm run lint:copy` (part of `npm run check`) scans app strings, docs, admin, scripts, SQL and tests. A line reproducing an exact external quotation can carry the marker `copy-lint: verbatim`.
- **Generating content with AI:** put this rule in the prompt ("Never use em dashes (U+2014); rewrite the sentence with a comma, colon, semicolon, parentheses, a period or a conjunction"), then run the validator. Don't post-process dashes away mechanically.

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

Prefer **Wikidata** (CC0) for structured facts, and **NASA**, **Smithsonian Open Access (CC0)** and government sources for media. Use Wikipedia for research and discovery only, and don't copy its prose (CC BY-SA). **"We found it online" is never a licence.** Record every source in `sources.json` before citing it. A source's `verified: true` means an editor has checked the source record itself (URL, publisher, licence). Get an IP attorney to review the final commercial ingestion and attribution rules before public launch.

## Claims and verification

Every factual statement a learner reads is a **claim**: a concept `fact` with a stable ID, its exact text, the sources that support it and the `cardIds` that state it.

```json
{ "id": "fact.astronomy.sun_age", "text": "The Sun is about 4.6 billion years old.",
  "sourceIds": ["source.nasa_sun_facts"], "cardIds": ["card.astronomy.002.c4"] }
```

- **Every factual sentence on a learning or hook card maps to a claim.** If a card says it, a fact says it, word-for-word in meaning. Numbers in the card and the fact must match. Arithmetic derived from other claims (e.g. Moon–Earth light time) is its own claim that cites the sources of its inputs.
- **Verification is a separate ledger**, `content/verification.json`: one record per (fact, source) with `status` (`unverified` / `verified` / `unsupported` / `incorrect`), and for any checked status who checked it, when, and the supporting quote from the page. Only a person sets `verified`. Drafting tools may add a `preCheck` note pointing at something to look at. That is never a verification. An automated `factCheck` (result `corroborated`, `corrected` or `disputed`, with the evidence, up to three URLs and, for a correction, the previous wording) records a check against independent sources found by web search. It can justify rewording a claim before a human sees it, but it is never a verification either: the cited page still has to be checked.
- **Publishing needs verified claims.** A `published` level must have every claim it states (on its cards) or teaches (its `teach` concepts) verified against every cited source. Drafts get a count as a warning.

Workflow:

```sh
npm run verify:sync      # after adding facts: create "unverified" records for new (fact, source) pairs
npm run verify:report    # write docs/verification/<skill>.md (checklist grouped by source page) + .csv
npm run verify:record -- fact.astronomy.sun_age source.nasa_sun_facts --status verified --by "Name" --quote "…"
npm run verify:import-csv -- docs/verification/astronomy.csv --by "Name"   # or fill in the CSV instead
```

## Automated quality checks

`npm run validate:content` (add `-- --json` for machine-readable output) runs, beyond the schema and references:

| Check | Severity |
| --- | --- |
| Level file name matches its number; at most 16 cards per level | error |
| Identical question prompt anywhere in the skill | error |
| Published level changed without a `revision` bump, a published level deleted, or a revision going backwards (baseline: the committed app bundle) | error |
| An asset reproduced from a `reference_only` source | error |
| A number on a hook/learning card that isn't in any claim on that card (unsupported or mismatched figure) | warning |
| A learning card that states no claim | warning |
| A prompt containing its own answer, or an earlier question's feedback giving away a later answer in the same level | warning |
| Near-duplicate question (very similar prompt, same answer) in the skill | warning |
| The right answer is ≥30% longer than every distractor in more than 25% of a skill's questions (a length tell) | warning |
| A question whose `sourceCardIds` state no claim of the concepts it tests | warning |
| "All/none of the above", or fewer than 3 options | warning |
| A concept taught by more than one level, taught but never tested (it could never return in review), reinforced before it's taught, or unused | warning |
| A source nobody cites | warning |

Plus the syllabus checks (coverage, chapters, title drift) and the claim/verification checks above.

## Weekly Quests (post-MVP)

Quests are content too: data-driven definitions, never hard-coded. When they're built they'll live in `content/quests/<id>.json`, be validated like levels, and be imported by the same pipeline. Rules for authors:

- Five related skills, usually +5 new levels each (~25 total; Epic ~35, Legendary 50+).
- Every requirement skill needs enough **published** levels for every learner to make that many new levels of progress. Themes can exist in the catalog before their trees do; attach requirements when the trees are published.
- The Final Encounter needs no new questions. It reuses **3** approved questions from the levels the learner completed for the quest, drawn from different requirement skills and preferring `purpose: connection`. It isn't an exam. So write strong `connection` questions in regular levels.
- Rewards reference trophy, title and cosmetic IDs. Never a currency.

## Publishing

A publish creates `level_revisions(level_id, revision, bundle)`. That record is immutable. To correct a level, bump `revision` and publish again. User progress points at the level ID, so it survives the change.

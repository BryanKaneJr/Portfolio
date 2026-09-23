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

## Anatomy of a level

- `objective`: one clear learning goal, phrased as "After this level you can …".
- `concepts`: what the level `teach`es, `reinforce`s, or `recall`s. `recall` must point at something an earlier level taught.
- `cards`: usually 4–7, validated between 3 and 10. Open with a `text` card whose role is `hook`, and end with a `checkpoint`.
- `questions`: 1–4. Each needs **exactly one** correct option, 2–4 options, an explanation, and the concept IDs it tests. Each question is shown by exactly one `mcq` or `recall` card.
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
| Questions | One defensible answer, plausible distractors, explanation after the response |
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
| 100 | Mastery Challenge: ★ Mastery I, which unlocks 101–200 |

## Sourcing and licences

Prefer **Wikidata** (CC0) for structured facts, and **NASA**, **Smithsonian Open Access (CC0)** and government sources for media. Use Wikipedia for research and discovery only, and don't copy its prose (CC BY-SA). **"We found it online" is never a licence.** Record every source in `sources.json` before citing it, and set `verified: true` only after an editor has checked the fact against the page. Get an IP attorney to review the final commercial ingestion and attribution rules before public launch.

## Publishing

A publish creates `level_revisions(level_id, revision, bundle)`. That record is immutable. To correct a level, bump `revision` and publish again. User progress points at the level ID, so it survives the change.

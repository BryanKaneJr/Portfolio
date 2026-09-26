# Brief: write one 10-level chapter of a BrainScroll skill tree

The brief every chapter writer follows (people or agents). Chapter 1 of a new tree adds [`chapter-one.md`](chapter-one.md); some trees have extra rules in [`tree-rules/`](tree-rules/). How the pipeline runs end to end is in [`README.md`](README.md).

BrainScroll is a learning app. Each level is a hook card, 2–5 learning cards, then questions. You write one chapter (10 levels), often in parallel with writers doing other chapters. **Don't run git and don't edit the repo's `content/` directly.** Work in a private copy and hand it back to be merged.

## Setup

```
W=<drafts-dir>/<SKILL>-ch<N>          # a folder outside the repo
mkdir -p $W && cp -r content $W/content
npm run validate:content -- --dir $W/content    # run from brainscroll/
```

## Read first

1. `CLAUDE.md` (invariants: **no em dashes (U+2014) anywhere**, stable IDs, question rules).
2. [`voice.md`](voice.md): learn > interesting > fun, one idea per card with a payoff line, one story per level, numbers only when they're the point, everyday pictures, "you", light humor, no tangents.
3. `docs/content-guide.md`: "Writing to interest", "Editorial rules", "Level bands", concept roles (teach / reinforce / recall / preview), Dr. Scroll asides.
4. **The approved Chapter 1 of this tree**: `content/skills/<SKILL>/levels/001.json`–`010.json` and `concepts.json`. Match its voice, structure, ID patterns, source and verification style.
5. Format references: a checkpoint `content/skills/science.astronomy/levels/010.json`; if your chapter holds Level 50, the milestone `050.json`; if it holds Level 100, the mastery challenge `100.json`. Types and question counts come from `LEARNING_STRUCTURE` in `packages/core/src/constants.ts` (regular 3, checkpoint every 10th level 5, Level 50 milestone 7, Level 100 mastery 10 with no learning cards required). Word norms: regular 150–320, checkpoint 120–320, milestone 80–320, mastery 0–250.
6. The plan: `content/skills/<SKILL>/syllabus.json` and your chapter's levels (title, objective and `art` exactly as given).

## What you write (in `$W/content`)

- `skills/<SKILL>/levels/NNN.json` for your 10 levels: status `draft`, revision 1, `prerequisites` = the previous level. IDs follow Chapter 1's pattern.
- New concepts and facts appended to `skills/<SKILL>/concepts.json`, with slugs specific to your chapter so they can't collide. You may reuse concepts from **any earlier chapter that already exists in the repo** (as recall/reinforce) and add your card IDs to their facts' `cardIds`. Never reference a chapter being written in parallel. Don't use `preview` roles.
- New sources appended to `content/sources.json` (`source.<publisher>_<topic>`; prefer official agencies, encyclopedias and educational publishers; `verified: false`; a `notes` line). Reuse an existing source id when there is one.
- New records appended to `content/verification.json`, one per (fact, source), `status: "unverified"` (only a person sets verified), with `factCheck: { result: "corroborated", evidence, urls, checkedAt }` **only after you confirmed the claim** against at least one page other than the cited source. If you can't corroborate a claim, rewrite it or drop it. Never invent numbers, dates, names or quotes.

## The understanding arc: later chapters ask more of the learner

A tree should move from *what is it* to *can you reason with it*, without making lessons longer or harder to read. The level number sets the band; no extra metadata.

| Chapter | Levels | The learner is asked to | In practice (each regular level) |
| --- | --- | --- | --- |
| 1–2 | 1–20 | know what it is, what happened | recall, understanding, connection as usual |
| 3–4 | 21–40 | see how it works | the understanding question asks *how* (a mechanism or process), not *what* |
| 5–6 | 41–60 | explain why | at least one question asks *why* (a cause, a reason, a trade-off) |
| 7–8 | 61–80 | connect it to other ideas | the connection question draws on an **earlier chapter** (its source cards include one) |
| 9–10 | 81–100 | reason with what they know | one question applies what they learned to a new case, or weighs two explanations; the connection question still reaches an earlier chapter |

Keep it light: one step of reasoning, the same word budgets, answers still stated plainly on the source cards. The validator warns when a level from 61 up has no connection question reaching an earlier chapter.

## Dr. Scroll: a teacher, not a comedian

Dr. Scroll's card asides (`"mascot": { "pose", "line" }`) are optional, at most two per level, and rarer is better. When a level has one, make it a **teaching move**:

- **Keep this:** "If you remember one thing from this level, make it this."
- **Don't memorize the detail:** "You don't need the exact date. Remember the order."
- **Common mix-up:** "People mix these two up all the time. Here's the difference."
- **It connects:** "This is Level 12's idea again, in a new place." or "This makes the next few levels easier."

A joke is welcome when it carries the point; a joke alone isn't a reason to interrupt. Never on question cards, and never more often than today.

## Checkpoints: proof of what the learner now knows

The chapter's 10th level is its checkpoint: a fresh angle on the chapter plus questions that reach back across it. Its final `checkpoint` card's `learned` list is shown on Level Complete as proof: "10 levels ago, could you have explained this?" So write each line as something the learner can now explain or do, in their words, not as a trivia fact:

- Good: "Why Rome's founding story is legend, and what archaeology shows instead."
- Weak: "Romulus founded Rome in 753 BCE."

Three or four lines, each ≤ 110 characters, one sentence ending in a period, each backed by what the whole chapter taught (not just its last level). **Every line opens with How, Why, What, When, Where, Which or Who**: the skill map turns the first line into "By Level 20, you'll know how …" and "You know how …", so make the first line the chapter's biggest idea. The validator warns on any other opening.

## Content rules

- Every factual sentence on a card is covered by a registered fact linked to that card (in the fact's `cardIds`). Simple exact arithmetic from a fact is fine. Analogies must be true to scale.
- Every question's `sourceCardIds` contain the evidence for the correct answer, in the question's own terms. Spread correct answers across options; give wrong options short rationales. The correct answer must not be the longest option by habit.
- Budgets: headline ≤ 80 characters, body/context ≤ 600, fact ≤ 140, callout ≤ 120, Dr. Scroll line ≤ 140 (calm poses only).
- Callbacks to earlier levels are good when they serve the concept ("Remember Level 3's coordinates?").
- **Stay inside your chapter's topics.** Read the whole syllabus: other chapters own their topics. If you need another chapter's idea, mention it in a phrase without registering a concept, and never write a question on it.
- **IDs must not collide:** prefix new concept and fact slugs with a word from your chapter's theme when a generic slug might be used elsewhere; spell topics out rather than abbreviating.
- **Word every question prompt specifically**; a recap prompt names your chapter's theme.
- Be careful with contested or changing facts (populations, rankings, records, borders): prefer stable, well-sourced figures, dated, and say "about" where sources round.
- Keep helper scripts inside `$W`, never in the repo.

## Done when

`npm run validate:content -- --dir $W/content` shows **0 errors** apart from those caused only by other chapters missing from your copy ("levels must be contiguous from 1", a missing prerequisite for your first level), and no warnings for your levels about word norms, source cards not stating their concept, numbers not in a claim, reinforce/preview roles, em dashes or the understanding arc. ("Cites unverified source" and "claims not yet verified" are expected.)

## Final report (short)

- Levels written, one line each.
- Sources added, and anything you couldn't corroborate and dropped.
- Validator warnings left for your levels, and why.
- Two sample cards you're proudest of, quoted.

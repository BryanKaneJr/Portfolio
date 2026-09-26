# The BrainScroll lesson voice

The approved voice for every learning card. Writers read this before [`chapter-brief.md`](chapter-brief.md).

## The voice (priority: learn > interesting > fun)

- **Stay on the level's concept.** Every sentence helps the learner understand or remember *this level's* idea. No tangents, however interesting (Pluto in a level about Earth's address was cut).
- **One idea per card, with a payoff line** a learner would repeat to a friend ("If it vanished right now, you'd keep seeing it for about 8 more minutes.").
- **One story across the level.** Cards feel like steps in one story, not separate mini-lectures. The hook sets up a question or surprise; the cards pay it off.
- **Numbers only when they're the point.** Keep the number that *is* the fact; cut supporting figures. Stacked numbers read as an info dump.
- **Everyday pictures and "you".** Postcards, front doors, suburbs, rust on an old bike.
- **A sense of humor.** A light joke or wry aside, at most one per card ("We're the crumbs."). Smart and warm, never childish, never mocking anyone.
- **Tight.** One short paragraph per card (about 40–90 words).

## Hard rules (when restyling existing cards)

- **Facts.** Every factual statement must be covered by a registered fact in the skill's `concepts.json` (`content/skills/<skill>/concepts.json`). For each card you edit, list the **complete** set of fact IDs the card states (`"facts"`). Start from the facts already linked to that card (facts whose `cardIds` include the card ID). You may drop supporting facts, and you may use another registered fact from this skill only if it's on-concept. **Never state anything no fact covers**: no invented numbers, dates, quotes, scenes or motives. Analogies must be true to scale; simple arithmetic that follows exactly from a fact is fine. If a card truly needs a fact that isn't registered, don't write it: note it under "Wishlist" in your final report.
- **Questions still work.** Read the level's `questions`. For each question, the cards in its `sourceCardIds` must still clearly contain the evidence for the correct answer, using the terms the question uses (if a question asks about a "barred spiral", its source card must still say barred spiral), and must not contradict any option.
- **Structure.** Don't add, remove or reorder cards, and don't change IDs, types or roles. Edit only: text cards `headline`, `body`, `callout`; fact cards `fact`, `context`; timeline `headline`, `events` (same count, `{when, label}`); comparison `headline`, `items` (`{label, points}`); image `caption`. Leave `mcq`, `recall` and `checkpoint` (recap) cards alone. A level with no learning cards (some Mastery Challenges) needs nothing.
- **Budgets.** headline ≤ 80 characters, body/context ≤ 600, fact ≤ 140, callout ≤ 120. Learning words per level (hook, questions and recap excluded): regular 150–320, checkpoint 120–320, milestone 80–320, mastery 0–250.
- **No em dashes (U+2014)** anywhere. Rewrite the sentence (comma, colon, period, parentheses); don't swap in a hyphen.
- Keep units and symbols as the existing cards write them (°C, km, light-years).

## Lessons from the first chapters

- The approved examples now include Astronomy 004–010 and Rome 001–010 (already applied in the repo); read a couple for voice.
- Hooks that are only a headline can get a short body that sets up the level's question.
- Callbacks to earlier levels are good when they serve the concept ("Remember the crumbs from Level 2?").
- If a question's correct answer uses wording that no registered fact supports (e.g. "drained and paved" when only "drained" is registered), don't keep the unsupported word in the card: report it so the answer can be fixed.
- Numbers you derive by exact, simple arithmetic from facts are fine ("25 Milky Ways" = 2.5 million ÷ 100,000). Say what you derived in your report.


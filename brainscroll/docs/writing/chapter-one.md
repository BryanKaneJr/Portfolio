# Addendum: writing Chapter 1 of a brand-new tree

Follow [`chapter-brief.md`](chapter-brief.md) with N=1, with these differences:

- There is no approved chapter 1 in this tree to match. Match the approved first chapters of other trees for voice, structure, ID patterns, sources and verification style. The tree's closest sibling is named in your prompt; also read `content/skills/science.human_body/levels/001.json`–`010.json` and `content/skills/history.middle_ages/levels/001.json`–`010.json` plus their `concepts.json`. ID patterns follow the other trees (for `science.human_body` they are `card.human_body.001.c1`, `question.human_body.001.q1`, `concept.human_body.<slug>`, `fact.human_body.<slug>`; drop the subject prefix the same way for your skill).
- Create `skills/<SKILL>/concepts.json` in your copy (an array).
- Level 1 has no prerequisites; Levels 2–10 each take the previous level. Callbacks only to your own chapter.
- Stay inside Chapter 1's topics as the syllabus lists them. Later chapters come later: mention them only in passing, with no concept or question.
- Your copy has every level of this tree, so the validator should show **0 errors**, and no warnings on your levels except "cites unverified source" and "claims not yet verified".
- Do not run git, do not edit the repo, and write no helper files into the repo (keep scripts inside your `$W` folder).

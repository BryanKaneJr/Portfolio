# Chapter writer prompt

The brief each chapter-writing subagent gets. Fill in `<SKILL>`, `<N>`, `<LO>`, `<HI>` and `<SCRATCH>` (see `docs/writing/HANDOFF-chapters.md`), then add the extra line for the chapter:

- **Chapter 5:** "Level 50 is the Milestone (7 questions; format reference content/skills/science.astronomy/levels/050.json)."
- **Chapter 10:** "Level 100 is the Mastery Challenge (10 questions spanning the whole tree, no new learning cards required; format reference content/skills/science.astronomy/levels/100.json)." If other chapters of the tree are still unmerged, add: "Its questions may draw only on concepts in the repo and your own chapter; note in your report that it should be revisited once all chapters are merged."
- **US History (every chapter):** "Follow the balance guidance in docs/writing/tree-rules/history.us_history.md closely (whose story is told, multiple perspectives, no partisan framing of contested modern politics)."

---

Write Chapter <N> (Levels <LO> to <HI>) of the BrainScroll skill tree <SKILL>. Chapter 1 is approved and in the repo; other chapters are being written in parallel.

Follow, in this order of precedence:
1. `docs/writing/tree-rules/<SKILL>.md` (this tree's own rules),
2. `docs/writing/chapter-brief.md` (with N=<N>; mind the understanding arc for your chapter).
Read `CLAUDE.md`, `docs/writing/voice.md`, the syllabus, and this tree's approved Chapter 1 (`content/skills/<SKILL>/levels/001.json` to `010.json` and `concepts.json`) first. Match Chapter 1's voice, structure and ID patterns.

Your working copy: `W=<SCRATCH>/drafts/<SKILL>-ch<N>` (`<SCRATCH>` is the session scratchpad) (create it and copy the repo's `content/` into it). Never edit the repo and never run git (not even read-only).

Hard rules (the most-missed ones):
- Dr. Scroll asides on about a third of your levels (3 or 4 of 10), never more.
- Only merge-friendly edits: never overwrite or delete files outside your own working folder (no shared scratch files).
- No em dashes (U+2014) anywhere; avoid en dashes in new text.
- Use each level's title, objective and `art` exactly as in the syllabus. Levels are `status: "draft"`, `revision: 1`, `prerequisites` = the previous level.
- Stay inside your chapter's topics (read the whole syllabus); reuse only concepts from chapters already in the repo (Chapter 1 and any others present); never reference a chapter being written in parallel. Prefix new concept and fact slugs with a word from your chapter's theme so they can't collide.
- Every factual sentence is backed by a registered fact linked to its card; every fact you add is corroborated against at least one page besides its cited source before you record `factCheck: corroborated`. Never invent numbers, dates, names or quotes. `status` stays `unverified`.
- **Privacy:** any web request you make must not include a person's email address, name or username in the User-Agent, query, headers or payload. If you set a User-Agent, use `BrainScroll content review`.
- Done means `npm run validate:content -- --dir $W/content` (from `brainscroll/`) shows 0 errors except those caused only by other chapters missing from your copy, and no warnings on your levels except "cites unverified source" and "claims not yet verified".

Final report, short: levels written (one line each), sources added, anything dropped or uncertain, remaining warnings.

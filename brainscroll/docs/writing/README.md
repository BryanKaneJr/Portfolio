# Writing skill trees

How BrainScroll's 16 trees were written, and how to write the next ones. Everything here is content work: no app code changes.

## Files

- [`voice.md`](voice.md): the approved lesson voice.
- [`chapter-brief.md`](chapter-brief.md): the brief for one 10-level chapter, including the understanding arc, Dr. Scroll's teaching asides and how checkpoint recaps are written.
- [`chapter-one.md`](chapter-one.md): the extra rules for Chapter 1 of a brand-new tree.
- [`tree-rules/<skill>.md`](tree-rules/): a tree's own sensitivities (neutrality, safety, sourcing), where it has any.
- `scripts/writing/merge_chapters.py`: merges a chapter written in a private copy of `content/` back into the repo.

## The pipeline

1. **Plan:** the tree's `content/skills/<skill>/syllabus.json` lists its 10 chapters and 100 levels (title, objective, art).
2. **Chapter 1** is written first ([`chapter-one.md`](chapter-one.md)), reviewed and merged. It sets the tree's voice and ID patterns.
3. **Chapters 2–10** are written in parallel, each in its own copy of `content/` (a drafts folder outside the repo), following [`chapter-brief.md`](chapter-brief.md) with the chapter number and any tree rules.
4. **Trial merge** into a copy first, to catch ID clashes between chapters (the usual ones: two chapters creating the same fact id, recap prompts worded alike):
   ```sh
   cp -r content /tmp/trial && CONTENT=/tmp/trial python3 scripts/writing/merge_chapters.py <drafts-dir> <skill> 2 3 4 5 6 7 8 9 10
   npm run validate:content -- --dir /tmp/trial
   ```
   Fix clashes in the chapter drafts (rename the later chapter's id), then merge for real (drop `CONTENT=`).
5. **Build and check:** `npm run content:build`, `npm run verify:flag-weak`, `npm run check`, `npm run test:db`.

Every fact is drafted as `unverified` with an automated `factCheck`; only a person sets `verified` (see `docs/content-guide.md`, "Claims and verification").

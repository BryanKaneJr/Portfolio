# Handoff: writing Chapters 2 to 10 of the ten new trees

Paused on 2026-09-27 when the account hit its usage limit. Everything needed to finish is in the repo; nothing depends on the old session's scratchpad.

## Where things stand

| Tree | Skill ID | State |
|---|---|---|
| Logic | `mind.logic` | All 100 levels merged (draft) |
| Probability | `mind.probability` | All 100 levels merged (draft) |
| Psychology | `mind.psychology` | All 100 levels merged (draft) |
| Computers & the Internet | `world_systems.computers` | All 100 levels merged (draft) |
| Earth, Weather & Climate | `geography.earth_climate` | All 100 levels merged (draft) |
| Literature | `arts.literature` | All 100 levels merged (draft) |
| Philosophy | `mind.philosophy` | All 100 levels merged (draft) |
| World Religions | `mind.religions` | All 100 levels merged (draft) |
| Film & TV | `arts.film_tv` | Ch 1 merged. Ch 2 to 7 written, saved in `drafts/`. **Ch 8, 9, 10 to write.** |
| US History | `history.us_history` | Ch 1 merged. **Ch 2 to 10 to write** (nothing was saved; all nine writers stopped before producing levels). |

So 12 chapters remain: Film & TV 8 to 10, US History 2 to 10.

Film & TV Chapter 7 finished its levels (they validate) but its writer stopped before reporting, so give it an extra read at review time.

## What is in `drafts/`

- `drafts/<skill>-ch<N>/content/`: a finished chapter saved as a delta (its ten level files, plus only the concepts, facts, sources and verification records it adds). `scripts/writing/merge_chapters.py` merges these exactly as it merged the full working copies (checked: identical output).
- `drafts/partial/`: generator scripts from writers that stopped mid-chapter (Film & TV 8 and 9). They hold researched facts and sources and point at the old scratchpad paths, so treat them as research notes a new writer may reuse, not as runnable builds.
- `drafts/` is outside `content/`, so the app, `validate:content` and `lint:copy` ignore it. Delete each chapter's folder once it is merged.

## How to resume

1. **Write the missing chapters.** For each one, give a subagent `docs/writing/chapter-writer-prompt.md` with the placeholders filled in (and the Chapter 5, Chapter 10 and US History extras it lists). For Film & TV 8 and 9, add: "Research notes from an earlier attempt are in `drafts/partial/<SKILL>-ch<N>/`; reuse what checks out." Run a handful at a time rather than twenty; each chapter costs roughly 250k to 380k subagent tokens.
2. **Save each finished chapter** right away, so a stop never loses it:
   `python3 scripts/writing/extract_chapter_delta.py <SCRATCH>/drafts/<skill>-ch<N>/content <skill> <N> drafts`
3. **Merge a tree once all nine chapters are in `drafts/`** (run from `brainscroll/`):
   - trial: `cp -r content /tmp/t && CONTENT=/tmp/t python3 scripts/writing/merge_chapters.py drafts <skill> 2 3 4 5 6 7 8 9 10`, then `npx tsx scripts/validate-content.ts --dir /tmp/t` should show 0 errors, and no new duplicate source URLs;
   - real: the same merge without `CONTENT`, then `python3 scripts/writing/thin_asides.py <skill>`, `npm run content:build`, `npm run check`;
   - check that no two sources share a URL (fold duplicates into one ID across the drafts first, keeping any ID already in the repo);
   - commit as "<Tree>: chapters 2 to 10 (draft)", push, and delete that tree's `drafts/` folders.

## After all ten trees are merged

1. **Rebalance every Level 100 Mastery Challenge** (all ten trees) so its questions span the whole tree; each was written seeing only Chapter 1 and Chapter 10. Check the Level 50 milestones the same way (they saw only Chapters 1 and 5).
2. **Known fixes:**
   - Computers L4: refresh the Unicode 18.0 character count.
   - Earth L41: the CO2 figure is dated June 2026; refresh it.
   - Probability L95 (COMPAS and race): sensitivity read.
   - Literature L96 should recall Levels 11, 12 and 47 (Norse myths, Ragnarok, Beowulf); L93 and L98 mention Poe and Frankenstein without pointing to Levels 71 and 63.
   - Religions L99 repeats L33's "Allah is the Arabic word for God" card; swap in a different myth.
   - Film & TV: `source.brit_film_editing` is titled "Film: Editing" but its URL is Britannica's colour and black-and-white section. Ch 4 cites it for editing, Ch 5 for colour; split it into two correct sources.
   - Momaday's 1969 Pulitzer (Literature L80) stretches the "prizes only where they are the point" rule; cut if preferred.
3. **Source review before publishing.** Writers flagged these as thin or worth a human eye:
   - Philosophy: course copies of Ryle, Turing and Nagel hosted by universities (acceptable?); Cohen on Nozick, Spelman on Beauvoir, Skinner on Machiavelli, Nozick on Marx, Nagel's "The Absurd" and Baier rest on thin corroboration; Utilitarianism.net is cited for Singer; Russell's 1959 line on Wittgenstein was checked only secondhand.
   - Literature: a few Britannica quotes were read through summaries (Ibsen, Crime and Punishment, Chekhov lines); much Chapter 5 corroboration is Wikipedia only.
   - Religions: archived BBC Religions pages (Ch 4 and 5) are outside the preferred publishers; some Ch 3 and Ch 8 checks rest on faith-body sites or search snippets; Ch 9's canon-law claim and two unopened sources (OHCHR on Baha'is, Pluralism Project on zakat); Ch 5's "one lifetime" claim rests on one Encyclopedia.com page; Ch 7 reuses an earlier attempt's corroboration (much of it Wikipedia), and L67's restricted-knowledge fact rests on one archivists' case study.
   - Film & TV: Walt Disney Family Museum (studio-linked?), the Final Draft blog, Bordwell's blog and an EBSCO research starter.
   - Earlier trees: weak corroborations listed in each merge's writer notes; run `npm run verify:flag-weak`.
4. Then owner approval and the full claim review, as for the earlier trees. Only a human sets `verified`.

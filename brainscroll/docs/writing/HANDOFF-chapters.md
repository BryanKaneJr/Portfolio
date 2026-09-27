# Handoff: the ten new trees after writing

All ten trees are fully written as of 2026-09-27 (1,000 draft levels). What follows is the review work before anything is published.

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
| Film & TV | `arts.film_tv` | All 100 levels merged (draft) |
| US History | `history.us_history` | All 100 levels merged (draft) |


## Tooling, if chapters are ever rewritten

Writer brief: `docs/writing/chapter-writer-prompt.md`. Save each finished chapter with `scripts/writing/extract_chapter_delta.py` into `drafts/`, trial-merge with `CONTENT=<copy> scripts/writing/merge_chapters.py drafts <skill> <chapters>`, check for 0 errors and no two sources sharing a URL (fold duplicates into one ID, keeping any ID already in the repo), then merge, run `scripts/writing/thin_asides.py`, `npm run content:build` and `npm run check`.

## What is left before publishing

1. **Rebalance every Level 100 Mastery Challenge** (Film & TV's and US History's already span Chapters 1 to 7 and 10, so they only need a question or two from Chapters 8 and 9; the other eight saw only Chapters 1 and 10) so its questions span the whole tree; each was written seeing only Chapter 1 and Chapter 10. Check the Level 50 milestones the same way (they saw only Chapters 1 and 5).
2. **Known fixes:** done on 2026-09-27, except one owner call: Momaday's 1969 Pulitzer (Literature L80) stretches the "prizes only where they are the point" rule; cut it if you prefer. (Checked and left as is: Computers L4's Unicode 18.0 count and Earth L41's June 2026 CO2 figure are current; Probability L95 on COMPAS passed a sensitivity read.)
3. **Source review before publishing.** Writers flagged these as thin or worth a human eye:
   - Philosophy: course copies of Ryle, Turing and Nagel hosted by universities (acceptable?); Cohen on Nozick, Spelman on Beauvoir, Skinner on Machiavelli, Nozick on Marx, Nagel's "The Absurd" and Baier rest on thin corroboration; Utilitarianism.net is cited for Singer; Russell's 1959 line on Wittgenstein was checked only secondhand.
   - Literature: a few Britannica quotes were read through summaries (Ibsen, Crime and Punishment, Chekhov lines); much Chapter 5 corroboration is Wikipedia only.
   - Religions: archived BBC Religions pages (Ch 4 and 5) are outside the preferred publishers; some Ch 3 and Ch 8 checks rest on faith-body sites or search snippets; Ch 9's canon-law claim and two unopened sources (OHCHR on Baha'is, Pluralism Project on zakat); Ch 5's "one lifetime" claim rests on one Encyclopedia.com page; Ch 7 reuses an earlier attempt's corroboration (much of it Wikipedia), and L67's restricted-knowledge fact rests on one archivists' case study.
   - Film & TV: Walt Disney Family Museum (studio-linked?), the Final Draft blog, Bordwell's blog and an EBSCO research starter; Ch 8 and 9 reuse an earlier attempt's corroboration; Ch 10's Ju Dou red reading and the Boltz music study rest on thin second pages.
   - US History: to save credits, Ch 2 to 7 writers confirmed many facts from search-result summaries rather than full pages; their verification evidence says "via search" or "not opened in full". Check those first. Ch 5's Level 50 milestone covers only Chapter 5. Ch 10's L95 and L96 were written without seeing Ch 8's L76 and L78, so check they don't repeat or contradict them.
   - Earlier trees: weak corroborations listed in each merge's writer notes; run `npm run verify:flag-weak`.
4. Then owner approval and the full claim review, as for the earlier trees. Only a human sets `verified`.

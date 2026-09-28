# Full claim review

## The ten new trees (2026-09-28)

Every claim in the ten new trees (6,062) was checked by two AI reviewers per tree, one for claims first shown in Levels 1 to 50 and one for Levels 51 to 100. Results are in `<skill>.a.jsonl` and `<skill>.b.jsonl`, recorded on each claim's verification records as `review` (`record_full_pass.py 2026-09-28 '*.[ab].jsonl'`). As before, a review is never a verification.

| Tree | OK | Soften | Fix |
| --- | --- | --- | --- |
| US History | 748 | 15 | 1 |
| Logic | 404 | 10 | 1 |
| Probability | 465 | 5 | 0 |
| Psychology | 611 | 7 | 0 |
| Philosophy | 588 | 4 | 0 |
| World Religions | 724 | 5 | 0 |
| Literature | 722 | 12 | 2 |
| Film & TV | 633 | 8 | 1 |
| Computers & the Internet | 572 | 9 | 3 |
| Earth, Weather & Climate | 504 | 6 | 2 |
| **Total** | **5,971** | **81** | **10** |

6,060 claims were checked against a page opened during the review; 2 were judged from knowledge (both general definitions in US History, now listed in `../weak-claims.md`). Every claim whose earlier evidence came from search summaries or unopened pages was re-checked against a page.

All 91 changes are in the content, with the old wording kept as `factCheck.previousText` on each record. The ten fixes:
- Film & TV: Emil Jannings kept working in German sound films.
- Literature: Balder returns from the dead after Ragnarok; in "Ozymandias", "Nothing beside remains" is the traveller's comment, not words on the pedestal.
- Earth: the Paleozoic began about 539 million years ago (ICS 2024 chart); the solar-geoengineering points are credited to NOAA, not GAO.
- US History: the Levittown covenant's wording.
- Logic: Juvenal wrote in the early second century CE.
- Computers: the Mars Climate Orbiter mismatch was between two pieces of ground software; the music experiment ran in 2004 and 2005; Pets.com's $147 million was its total loss since founding.

Softened claims were mostly superlatives ("first", "oldest") and figures stated more exactly than sources allow; fixers also updated every card sentence and question that repeated them.

## The first 16 trees (2026-09-26)

Every claim in all 16 trees (10,193) was checked by an AI reviewer against sources, one reviewer per tree. Results are in `<skill>.jsonl`, one line per claim, and are recorded on each claim's verification records as `review` (`scripts/verification/record_full_pass.py`). A review is never a verification: publishing rests on the owner's approval by sample (`content/approvals.json`).

| | Claims |
| --- | --- |
| OK | 10,145 |
| Soften (overstated; reworded) | 25 |
| Fix (factual error; corrected) | 23 |
| Checked against a page (`method: page`) | 9,252 |
| Judged from knowledge (`method: knowledge`) | 941 |

All 4,444 claims that earlier checks had tagged as weakly backed were checked against a page. `knowledge` was allowed only for stable, well-known facts with no specific number, date or superlative.

## Fixed
All 48 are corrected in the content, with the evidence on each claim's verification record. Examples: Abu Simbel was moved in about 1,040 blocks, not 16,000; the 1884 Meridian Conference chose Greenwich but did not adopt time zones; Aconcagua lies wholly in Argentina; Leeuwenhoek first saw bacteria in 1676; the Greeks did run torch relays, just not from Olympia.

## Borderline items: resolved
The reviewers also noted about 20 claims they judged acceptable but imprecise. At the owner's request all were tightened: for example Neanderthal DNA now "about 1 to 2 percent", the atom analogy is now a true-to-scale grain of sand on a football field, comet tails no longer "always" point away from the Sun, and the Carrington Event is "one of the most intense" storms on record. Each changed claim's verification records note the correction.

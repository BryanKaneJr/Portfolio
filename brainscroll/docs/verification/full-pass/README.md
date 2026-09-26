# Full claim review (2026-09-26)

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

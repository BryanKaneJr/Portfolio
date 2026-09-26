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

## Borderline: left as they are, for the owner to rule on
Reviewers judged these acceptable but noted them. Say the word and any can be changed.

- **Human Body:** Neanderthal DNA "1 to 4 percent" (the 2022 Nobel figure; newer estimates are 1 to 2); altitude sickness "fades in 2 to 5 days" (most sources say 1 to 3); variolation deaths "2 to 3 percent" (some sources give 1 to 2).
- **Chemistry:** card 013.c3 calls a blueberry in a stadium "true to scale" for an atom, but that ratio is closer to 1 in 10,000 than the card's own 1 in 100,000; warmed iodine "skips the liquid step" (it can melt if heated strongly); Priestley's mouse test was 1775, the gas 1774.
- **Oceans:** "the Kuril-Kamchatka Trench goes below 10,000 m" (the cited sources say so; some newer surveys put it nearer 9,600 m).
- **Rome:** Level 54's hook calls Nero "a teenage emperor" in the story of the fire of 64, when he was 26 (he took the throne at 16); card 090.c2 names Rome as a capital in 395, when the western court was at Milan.
- **Architecture:** Bosco Verticale has 800 trees (the architect) or 900 (Arup); card 058.c1 says Pisa's tower began leaning at "two floors" (floor-counting varies).
- **Middle Ages:** Hindu-Arabic numerals "originated in the 6th or 7th century" (Britannica; others say earlier); Richard III's skeleton "found in September 2012" (uncovered 25 August, recovered in September).
- **Art History:** Morisot "outsold" Monet at the 1875 sale (her top price and her average across the lots that sold were higher; her average across all 12 works was not).
- **Astronomy:** comet tails "always" point away from the Sun; the Carrington Event as the "strongest solar storm on record".
- **Animals:** red kangaroo males "about 2 m tall" (Guinness: about 1.8 m standing normally).

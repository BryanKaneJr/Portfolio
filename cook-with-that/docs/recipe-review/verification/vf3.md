# vf3: published-recipe check, beef.ts (25) and weeknight.ts (21)

46 recipes: **45 confident, 1 fixed, 0 cut.** Scores: 33 at 5 and 13 at 4.

Each recipe's deciding facts were compared with 2–4 published versions, listed in `verdicts.json`. The facts were: liquid to grain or pasta, roux to liquid, sauce ratios, oven temperature and time for the pan, braise or simmer time, and doneness. No wording, steps or full formulas were taken from any source.

## Cuts
None. Every dish is a well-documented classic, and its key numbers fall inside the range the published versions use.

## Fixes
- **chicken-and-wild-rice-soup**: flour raised from **1/3 cup to 1/2 cup**.
  - The recipe is billed as a creamy Minnesota-style soup, but its thickener was below every source: 1/3 cup flour to 7 1/2 cups liquid, about 0.7 tbsp per cup.
  - The sources use 1–2 tbsp per cup. Taste of Home and Balancing Motherhood use 1/2 cup flour to 7–8 cups; Iowa State uses 1 cup to 9 cups.
  - Nothing else changed. The step doesn't give the amount, so no wording needed editing.

## Near the edge but left alone (inside the published range, or close enough to work)
- **beef-and-black-bean-enchiladas**: the sauce uses 3 tbsp flour to 3 cups broth, slightly thinner than the 2–4 tbsp to 2 cups in the sources. It is simmered with tomato paste and baked uncovered, which suits enchiladas. Score 4.
- **beef-empanadas**: the dough uses 1 stick butter to 3 cups flour, leaner than US flaky doughs (1–1 1/2 sticks to 2 1/4–3 cups). It is still a workable baked empanada dough and close to traditional lard doughs. Score 4.
- **mongolian-beef**: less sweet than the copycat versions (1/2 cup soy to 1/3 cup brown sugar), but inside the 2:1 to 1:1.5 soy-to-sugar range. Score 4.
- **salisbury-steak-with-mushroom-gravy**: 2 tbsp flour to 2 cups broth, at the thin end of the sources' range (1 to 2 2/3 tbsp per cup). Score 4.
- **corned-beef-and-cabbage**: the vegetables get 22–25 minutes against 25–45 in the sources. The potatoes are halved small ones and the step ends on "until tender". Score 4.

## Provenance flags
- **cheeseburger-soup**: the soup base matches **Taste of Home's Cheeseburger Soup** (1996): 4 tbsp butter, 1/4 cup flour, 3 cups chicken broth, 1 1/2 cups milk, 3/4 tsp salt and 8 oz cheese are all the same.
  - Ours differs in beef (1 lb vs 1/2 lb), cheese (cheddar vs Velveeta), potatoes (1 1/2 lb vs 1 3/4 lb), the order of the method, and the added mustard and Worcestershire. It has no sour cream.
  - It is not a word-for-word copy, but the liquid base is the same formula. Per the brief, it was left as is and flagged for the owner.
- Nothing else matched one published recipe across the board.

## Check
`npm run check` passes after the fix: tsc clean, "668 recipes and 399 ingredients passed validation", and Jest 11/11 suites and 874/874 tests (exit 0). The full log is in `check.log`.

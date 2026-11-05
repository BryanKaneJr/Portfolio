# vf4 review: porkSeafood.ts (26) and soupsSaladsDips.ts (20)

46 recipes checked against published versions (ATK and Cook's Illustrated, Food Network, BBC Good Food ME, Serious Eats/Food Lab via reprint, RecipeTin Eats, Once Upon a Chef, Sunset, MSC, Rick Stein and others; the URLs for each recipe are in `verdicts.json`).

| Verdict | Count |
|---|---|
| Confident | 44 (34 scored 5, 10 scored 4) |
| Fixed | 2 (both scored 4) |
| Cut | 0 |

`npm run check` passes: typecheck, 668 recipes and 399 ingredients validated, 11 of 11 suites and 874 of 874 tests.
On the first baseline run one jest worker was killed with SIGKILL (the container was short on memory). That suite
passed when run alone, and both full runs after the edits passed cleanly.

## Cuts
None. Every recipe is a well-established dish, and its deciding numbers fall inside the range that published versions use.

## Fixes (`patch.diff`)
1. **pork-schnitzel**: 1 cup of oil in a "large skillet" is only about 1/8–3/16 inch deep. That is too shallow for
   the recipe's own step 6 (swirl the fat over the tops so the crust puffs) and below the house rule's 1/4 inch for the
   Fried dish type. ATK uses 2 cups of oil in a Dutch oven, and other versions use 1/8 to 1 inch.
   - The oil is now 1 1/2 cups.
   - The skillet is named as 12-inch, and the step says the fat should be "about 1/4 inch deep".
2. **rosemary-garlic-lamb-chops**: for 1 1/4-inch loin chops, the basting after the flip was 2–3 minutes. That is short
   of the published range: ATK's chops of the same thickness get about 2 minutes per side plus 3–5 minutes more, and
   other versions use 4 minutes or more after flipping.
   - Basting is now "3–5 minutes".
   - The 130°F target and the USDA sentence (house rule 13) are unchanged.

## Scored 4 rather than 5 (sound, but worth knowing)
- **cajun-shrimp-and-rice-skillet**: the liquid (1 1/2 cups broth plus an undrained can of tomatoes per cup of rice) is
  inside the range of published stovetop versions. Tomato acidity makes rice timing a little less predictable.
- **pork-carnitas-tacos**: uses less water than Food Network and no added lard. It still works, because the shoulder
  renders enough fat.
- **sausage-potato-and-green-bean-sheet-pan**: 35–40 minutes for raw links is at the short end of 40–45. The 160°F
  check covers the difference.
- **beer-battered-fish-and-chips**: thick cod for 5–7 minutes at 375°F is at the long end of the published 3–7 minutes.
- **tuna-pasta-bake**: the sauce is looser than BBC's and closer to US baked pastas. It works.
- **sausage-and-white-bean-casserole**, **lamb-gyros-with-tzatziki**, **shrimp-pad-thai**, **hot-and-sour-soup**,
  **chicken-mulligatawny-soup**: all sound and in range, but more variable dishes.

## Provenance flags
None of these 46 matches a single published recipe across the board. Close overlaps I looked at and did **not** flag:
- **chipotle-black-bean-dip** shares Wonky Wonderful's natural two-can amounts: 1 garlic clove, 1 chipotle, 1 tbsp
  adobo, 1 lime, 2 tbsp oil. Ours differs in cumin (1 tsp vs 1/4 tsp), measured salt, added water and the optional
  warm-up. This is the closest overlap in the batch, and worth a glance if the owner wants to be strict.
- **shrimp-pad-thai** matches ATK's older Pad Thai on 8 oz noodles, 3 tbsp fish sauce and 3 tbsp sugar. Its tamarind
  amount and handling differ.
- **hot-and-sour-soup** shares the dish's stock numbers with ATK (6 cups broth, 1 tsp white pepper, pork in a soy and
  cornstarch coating). Tofu, vinegar, eggs and soy all differ.
- **panzanella** uses the widely published salt-and-drain technique (also in Kenji López-Alt's Food Lab version). Its
  quantities and other ingredients differ.
- **queso-dip-with-green-chiles** uses the standard evaporated milk and cornstarch method. RecipeTin uses 8 oz cheese
  to our 12, with no aromatics.

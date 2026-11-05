# vf1 review: 27 seed recipes + 20 sides/appetizers originals

Checked 47 recipes (`src/data/recipes.ts` seed recipes and `src/data/originals/sidesAppetizers.ts`) against 2–3
published versions each. For each one I compared the deciding ratios and the oven or stove times. Sources and notes
for each recipe are in `verdicts.json`.

## Counts
| Verdict | Count | Scores |
|---|---|---|
| Confident | 46 | 43 × 5, 3 × 4 |
| Fixed | 1 | 1 × 5 |
| Cut | 0 | |

The three scored 4 are confident but weaker:
- `chicken-spinach-garlic-pasta`: a light broth sauce that leans on pasta water.
- `creamy-chicken-spinach-pasta`: cream is at the low end of the range, 1 cup per 12 oz pasta.
- `easy-tomato-soup`: a 15-minute simmer, where others run 30–40 minutes. It still works because the tomatoes are canned.

## Cuts
None. Every recipe is a well-documented dish, and its deciding numbers fall inside the range the published versions use.

## Fixes
- **classic-grilled-cheese**: The cold-pan, medium-low method is correct. The times were 3–4 minutes a side, which is
  short for a sandwich started in a cold pan. Published low-heat versions use these times:
  - The Takeout (cold pan): 5–7 minutes, then 4–5.
  - Kitchen Treaty: about 5 + 5.
  - Cook's Illustrated: 5–10 minutes per side.

  I changed the steps to 5–7 and 4–5 minutes, and `cookMinutes` from 8 to 11. Nothing else changed.

## Provenance flags (left unchanged; owner to decide)
- **chocolate-chip-cookies**: This is effectively the Original Nestlé Toll House recipe. These quantities and settings
  are identical:
  - 2 1/4 c flour and 1 tsp baking soda
  - 1 c butter, 3/4 c granulated sugar and 3/4 c brown sugar
  - 2 eggs and 2 c chips
  - 375°F for about 9–11 minutes

  Only the salt (3/4 vs 1 tsp) and vanilla (2 vs 1 tsp) differ. The method follows the standard creaming order, and
  our wording is our own.
- **fluffy-pancakes** (partial): The flour, milk, egg and butter are identical to Allrecipes' "Good Old-Fashioned
  Pancakes" (1 1/2 c, 1 1/4 c, 1 egg, 3 tbsp melted) and the many blog versions derived from it. Our baking powder
  (1 tbsp vs 3 1/2 tsp), sugar (2 vs 1 tbsp) and salt (1/2 vs 1 tsp) differ. This looks like a widely shared base
  ratio rather than a copy, but it is worth knowing.

No other recipe matched one specific published recipe across the board. Guacamole, three-bean salad and overnight
oats use the generic formulas many sources share.

## Check
`npm run check` passes after the fix: 668 recipes and 399 ingredients validated, and 874 of 874 tests pass.

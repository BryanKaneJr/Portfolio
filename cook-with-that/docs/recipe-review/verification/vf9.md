# vf9 review: bakingBreakfast.ts (20) and grillFry.ts (20)

**Counts:** 40 recipes: 38 confident, 2 fixed, 0 cut.
**Scores:** 30 recipes at 5, 10 at 4 (including both fixes).
**`npm run check`:** passes after the fixes (668 recipes validated; 11 suites, 874 tests).

## Cuts
None. Every recipe's key ratios, temperatures and doneness checks fall inside the range that published versions use,
or could be brought there with a small change.

## Fixes (patch.diff)
1. **tres-leches-cake.** The bake for the 1-cup-flour, 5-egg sponge in a 9x13 at 350°F was 20–25 minutes. Published
   versions of this sponge give 25–30, 25–35 and 35–45 minutes, so ours was short. I changed it to **25–30 minutes**
   (`cookMinutes` 25 → 30). The toothpick check is unchanged.
2. **vegetable-tempura-with-soy-ginger-dipping-sauce.** The batter had 1 egg plus 3/4 cup ice water for 1 cup flour
   and 2 tbsp cornstarch. That is noticeably thicker than published tempura batters, which use about equal volumes of
   egg-plus-water and flour (1 egg plus 200–240 ml water per cup of flour), and a thick batter gives a heavier coat
   than the "lacy" one the recipe promises. I raised the batter water to **1 cup**: the ingredient line is now
   1 1/4 cups divided, and the dipping sauce keeps its 1/4 cup.

## Provenance flags (no changes made)
- **tres-leches-cake.** The sponge matches The Pioneer Woman's Tres Leches quantity for quantity: 1 cup flour,
  1 1/2 tsp baking powder, 1/4 tsp salt, 5 eggs separated, 3/4 cup + 1/4 cup sugar, 1/3 cup milk and 1 tsp vanilla.
  The soak (same two cans; 1/2 cup cream vs her 1/4 cup) and topping (about 2 cups cream with 3 tbsp sugar) are close
  too. The method wording is ours. Many sites reprint this exact sponge.
- **gingerbread-cookies.** Flour, baking soda, butter, brown sugar, molasses, egg, vanilla, cinnamon and nutmeg match
  McCormick's Gingerbread Men Cookies quantity for quantity (3 c, 1 tsp, 3/4 c, 3/4 c, 1/2 c, 1, 1 tsp, 2 tsp,
  1/4 tsp), as do the 1/4-inch roll and 350°F for 8–10 minutes. Ginger (1 tbsp vs 2 tsp), cloves (added) and salt
  (1/2 vs 1/4 tsp) differ.
- **chocolate-fudge.** 3 cups semisweet chips, one 14-oz can of condensed milk, 1 1/2 tsp vanilla, salt and nuts is
  the Eagle Brand label formula, which is reprinted almost everywhere. Ours adds 2 tbsp butter and puts the nuts on
  top.

## Notes on the rest
- **Frying temperatures** all sit inside the published ranges: churros, coconut shrimp, po' boys, catfish, pakoras,
  hush puppies and fried green tomatoes at 350°F; onion rings at 375°F; tostones at 325°F then 375°F (same as ATK);
  Korean wings at 325°F then 375°F; fried chicken going in at 350°F and held at 300–325°F (Cook's Illustrated
  holds 305–315°F).
- **Baking ratios** checked against published versions: leavening per cup of flour (muffins, zucchini bread, hush
  puppies, soda bread), gelatin per cup of liquid (panna cotta, slightly firm for turning out), focaccia hydration
  (about 83%), frangipane (equal weights of butter, sugar and almond), and cherry filling (6 cups fruit to 1/4 cup
  cornstarch).
- **Irish soda bread** totals 35–40 minutes, at the short end of the published 35–45. I left it, since the hollow-tap
  test catches an underbaked loaf (score 4).
- **Grill recipes** follow the house rules: carne asada at 130°F with the exact USDA sentence; pork 145°F; chicken
  165°F; burgers 160°F; fish and shrimp 145°F.

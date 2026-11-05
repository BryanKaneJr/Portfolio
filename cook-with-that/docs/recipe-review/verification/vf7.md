# vf7 review: breakfastSides.ts (25) and breakfast.ts (20)

**45 recipes: 44 confident, 1 fixed, 0 cut.** Scores: 34 at 5, 11 at 4.

Each recipe was checked against 2–4 published versions for its deciding facts: ratios, oven temperature and time for the pan, method and doneness. The URLs are in `verdicts.json`. No wording, steps or full formulas were taken from any source.

## Cuts
None. Every recipe is a recognizable classic, and its key numbers fall inside the range published versions agree on.

## Fixes (1)
- **cilantro-lime-rice**: rinsed long-grain rice at 1.5:1 water was simmered only 15 minutes. ATK uses the same rinsed 1.5:1 ratio but simmers 18–20 minutes (Basic White Rice; Everyday White Rice). Other cilantro-lime recipes simmer 18–25 minutes. With a lean water ratio, 15 minutes risks firm rice. I raised the covered simmer to **18 minutes**, which matches our own rice-pilaf recipe, and changed `cookMinutes` from 30 to 35. Nothing else changed. Score 4.

## Provenance flags
- **baked-berry-oatmeal**: closely shaped on Heidi Swanson's baked oatmeal (*Super Natural Every Day*; reprinted at lottieanddoof.com). The two share:
  - 2 cups oats, 1 tsp baking powder, 1/2 tsp salt, 1/3 cup maple syrup and 3 tbsp butter
  - 1 1/2 cups berries, with two-thirds under the oats and one-third on top with walnuts
  - an 8-inch square dish at 375°F

  Ours differs in eggs (2 vs 1), milk (1 3/4 vs 2 cups), cinnamon (1 vs 1 1/2 tsp) and vanilla (1 vs 2 tsp), and it has no bananas. That is not the same quantities across the board, but the structure is distinctive. Per the brief, I left it unchanged; the owner can decide whether to vary it.

## Close to common formulas, not flagged
These share a widely published method or ratio but differ in their quantities.
- **buffalo-chicken-wings**: uses the Cook's Country baking-powder method (250°F, then 425°F), which RecipeTin Eats and others also publish. Ours uses 3 lb of wings where Cook's Country uses 4 lb, and its salt and garlic powder differ.
- **dutch-baby-pancake**: the 3 eggs, 2/3 cup milk and 2/3 cup flour ratio appears in several places (Betty Crocker, Palatable Pastime, CTV).
- **tex-mex-migas**: 8 eggs and 6 tortillas for 4 servings also appears in ATK and NPR. Our vegetables and cheese differ.

## House rules
- **Rule 14 (salt):** where a recipe has no added salt (spinach-artichoke dip, croque madame, ham and Swiss strata), ham or cheese already seasons it.
- **Rule 12 (eggs):** none of these recipes carries an egg warning.
- **Rule 13:** no steak or lamb chops are in this set.

## Check
`npm run check` passes: typecheck, 668 recipes and 399 ingredients validated, 11 of 11 test suites and 874 tests.

A note on the first baseline run: one test suite (searchAudit) died when a jest worker was killed (SIGKILL), most likely from memory pressure, since several checkers are running at once. Re-run on its own, it passed. The full check after my fix also passed cleanly.

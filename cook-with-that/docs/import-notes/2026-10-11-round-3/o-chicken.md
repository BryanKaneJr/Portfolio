# o-chicken: handoff notes

Theme file: `src/data/originals/chicken.ts` (`CHICKEN_RECIPES`), 25 original chicken and turkey mains, all
`source: ORIGINAL_DRAFT`, written from general cooking knowledge (no published recipe opened). In my worktree
`npm run check` passes: 220 recipes, 263 ingredients, 387 tests. `npm run coverage-report` with only my recipes added:
common 2-ingredient pairs 80% → 85% exact, triples 30% → 41%.

## Read first: one existing step changed in my worktree only (integrator decision)

Adding `hot sauce` to the catalog makes `tests/import.test.ts` fail on `chicken-paprikash`, whose step says "whisk a
ladle of the **hot sauce** into the sour cream" (it means the hot pan liquid). o-breakfast-sides hit the same clash.
I made **the same one-word change they did**, in my worktree only, so `npm run check` passes:
"…a ladle of the **hot pan sauce** into the sour cream…" (`src/data/imported/basedCooking.ts`). It is **not** in my
handoff files. Apply it once when `hot sauce` lands (o-breakfast-sides brings it too).

## Worktree setup
My worktree was created at `c061183a` (master, 124 recipes). Before changing anything I moved my worktree branch to
`0759aea8` (`claude/cook-with-that-recipe-sources`) with `git reset --hard`. That is the same result as the
coordinator's `git merge --ff-only` (c061183a is an ancestor). `diff -rq` against the main checkout's `src/`,
`scripts/`, `tests/` and `docs/` showed no differences. Baseline: 195 recipes, all tests passing.

## Recipes added (25), in gap-filling order

Library-gap pairs are **required** on both sides wherever they appear.
1. **Chicken Burrito Bowls**: cilantro-lime rice, black beans, charred corn, fresh pico, cheddar. Fills **chicken +
   black beans**, **chicken + cheddar** and **black beans + tomato**.
2. **Southwest Chicken and Black Bean Skillet**: fills **chicken + black beans**, **black beans + bell pepper**,
   **black beans + tomato** and **chicken + cheddar**.
3. **Chicken, Broccoli and Rice Casserole**: from-scratch cheddar sauce, panko top. **Chicken + cheddar**.
4. **Chicken and Pepper Quesadillas**: **chicken + cheddar**.
5. **Cheesy Chicken Enchiladas**: corn tortillas and a homemade red chili sauce made from the poaching broth, so no
   new "enchilada sauce" key was needed. **Chicken + cheddar**.
6. **Greek Lemon Chicken and Rice**: one pan, oven-baked; spinach wilted into the rice. Fills **rice + spinach**.
7. **Teriyaki Chicken Rice Bowls with Broccoli**
8. **Chicken Alfredo with Broccoli**
9. **Chicken Fajitas**
10. **Classic Chicken Pot Pie**: homemade all-butter top crust in a 9-inch deep-dish pie plate.
11. **Lemon Herb Chicken Thighs with Roasted Potatoes**
12. **Chicken Tikka Masala**: the chicken is seared in the pot rather than broiled, so it stays one pot. Blending the
    sauce is optional.
13. **Chicken Cacciatore**
14. **Chicken Piccata**
15. **Chicken Marsala**
16. **Chicken and Dumplings**: drop dumplings (tagged one_pot and soup).
17. **Jambalaya with Chicken and Sausage**: with andouille. The Cajun seasoning is mixed from catalog spices.
18. **Buffalo Chicken Wraps**: buffalo sauce is hot sauce plus butter; the cool dressing is sour cream, mayonnaise and
    dried dill, so no blue-cheese or ranch key was needed.
19. **Kung Pao Chicken**
20. **Honey Mustard Chicken Thighs**: honey and Dijon.
21. **Chicken Shawarma Bowls**
22. **BBQ Chicken Pizza**
23. **White Bean Turkey Chili**
24. **Roast Turkey Breast with Pan Gravy**: the library's first whole-cut turkey recipe.
25. **Weeknight Coq au Vin**

## Skipped from my list (28 dishes, 25 written; no swaps needed)
- **Chicken Fried Rice with Peas and Carrots**: near-duplicate of the library's *Arroz Chaufa (Peruvian Chicken Fried
  Rice)* and the seed *Vegetable Fried Rice*, which together already cover chicken fried rice with egg and peas/carrot.
- **Thai Basil Chicken**: it would need Thai or holy basil and Thai chilies as new catalog items (the catalog's basil
  is Italian), and it fills no gap.
- **Turkey Taco Lettuce Wraps**: closest to the library's *Taco Meat* and the weakest of the remaining dishes.

## Near-overlaps I kept on purpose (different dishes)
- Teriyaki Chicken Rice Bowls vs *Honey Garlic Chicken with Broccoli and Brown Rice*: the teriyaki sauce is thickened
  and has ginger and vinegar, the bowls use white rice, the chicken is thighs, and the honey-garlic dish has peas.
- Chicken Alfredo with Broccoli vs *Shrimp Fettuccine Alfredo*: a different protein, and the sauce here is a classic
  cream reduction (the shrimp dish uses cream cheese).
- Chicken Marsala vs *Chicken and Mushroom Fricassee*: sautéed cutlets in a wine pan sauce vs a braised stew.

## Catalog (see catalog-keys.txt and map-entries.ts.txt)
New keys I reviewed: `marsala wine` (pantry, aliases marsala, dry marsala), `andouille sausage` (protein, alias
andouille), `turkey breast` (protein), `barbecue sauce` (spice; same key and category as o-pork-seafood),
`dried red chilies` (spice, alias dried red chiles). Keys that were already reviewed and that I put in the catalog:
`hot sauce`, `romaine lettuce` (alias romaine), `peanuts`, `sesame seeds` (alias sesame). Every one is in the shared
registry. I briefly added `sichuan peppercorns`, then withdrew it: the recipe would have needed it required (optional
is for garnish only), and that would have made Kung Pao hard to match. It is not in my map or catalog. The registry has
a "withdrawn" line for it.

Watch for: the `sesame` alias of `sesame_seeds` means a step saying "sesame" without "oil" counts as sesame seeds.

## Units
Every quantity and step converts in metric mode. Peanuts have no cup weight, so "1/2 cup" shows as 120 ml. Consider
`peanuts: 145` in `GRAMS_PER_CUP` (I didn't touch `src/logic`).

## For the culinary reviewer
- **Poultry doneness** is 165°F / 74°C everywhere, ground turkey included. Bone-in thighs are juicier at 175°F+, but I
  kept the house rule.
- **Ratios worth a check by cooking:**
  - Greek Lemon Chicken and Rice: 1 1/2 cups rice, 2 1/4 cups broth and 2 tbsp lemon juice, at 375°F (190°C),
    covered 25 minutes then uncovered 15–20.
  - Jambalaya: 2 cups rice, 3 1/4 cups broth and a 14.5 oz can of tomatoes, 20–25 minutes covered on low.
  - Casserole: the rice is par-cooked and the broccoli goes in raw for about 33 minutes at 375°F.
- **Turkey breast** (6–7 lb, bone-in): 20 minutes at 425°F (220°C), then 1 1/2–2 hours at 350°F (175°C), to 165°F.
- **Equipment:** an instant-read thermometer is assumed throughout. Tikka masala optionally uses a blender. Pot pie
  needs a 9-inch deep-dish pie plate. Greek rice needs a 12-inch ovenproof skillet or braiser with a lid or foil.
- **Kung Pao** uses rice vinegar. It is a choice, not a stand-in for Chinese black vinegar, which the catalog lacks.
  The recipe tells diners not to eat the whole chilies.

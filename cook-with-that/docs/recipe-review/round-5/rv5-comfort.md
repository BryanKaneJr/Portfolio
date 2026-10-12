# rv5-comfort: paper review of `src/data/originals/comfort.ts`

## Summary

- **Reviewed:** all 20 recipes in `COMFORT_RECIPES`, read as a cook against REVIEW.md, the audit flags and the writer's
  cook-test list (`docs/import-notes/2026-10-11-round-5/r5-comfort.md`).
- **Fixed:** 6 recipes, each with a small change. No ids, titles, ingredients or quantities changed. No catalog additions.
- **Questions for the owner:** 3, all minor. No recipe I'd drop.
- `npm run check` passes: tsc, 668 recipes and 399 ingredients validated, 874/874 tests. Prettier is clean.

The batch is sound. Every list matches its steps, including all the "divided" amounts (butter, salt, oil, thyme,
Parmesan, Worcestershire, cheddar), which I added up for each recipe. Every savory dish is seasoned. Doneness temperatures
are right: poultry 165°F, ground beef 160°F, pork chops 145°F with a rest, and braised chuck cooked to fork-tender.
Ingredient IDs match their display names. Optional lines are only garnishes or serve-withs, and the dish types fit.

## Fixed

- `southern-baked-macaroni-and-tomatoes`: the 2-quart dish (8-by-8 or 11-by-7) would be filled to the brim. 8 oz of
  cooked macaroni (~3.5 cups), 2 lb of stewed tomatoes (~3 cups), the onion and 1 cup of melted cheddar come to about
  7 1/2–8 cups before the top layer of cheese, and the dish then bubbles for 30 minutes. The writer listed this as a
  cook-test question. → Changed it to "a 9-by-9-inch or other 2 1/2- to 3-quart baking dish". The sheet pan under it
  stays.
- `twice-baked-potatoes-with-spinach-and-cheddar`: the second bake said only "Bake 15–20 minutes", 20+ minutes and
  three steps after the oven was last mentioned. A beginner might have turned the oven off or not know the temperature.
  → "Bake on the sheet pan, still at 425°F (220°C), for 15–20 minutes".
- `chicken-and-cherry-tomato-penne`: a plain 12-inch skillet has to hold the final toss of 12 oz cooked penne, 1 1/4 lb
  chicken, 1 1/2 lb of burst tomatoes and pasta water, about 10–11 cups. That nearly fills a sloped 12-inch fry pan, so
  it can't be tossed. → "a large, deep skillet (12-inch)", the wording the cheeseburger skillet in this file already
  uses.
- `chicken-divan-with-parmesan-sauce`: cookMinutes 50 was too low for the steps. Bringing the pot to a simmer and
  poaching takes ~25 min, blanching two batches of broccoli ~6, the sauce ~6, baking 20 and standing 5, about 60–65 in
  all. → cookMinutes 60.
- `chicken-tetrazzini`: the broken spaghetti was drained and then sat while the sauce cooked (about 18 minutes of
  mushrooms, wine and béchamel, started "meanwhile"). Drained spaghetti sets into a clump that won't separate in a thick
  sauce. → "Drain and rinse briefly with cool water so it doesn't stick together while the sauce cooks", the same
  treatment the tuna noodle casserole in this file gives its noodles.
- `baked-potato-bar-with-chili-and-cheddar`: the tagline said "Salt-crusted baked russets", but six potatoes share
  1 tsp of salt, which seasons the skin but doesn't make a crust. → "Crisp-skinned baked russets…" (the skins are oiled
  and baked straight on the rack until crisp).

## For the owner

1. **`beef-tips-and-gravy-over-rice` near-duplicate flag (audit: 64% shared with `classic-pot-roast-with-carrots-and-potatoes`).**
   Recommend **keep**. The two share chuck and pantry gravy ingredients, but beef tips is cubed chuck simmered on the
   stovetop in onion gravy and served over rice, with no whole roast, carrots or potatoes. The audit's `ratio` flag
   (3.83 cups of liquid per cup of rice) counts the 3 cups of gravy broth. The rice itself is 1 1/2 cups in 2 3/4 cups
   of water (1.8:1), which is right for long-grain white.
2. **`porcupine-meatballs-in-tomato-sauce`, the rice amount.** It has 1/2 cup raw rice to 1 1/2 lb beef. The usual
   proportion is about 1/2 cup per pound, so the "quills" will be sparser than the tagline suggests. The recipe still
   works: the rice is plenty to cook through in 50–60 covered minutes with the meatballs half in 5 cups of sauce and
   turned every 15 minutes. The `ratio` flag (3 cups of liquid per cup of rice) is the sauce, not a rice-cooking ratio.
   Recommend **leave as is**. If you want more visible quills, raise it to 3/4 cup.
3. **`roast-chicken-thighs-over-buttered-potatoes`, richness.** Six skin-on thighs render a good deal of fat onto
   potatoes that already have 3 tbsp butter. The potatoes are meant to soak it up, so it isn't wrong, but some cooks will
   find the pan greasy. Recommend **leave as is**. An optional tweak: add "tilt the dish and spoon off excess fat" before
   serving.

The writer's other cook-test questions check out on paper, with no change needed:
- `cheeseburger-macaroni-skillet`: 8 oz elbows in 2 1/2 cups broth, covered, plus 1/2 cup milk at the end. The elbows
  absorb about 1 1/2 cups, which leaves a creamy sauce, and the step already covers adding water if it runs dry.
- `one-pot-chili-mac-with-cheddar`: 2 cups broth plus the juice of the diced tomatoes and an 8-oz can of tomato sauce
  is ample for 8 oz elbows in 12–15 min.
- `skillet-pork-chops-with-potatoes-and-green-beans`: chops seared 3 min a side and then steamed 6–8 min over the
  vegetables should reach 145°F. The step gives the 145°F cue and a 3-minute rest, so a thicker chop just cooks longer.
- `chicken-divan-with-parmesan-sauce`: about 2 2/3 cups of medium-thin sauce coats the broccoli and chicken in a
  9-by-13. The dish isn't meant to swim.

## Checked, no change

`stovetop-broccoli-cheddar-mac-and-cheese`, `cheeseburger-macaroni-skillet`, `one-pot-chili-mac-with-cheddar`,
`sheet-pan-ranch-chicken-potatoes-and-broccoli`, `roast-chicken-thighs-over-buttered-potatoes`,
`hamburger-vegetable-soup`, `cheesy-beef-and-spinach-pasta-bake`, `spinach-and-cheddar-stuffed-chicken-breasts`,
`tuna-noodle-casserole-with-mushrooms-and-peas`, `swiss-steak-with-tomatoes-and-peppers`,
`beef-tips-and-gravy-over-rice`, `porcupine-meatballs-in-tomato-sauce`,
`skillet-pork-chops-with-potatoes-and-green-beans`, `patty-melts-on-rye`.

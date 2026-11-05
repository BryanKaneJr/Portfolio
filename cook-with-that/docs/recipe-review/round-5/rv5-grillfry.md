# rv5-grillfry review: round 5 grilled and fried originals (`src/data/originals/grillFry.ts`)

## Summary
- **20 recipes reviewed** (12 fried, 8 grilled), read as a cook against REVIEW.md, the editing checklist and the
  writer's notes (`docs/import-notes/2026-10-11-round-5/r5-grill-fry.md`).
- **6 fixed**, all small: pot size, oil recovery between batches, a fill limit for a skillet fry, a
  list/step/title mismatch, and two broiler alternatives made clearer. No ids, titles, taglines, sources or catalog entries changed, so there are no map or
  catalog files.
- **4 questions for the owner.** None are blockers, and I wouldn't drop any recipe.
- `audit:recipes` flags nothing in this group, before or after my edits. Every "the remaining …" amount, divided
  ingredient, temperature conversion and doneness temperature checks out. Every deep fry uses a heavy pot, a
  deep-fry thermometer, oil 2 inches deep and no more than halfway up the side, at 325–375°F. Shallow fries give the
  depth and pan size. Raw marinades and soaks are always thrown away, and the BBQ chicken sauce is brushed on only
  after the meat reaches 165°F, with the serving sauce set aside first.
- `npm run check` passes: 668 recipes, 399 ingredients, 874 tests.

## Fixed
- `southern-buttermilk-fried-chicken`: the pot was only "a large, heavy pot". Half of 3 1/2 lb of bone-in pieces
  (5 pieces) in a 4-quart pot would crash the oil temperature and crowd the pieces. → "a large, heavy 5- to 7-quart
  pot such as a Dutch oven". This is the size the writer planned in their notes, and about 3 quarts of oil fills it
  2 inches deep. Metric shows 4.7–6.6 litres.
- `korean-fried-chicken-wings-with-gochujang-glaze`: same issue for 1–1 1/2 lb batches of wings → 5- to 7-quart pot.
  Unlike every other deep fry in the file, neither fry said to let the oil recover between batches. The 10–12 minute
  first fry (cooking to 165°F) depends on the oil starting each batch at 325°F. → Each fry step now says to let the
  oil come back to temperature (325°F, then 375°F) before each batch.
- `coconut-shrimp-with-sweet-chili-lime-sauce`: the title, the tagline ("served with a sweet chili-lime dip") and
  step 7 (unconditional "For the dip, stir…") all present the sauce as part of the dish, but sweet chili sauce and
  lime were `opt()`. A full Use match would then show a titled sauce the cook can't make. → Both are now required.
  This matches the library's other "with … Sauce" titles (tempura, falafel, satay, kofta, churros). *If the owner
  would rather keep the sauce optional for search reach, revert those two lines and add "if you like" to step 7.*
- `tostones-twice-fried-green-plantains`: 1 inch of oil in a 10-inch skillet had no fill limit. Many 10-inch skillets
  are under 2 inches deep, and the second fry is at 375°F. → Added "it should come no more than halfway up the side",
  as the deep fries say.
- `grilled-vegetable-platter-with-balsamic-and-basil`: the broiler option put the vegetables on 2 sheets but didn't
  say to broil them one at a time (only one rack sits 4 inches below the element), and the time step gave only grill
  cues ("well marked"). → "one sheet at a time", and the time step now reads "Grill (or broil) … until tender and
  well marked or browned in spots".
- `grilled-pork-chops-with-peach-salsa`: the grill path warns that the brown-sugar rub scorches and says what to do.
  The broiler path (4 inches from the element for 10–12 minutes) gave no warning. → "Under the broiler, cook them
  for 5–6 minutes per side, moving the rack a notch lower if the rub darkens too fast."

## For the owner
1. **`chicken-fried-steak-with-cream-gravy`, cube steak to 160°F (71°C).** The writer chose the ground-meat
   temperature because cubing pushes surface bacteria inside. The USDA's chart allows 145°F plus a 3-minute rest for
   mechanically tenderized steaks. Chicken-fried steak is always served well done, and these thin steaks pass 160°F
   by the time the crust is golden. *Recommend: keep 160°F.* It isn't a medium-rare steak under decision 13.
2. **`fried-green-tomatoes` uses `tomato` for "firm green (unripe) tomatoes"** (the writer's map entry
   `'green tomatoes': 'tomato'`). It's the same fruit, and someone avoiding tomato must not see this dish. The cost is
   that "Use: Tomato" brings up a recipe that ripe red tomatoes can't make well. The catalog already treats
   ripeness as the same food (green plantains → `plantain`, green bell peppers → `bell_pepper`). *Recommend: keep
   `tomato`.* The display name says green and unripe.
3. **Coconut shrimp sauce now required** (see Fixed). This is a judgement on search reach versus title accuracy.
   *Recommend: keep it required.*
4. **"Classic Grilled Cheeseburgers" sits next to "Classic Grilled Cheese"** in an alphabetical list. They're
   different dishes, and the extra word makes that plain, so this is minor next to the confusable pairs renamed last
   round. *Recommend: keep the title.* "Grilled Cheddar Cheeseburgers" would separate them if wanted (the id stays).

Also worth knowing, but I made no change. These are the riskiest on paper, so re-read them first:
- **Chicken-fried steak gravy:** 1/4 cup fat and 1/4 cup flour to 2 1/2 cups milk is between a thin and a medium
  white sauce. The 4–6 minute simmer and the stray breading in the fat should bring it to "coats a spoon".
- **Vegetable pakoras:** about 1 1/4 lb of vegetables to 1 1/4 cups chickpea flour is a loose, lacy ratio. The
  step that adds water a spoonful at a time protects it.
- **Fried chicken breast timing:** at 300–325°F, halved bone-in breasts may take the full 12–15 minutes. The
  thermometer check and the 300°F oven finish cover it.

## Checked, no change
`beer-battered-onion-rings`, `buttermilk-hush-puppies`, `vegetable-tempura-with-soy-ginger-dipping-sauce`,
`fried-green-tomatoes`, `vegetable-pakoras`, `fried-shrimp-po-boys-with-remoulade`, `crispy-cornmeal-fried-catfish`,
`chicken-fried-steak-with-cream-gravy`, `grilled-carne-asada-with-orange-lime-marinade` (130°F with the exact USDA
sentence), `garlic-lemon-grilled-shrimp-skewers`, `classic-grilled-cheeseburgers` (160°F),
`grilled-salmon-with-lemon-herb-butter`, `chicken-shish-tawook-with-garlic-sauce`, `grilled-bbq-chicken-drumsticks`.
Each of the 8 grilled recipes gives a broiler method (and a grill pan where it suits), with rack distance and times.

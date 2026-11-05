# al8: aligning 12 recipes with the published amounts

All 12 now score 5. Each deciding quantity was set to the typical (median) value of 4–7 published versions, scaled to our batch. Where every quantity would otherwise have matched one source, one non-critical number of ours (inside the published range) was kept, and it is named below. Checks: `npm run typecheck`, `npm run validate` and `npx jest -w 2` all pass (874 tests). `npm run audit:recipes` raised no new flag for these recipes. The only change in the report was the existing "total time" note for boston-baked-beans, which went from 375 to 390 min, and the report was restored with `git checkout`.

## breakfastSides.ts
- **baked-berry-oatmeal (5).** The bake goes from 40–45 to 45–50 min, against 9-inch, 375°F versions at 40–50 (typical 45) for 2 cups of oats; ours has 2 1/2 cups. cookMinutes goes from 55 to 60. Nothing else moved. The rework's distinguishing choices stand, and the change moves away from Heidi Swanson's 35–45 min in an 8-inch dish.
- **boston-baked-beans (5).** Changes, per lb of beans:
  - Molasses goes from 1/3 to 1/2 cup (typical 1/2).
  - Brown sugar goes from 1/4 to 1/3 cup (typical 1/3).
  - Salt goes from 1 1/2 to 1 tsp.
  - The uncovered bake goes from 30–45 min to about 1 hr, for about 4 hr in the oven (typical 4–4 1/4 hr at 300°F).
  - cookMinutes goes from 300 to 315.

  Kept: 1 1/2 tsp dry mustard, so the sweetener and mustard trio does not equal Backwoods Home's.
- **cilantro-lime-rice (5).** Water (1.5:1) and the 18-min simmer were already the typical values, so neither moved. Salt goes from 1 to 1/2 tsp; published versions use 1/4–1/2 tsp per cup of rice. Step 3 gains a doneness cue (steam holes on the surface, plus 2–3 min more if water remains), because the remaining variable is the pot.
- **creamed-spinach (5).** Butter goes from 2 to 3 tbsp (typical 2 per lb of spinach). Flour goes from 2 to 2 1/2 tbsp (typical about 1.5–1.75 per cup of dairy; ours was 1.33). Kept: salt at 1/2 tsp, now with "plus more to taste", so the ratios don't reproduce Emeril's.
- **sausage-and-egg-breakfast-casserole (5).** Eggs go from 10 to 8 and milk from 2 to 2 1/2 cups. The typical version uses 8 eggs at about 3 eggs per cup of milk; ours was at 5. Kept: 3/4 tsp salt.
- **scalloped-potatoes (5).** Changes:
  - The covered bake goes from 40 to 45 min and the uncovered bake from 30–40 to 20–25 min. At 375°F the typical times are 45 covered and about 20 uncovered.
  - Salt goes from 1 3/4 to 1 tsp (typical about 1/3 tsp per lb).
  - cookMinutes goes from 100 to 90.

## vegetarian.ts
- **black-bean-and-sweet-potato-enchiladas (5).** The sauce gets 1/4 cup flour instead of 3 tbsp, and the oil in its roux goes from 3 to 4 tbsp, so the olive oil total is now 6 tbsp. Both are typical at 1.33–1.5 tbsp per cup of broth. The sauce's chili powder goes from 4 to 3 tbsp (typical 1 tbsp per cup). The ingredient lines and the "remaining" amounts in step 2 were updated to match.
- **black-bean-burgers (5).** Eggs go from 1 to 2: the typical amount is 2 per 2 cans, and the 1-egg versions add mayonnaise and cheese as binder. The oven for drying the beans goes from 325°F to 350°F, still for 15 min. Panko was already typical at 3/4 cup. Kept: 4 patties (published 4–8).
- **cauliflower-cheese (5).** Flour goes from 1/3 cup to 6 tbsp (typical about 80 g per litre of milk; ours was 71). Cheddar goes from 2 cups (225 g) to 1 1/4 cups (140 g), with 1 cup in the sauce (typical about 225 g per litre; ours was 380). Kept: 2 tsp Dijon.
- **falafel-with-tahini-sauce (5).** Flour goes from 2 tbsp to 1 tbsp. Most versions use none or under 1 tbsp per cup of dried chickpeas. Baking powder (1/2 tsp) and the 350°F oil were already typical.
- **gnocchi-with-spinach-and-tomato-cream (5).** Changes:
  - Gnocchi goes from 2 lb to 1 lb. Every published version serves 4 from about 1 lb.
  - The gnocchi is fried in one batch, so olive oil goes from 2 tbsp to 1 and step 1 was rewritten.
  - Cream goes from 3/4 to 1/2 cup (typical 1/2 per lb).
  - cookMinutes goes from 25 to 20. Servings stay at 4.
- **spinach-rice-and-feta-stuffed-peppers (5).** The oven goes from 400°F to 375°F (typical 375°F; sources run 350–400°F). The covered bake goes from 20 to 15 min, so the total is 40–45 min, against Whole Foods' 40. The doneness cue now says "tender when pierced with a knife". cookMinutes goes from 50 to 45.

## Not brought to 5
None.

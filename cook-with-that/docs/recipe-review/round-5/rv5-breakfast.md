# rv5-breakfast: paper review of `src/data/originals/breakfast.ts` (round 5)

## Summary
- **20 recipes reviewed.** I read each one in full and checked: every "divided" split adds up, liquid-to-grain ratios,
  leavening, gravy and sauce thickening, pan sizes for the quantity, step order, doneness cues, safe temperatures,
  salt under decision 14, ingredient IDs, tags, times and taglines. I also rendered every step and quantity in metric
  using the app's ingredient index.
- **6 fixed**, all small: 4 taglines whose time claims didn't match prep + cook, one biscuit cut that didn't work,
  one step order. I added one pan size along with the oatmeal tagline fix.
- **0 open questions that block anything.** The "For the owner" list has one script flag (keep the recipe), one note
  on a gravy and one on rest times. I wouldn't drop any recipe.
- No catalog additions, and no ids, titles, meals or dish types changed. `npm run check` passes: 668 recipes,
  399 ingredients, 874/874 tests.

## Fixed
- `broccoli-and-egg-fried-rice`: the tagline said "A 20-minute way to use leftovers", but prep 10 + cook 15 shows
  as 25 on the recipe page. Changed it to "A 25-minute way to use leftovers."
- `buttermilk-biscuits-and-sausage-gravy`: the dough was patted to a 6-by-9-inch rectangle and then "cut into 9
  squares". A 6-by-9 rectangle can't be cut into 9 squares: it gives 2-by-3-inch rectangles, and a beginner would be
  stuck. Changed it to "a 7 1/2-inch square about 1 inch thick", cut into "9 squares, about 2 1/2 inches each". The
  area is almost the same (56 vs 54 sq in), so the 1-inch height, 450°F and 13–16 minutes still hold.
- `potato-and-egg-breakfast-tacos`: the tortillas were warmed after the eggs were done. Warming 8 tortillas
  20–30 seconds per side, one or two at a time, takes about 5–8 minutes, and all that time the soft-scrambled eggs
  sat off the heat in the hot pan, overcooking and going cold. Moved the tortilla step before the eggs. The potato
  pan comes off the heat while they warm, and the tortillas are wrapped in a kitchen towel. The step says "a second,
  dry skillet" because the 12-inch pan is holding the potatoes. After that, the potato pan goes back on medium-low
  for the butter and eggs.
- `cheddar-grits-with-fried-eggs`: the tagline said "Ready in 25 minutes", but prep 5 + cook 25 is 30. Bringing
  4 cups of milk and water to a simmer, 10–12 minutes of grits and then the eggs really does take that long.
  Changed it to "Ready in 30 minutes."
- `black-bean-and-egg-breakfast-bowls-with-rice`: the tagline said "Bowls that come together in 25 minutes", but
  prep 15 + cook 15 is 30, and the recipe starts from cooked rice. Changed it to "Ready in 30 minutes with cooked
  rice." (124 characters).
- `savory-oatmeal-with-spinach-parmesan-and-a-fried-egg`: the tagline said "Ready in 15 minutes", but prep 5 +
  cook 15 is 20. Changed it to "Ready in 20 minutes." The egg step also said only "a nonstick skillet", the one pan
  in the batch with no size. Changed it to "a small (8- to 10-inch) nonstick skillet". I worded it that way so metric
  shows "a small (20–25 cm)" instead of "an 8- or 25 cm".

## For the owner
1. **`croque-madame` was flagged as a near-duplicate of `croque-monsieur-bites`** (88% of key ingredients
   shared). **Recommendation: keep it.** It's a different dish: a whole sandwich topped with a fried egg as a
   breakfast or lunch main, while the bites are an appetizer of cut squares with no egg. The title already makes
   the difference clear, which follows the near-duplicate rule in the last review (decision 7 in
   `docs/recipe-review/README.md`).
2. **`loco-moco` gravy:** 2 tbsp flour to 1 1/2 cups broth is about 1.3 tbsp per cup. That's above the
   1-tbsp-per-cup floor the round-1 review used for gravy, and it's in line with usual loco moco gravies. After the
   3–4 minute simmer it is pourable and coats a spoon. **Recommendation: leave it.** If you'd rather have a thicker
   gravy, use 3 tbsp flour (then the roux is equal parts fat and flour).
3. **Rest times left out of the totals:** the strata and the French toast bake don't count the 30 minutes out of
   the fridge or the 10-minute rest, and the frittata doesn't count its 5-minute rest. Both bakes already show over
   5 hours because of the 4-hour chill. **Recommendation: leave them.**
4. **The writer's cook-test-first list, checked on paper. All of it looks sound:**
   - Arroz a la Cubana: 2 lb of grated tomatoes gives about 3 cups of pulp, and reducing it by half leaves about
     1 1/2 cups of sauce, roughly 6 tbsp a plate, which is enough. 1 1/2 cups unrinsed long-grain rice to
     2 1/2 cups water, 18 minutes plus a 10-minute rest, is standard.
   - Sausage gravy: 1/3 cup flour plus the sausage fat and 1 tbsp butter to 3 cups milk is about 1.8 tbsp flour per
     cup, a medium-thick gravy, which suits biscuits. The step already says it thickens as it stands.
   - Biscuit dough: 1 tbsp baking powder for 2 1/2 cups flour is 1.2 tsp a cup, with 1/2 tsp soda for 1 cup of
     buttermilk. Normal.
   - Kedgeree: rinsed basmati at 1:1.5, 12 minutes covered plus a 10-minute rest. Standard.
   - Dutch baby: 3 eggs and 2/3 cup each of milk and flour in a preheated 10-inch skillet at 425°F (220°C) for
     18–22 minutes. The classic formula.
   - Strata and French toast bake: 8 eggs and 2 1/2–3 cups of dairy for 12–16 oz of bread in a 9-by-13-inch dish,
     45–60 minutes at 350°F (175°C) after 30 minutes out of the fridge. Standard. Both have a 160°F (71°C) or
     knife-test cue.
   - Omurice pan: 2 eggs in a 10-inch pan make a thin omelet wide enough to drape over a mound of about 1 cup of
     rice. An 8-inch omelet would be thicker but might not cover it. Keep the 10-inch pan.

## Checked, no change
`shakshuka`, `loco-moco`, `arroz-a-la-cubana`, `omurice`, `tex-mex-migas`, `corned-beef-hash-with-fried-eggs`,
`croque-madame`, `kedgeree`, `broccoli-potato-and-cheddar-frittata`, `ham-and-swiss-breakfast-strata`,
`dutch-baby-pancake`, `overnight-cinnamon-french-toast-bake`, `tomato-egg-and-cheddar-breakfast-quesadillas`,
`home-fries-with-peppers-and-onions`.

What these were checked against:
- **Divided amounts:** every split adds up (oil, butter, salt, cheese, ketchup, milk, cilantro, lime, parsley).
- **Ingredient IDs:** each one is the same food as its line. Hot-smoked salmon → `smoked_salmon`, challah or
  brioche → `bread`, chicken thighs → `chicken`, Roma tomatoes → `tomato`, whole peeled tomatoes →
  `canned_tomatoes`.
- **Safety:** chicken is cooked to 165°F (74°C); ground beef, sausage and the egg bakes to 160°F (71°C). There are
  no egg warnings.
- **Salt:** follows decision 14. The strata and the croque have no added salt (ham and cheese season them), the
  fried rice relies on soy sauce, and the hash and the sausage gravy say to salt only if needed.
- **Tags:** dish types fit the house rules: the Dutch baby is Skillet; tacos and quesadillas are Sandwich/Wrap;
  home fries are a side and get Sides from the meal. No recipe here is Fried, since none uses 1/4 inch of oil or
  more.

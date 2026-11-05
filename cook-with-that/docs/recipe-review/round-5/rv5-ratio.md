# rv5-ratio: older recipes flagged by the new `ratio` check

## Summary
- **Reviewed:** 20 recipes, each read in full. For the 10 imports I also compared them with their source: the Based Cooking
  snapshot in `.import-cache/`, `content/import/nhlbi-books/recipes.json`, `content/import/nhlbi/recipes.json` and
  `content/import/va/recipes.json`.
- **Fixed:** 3 recipes (`teriyaki-beef-and-broccoli`, `unstuffed-cabbage-rolls`, `tomato-hamburger-macaroni`). The
  fixes are small: a list/step mismatch, a cook time and a tagline.
- **Questions for the owner:** 5, all "keep as written" recommendations. None is a recipe I'd drop.
- **The flags themselves:** none of the 20 `ratio` flags pointed to a grain, leavening or pasta amount that would come
  out wrong. Most grain flags added up water or broth that goes into a sauce, a poaching liquid or a lentil boil
  that is drained. One counted only the water and missed the milk the quinoa cooks in. One missed the juice from the
  canned tomatoes. The three leavening amounts are deliberate. Details are under "Checked, no change".
- `npm run check` passes: 668 recipes and 399 ingredients validated; 11 suites and 874 tests passed.

## Fixed
- `teriyaki-beef-and-broccoli` (Based Cooking, "Teriyaki Beef Wok"): **list/step mismatch.** The list gave 1/2 cup of
  water, and all of it goes into the sauce. The stir-fry step then says to add 2 tbsp more water if the pan looks dry.
  → The water line now reads "1/2 cup, plus 2 tbsp if needed". The sauce step says "Whisk 1/2 cup of the water…" and the
  stir-fry step says "add the remaining 2 tbsp water". The amounts are unchanged. *From the source:* the source has
  no pan-water step (the first import added it). Its sauce uses 2 dL water and 2 tbsp cornstarch; the first import
  changed that to 1/2 cup and 1 tbsp. I made no new change to the source's recipe. The rice flag is a false alarm: the
  water is the sauce's, and the rice is cooked "as the package directs" from 2/3 cup uncooked.
- `unstuffed-cabbage-rolls` (VA): **brown rice time.** One cup of regular brown rice simmers covered in a thick tomato
  mixture: two cans of diced tomatoes, two 8-oz cans of sauce and 6 cups of cabbage. Rice in thick, acidic liquid that
  doesn't cover it is slower than rice in plain water, so 40–45 minutes was the low end. The earlier review put it on
  the cook-test-first list for this reason. → The simmer is now "40–55 minutes" (start checking at 40), and
  cookMinutes went from 55 to 65. The "until tender" cue and the "stir in a little more water" note are unchanged.
  The liquid itself is plentiful. The flag's 0.5 cup counts only the water and leaves out about 4 cups of tomatoes and
  sauce. *From the source:* the PDF gives 20–30 minutes (the round-3 import already raised it to 40–45) and 45
  minutes total cook time.
- `tomato-hamburger-macaroni` (Based Cooking): **the tagline overclaimed.** "Makes enough for the week" doesn't fit a
  6-serving batch. It also suggests keeping cooked meat and pasta all week, while the usual guidance for leftovers is
  3–4 days in the fridge. → "…simmered in an herby tomato sauce. Reheats well for lunches." The recipe is unchanged.
  The pasta-per-serving flag (1.17 oz) is checked below.

## For the owner
1. **Rice "as the package directs" (6 recipes, left as written):** `mongolian-beef`, `pepper-steak-with-rice`,
   `teriyaki-beef-and-broccoli`, `ground-beef-and-broccoli-stir-fry`, `ground-beef-burrito-bowls-with-black-beans`
   and `miso-ginger-pork-rice-bowls`. All of them list the uncooked amount, and the flagged water goes into a sauce,
   so I added no water lines. This is the house-rule question rv02 raised earlier. *Recommend:* keep them as they
   are.
2. **`whole-wheat-pumpkin-pancakes`: 1 tbsp baking powder per 1 cup whole-wheat flour (the VA source's amount).**
   It's high next to the audit's "pancakes up to 2 tsp". But classic American pancake formulas use about 3 tsp per
   cup of all-purpose flour, and this batter is heavier, with whole-wheat flour and pumpkin purée. Pancakes set on the
   griddle within minutes, so they can't rise and then collapse the way a cake can. Baking powder brings its own acid,
   so the soapy taste of excess soda doesn't apply. The most it could do is taste faintly bitter. *Recommend:* keep 1
   tbsp. Drop to 2 tsp only if anyone reports a bitter taste. (The source's 1 tbsp vanilla is still 1 tsp, as the
   round-3 import set it.)
3. **`sticky-toffee-pudding`: 1 tsp baking soda (plus 1 tsp baking powder) per 1 1/4 cups flour.** The soda goes into
   the boiling water over the dates, which is the traditional method: it softens the date skins and darkens the
   sponge, and much of it reacts with the dates and the brown sugar before the batter is mixed. Classic British
   versions use the same teaspoon of soda with self-raising flour, so they have more total leavening than this one.
   The toffee sauce covers any trace of alkaline taste. *Recommend:* keep.
4. **`chocolate-cake`: 2 tsp baking powder with 3/4 cup (100 g) flour (the source's amount).** The audit counts flour
   only. Here the dry structure is flour plus 1 1/4 cups (100 g) cocoa, about 2 cups in all, so it comes to 1 tsp per
   cup, the standard rate. Six separated eggs with whipped whites do the rest, as in a chiffon cake, which also uses
   both. It may sink a little in the middle as it cools, which is normal for this style. *Recommend:* keep.
5. **`lamb-biryani`: the lamb simmer time, still open from rv10.** The steps give 45–60 minutes "until tender" for
   1 1/2-inch chunks of shoulder. The lamb then cooks about 20 minutes more with the rice, so it gets 65–80 minutes
   in all. That's enough for lamb (mutton would need longer), and the cue and the "add a splash of water" note protect
   the cook. *Recommend:* keep. If you'd rather widen it, use "45–75 minutes" and set cookMinutes to about 100.

Note for whoever maintains `npm run audit:recipes`: the grain check adds up every water and broth line in the
recipe, so sauces, poaching liquid and drained boils set it off. It also leaves out milk and canned tomatoes. The
pancake ceiling of 2 tsp baking powder per cup is lower than standard pancake formulas.

## Checked, no change
Each flag, and why it doesn't point to a problem:
- `mongolian-beef`: the 1/3 cup water is for the glaze, and the rice is "as the package directs" (1 1/2 cups
  uncooked for 4). The no-doneness flag is a false alarm: 1/4-inch strips are fried until crisp, and rv02 accepted
  the visual cue.
- `pepper-steak-with-rice`: the 3/4 cup broth makes the sauce, and the rice is "as the package directs". Thin strips
  are judged by eye, as in `mongolian-beef`.
- `chicken-broccoli-and-rice-casserole`: 1 cup rinsed rice is par-cooked in 1 3/4 cups water (a normal ratio), then
  finishes in the oven in a 3-cup cheddar sauce. The flag added up the water, the broth and the sauce. Butter, salt
  and cheddar divide correctly, and the 9-by-13 dish holds the roughly 12 cups.
- `ground-beef-and-broccoli-stir-fry`: the water is for the sauce and for steaming the broccoli; the rice is "as
  the package directs".
- `ground-beef-burrito-bowls-with-black-beans`: the 1/2 cup water is for the beef; the rice is "as the package
  directs". The salt adds up (1/2 + 1/4 + 3/4 + 1/4). The near-duplicate flag against `chicken-burrito-bowls` is a
  different protein, and rv02 already settled it.
- `bibimbap-with-spinach-and-fried-egg` and `chicken-katsu-with-rice`: 1 1/2 cups of rinsed short-grain rice to 1 3/4
  cups water (1.17:1), with 15 minutes covered and a 10-minute rest. That's the usual Japanese and Korean ratio of
  about 1.1–1.25 to 1. The audit's range is for long-grain rice. Every divided amount in the bibimbap adds up (oil,
  sesame oil, garlic, soy), and the katsu's 1/4 inch of oil in a 12-inch skillet matches its 1 1/2 cups.
- `sticky-toffee-pudding`: see owner item 3. Butter (1/4 + 1/2 cup), brown sugar (3/4 + 1 cup) and salt all divide
  correctly, and an 8-inch square pan holds the batter.
- `mujadara`: 4 of the 5 3/4 cups of water boil the lentils and are drained. The rice cooks in 1 3/4 cups with the
  par-cooked lentils, a normal amount for long-grain or basmati.
- `tomato-hamburger-macaroni`: 7 oz (200 g) of macaroni is the source's 1 3/4 cups, with 1 1/4 lb of beef and sausage
  for 6 servings. That's about 1 1/4 cups each, roughly 3 oz raw meat and 1 oz dry pasta, the same as a boxed
  hamburger-macaroni dinner. The servings are honest for a meat-heavy dish (source: "6+"). Tagline fixed above.
- `chocolate-cake`: see owner item 4. The weights match the source (100 g flour, 150 g butter, 100 g cocoa, 300 g
  sugar, 100 ml coffee, 6 eggs), and the pan is deep enough.
- `lamb-biryani`: 2 of the 5 cups of water braise the lamb. The rice cooks in the liquid topped up to 3 1/3 cups, about
  1.65 to 1 for 2 cups of soaked basmati. That matches the source's 800 g water to 400 g rice and suits the boil, then
  covered-steam method. See owner item 5 on the lamb.
- `miso-ginger-pork-rice-bowls`: the 3/4 cup water makes the miso sauce, and the rice is cooked by the package
  directions. Miso seasons it, and the 1/4 tsp salt follows the source.
- `ginger-salmon-rice-bowls`: the rice ratio is 1 cup to 2 cups water. The flag also counted the 1 cup of broth the
  salmon is poached in (the NHLBI amount). Salmon reaches 145°F.
- `moroccan-chicken-stew-with-couscous`: the couscous takes 1 cup broth to 1 cup couscous, the source's ratio. The
  other 2 cups are the stew. Spices, liquid and salt match the book.
- `caribbean-black-beans-and-rice`: 1 1/2 cups of instant brown rice cooks in the juice of the stewed tomatoes plus
  1/2 cup water. The flag counted only the water. The book uses the bean liquid where we use rinsed beans and water,
  which is about the same amount of liquid, so rv08's "about right" stands.
- `whole-wheat-pumpkin-pancakes`: see owner item 2. Everything else matches the source.
- `cranberry-almond-breakfast-quinoa`: 1/2 cup quinoa to 1/2 cup water plus 1/2 cup milk is the standard 2 to 1. The
  flag missed the milk. It matches the VA source.

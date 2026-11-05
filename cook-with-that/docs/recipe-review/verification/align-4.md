# al4: aligning 12 four-out-of-five recipes with the published amounts

**10 now score 5 and 2 stay at 4.** The two 4s are reworked recipes. In each, the one number left at an edge can only move toward the source the rework moved it away from.

Each deciding quantity was compared with 5–7 published versions. The per-recipe medians and URLs are in `verdicts.json`.

## dessertsSnacks.ts
- **baked-apple-dumplings (5)**
  - Syrup brown sugar goes from 3/4 cup to 1 1/2 cups, the median of six whole-apple versions (5/8 to 2 1/2 cups). The ingredient total is now 1 3/4 cups.
  - The two-stage bake (425°F, then 350°F) becomes one bake at 400°F for 40–45 minutes. The sources bake at a single temperature, from 350°F to 425°F (median about 390°F), for about 40–45 minutes.
- **caramel-flan (5)**
  - Bake time goes from 45–55 to 50–60 minutes.
  - The eggs go from 4 whole plus 2 yolks (about 5 egg-equivalents, the top of the range) to 4 whole, the median.
  - The caramel goes from 3/4 cup to 1 cup of sugar (median), with 1/4 cup water.
  - It doesn't equal Baked Bree's recipe: theirs uses 3/4 cup of caramel sugar and no salt.
- **chewy-honey-oat-granola-bars (5)**
  - The binder was at the low end. Brown sugar goes from 1/4 to 1/3 cup and peanut butter from 1/4 to 1/3 cup. Total binder is now about 1.19 cups per 3 cups of dry ingredients, against a median of 1.18.
  - The syrup boils 2 minutes instead of 1, as most no-bake bars do.
- **chocolate-dipped-coconut-macaroons (4, rework)**
  - Bake time goes from 16–20 to 18–20 minutes at 350°F. Every 350°F version bakes at least 17 minutes.
  - The condensed milk stays at 2/3 cup. The published median is 7/8 cup, which is exactly Once Upon a Chef's amount, and the rework rule forbids moving back toward it.
- **molten-chocolate-lava-cakes (5)**
  - Flour goes from 2 to 3 tablespoons. Six versions range from 2 teaspoons to 6 1/3 tablespoons, median 3 tablespoons.
  - The oven (425°F for 12–14 minutes) and the other amounts were already typical. The cakes no longer share Jean-Georges' formula.
- **oven-baked-caramel-popcorn (4, rework)**
  - Popcorn goes from 10 to 13 cups per cup of sugar (median of six), from 1/2 cup of kernels. The step now says to measure out 13 cups. This moves away from Allrecipes' 10 cups.
  - The salt stays at 1 teaspoon, about twice the published 1/4–1/2 teaspoon. Moving it back would undo the rework, so it is still a 4.
- **pull-apart-monkey-bread (5)**
  - Bake time goes from 35–40 to 30–35 minutes. The 190°F thermometer check stays.
  - The coating was the richest of the five versions. The cinnamon sugar goes from 1 cup to 3/4 cup and the dipping butter from 8 to 6 tablespoons. Total sugar is now 1 cup and total butter 2 sticks, and step 7 was updated to match.
- **thai-mango-sticky-rice (5)**
  - The rice, coconut milk, sugar and salt per cup of rice already sat at the medians of seven versions. It is the common one-can ratio, not just Weissman's.
  - The topping cornstarch goes from 2 to 1 teaspoon. Ours was at the thick end; the median is about 1.6 teaspoons per cup of coconut milk.
  - The salt (3/4 teaspoon) and the way the sugar is split stay ours. They differ from Weissman's recipe.

## weeknight.ts
- **chicken-and-wild-rice-soup (5)**
  - No number moved. After the earlier flour fix the soup has 1.07 tablespoons of flour per cup of liquid, against 1.0–1.14 in the creamy roux versions.
  - The rice, broth, dairy, butter and chicken all sit at their medians.
  - Step 7 now says to heat it until it lightly coats a spoon.
- **chicken-spaghetti (5)**
  - No number moved. The sauce liquid, roux, cheese, chicken and tomatoes per 12 oz of spaghetti, and 350°F for 20–25 minutes, all sit at the medians of six scratch versions.
  - The doneness check now adds "hot in the center".
- **southwest-black-bean-pasta-skillet (5)**
  - Broth goes from 2 1/2 to 2 cups. Total liquid is now about 3 3/4 cups per 8 oz of pasta, against a median of about 3.7.
  - The covered simmer goes from 10–12 to 12–15 minutes, the typical time.
  - The spices equal about one packet of taco seasoning, the median.
- **tater-tot-casserole (5)**
  - The oven goes from 400°F to 350°F and the bake from 35–40 to 45–50 minutes, the typical setting for a 9x13 with 2 lb of tots.
  - The gravy, beef, tots and cheese were already typical. Carlsbad Cravings' recipe shares the beef, gravy, cheese and oven numbers, but ours keeps its own butter-and-mushroom gravy, seasonings and vegetables.

## Check
- `npm run typecheck && npm run validate && npx jest -w 2` passes: 668 recipes and 399 ingredients validate, and all 11 suites and 874 tests pass.
- The first baseline `npm run check` lost a jest worker to SIGKILL under memory pressure. That suite (searchAudit) passed when run alone.
- `npm run audit:recipes` left `docs/recipe-audit.md` unchanged, so the edits added no new flags.

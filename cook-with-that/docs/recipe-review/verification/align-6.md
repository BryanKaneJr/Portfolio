# al6: aligning 12 recipes to published values

Each deciding quantity was set to the median of 4–6 published versions, scaled to our batch. Full numbers and source URLs are in `verdicts.json`. None of these recipes had a `rework` entry. House rules still apply (165°F poultry, 160°F ground meat, 145°F pork, salt where fitting).

Checks:
- `npm run typecheck`, `npm run validate` and `npx jest -w 2` pass (11 suites, 874 tests).
- `npm run audit:recipes` shows no new flag. Porcupine meatballs' earlier ratio flag (3 cups liquid per cup of rice) is gone, and the total flagged count went from 90 to 89.

## comfort.ts

- **cheeseburger-macaroni-skillet (4 → 5).**
  - The milk now simmers with the broth, so the macaroni cooks in 3 cups of liquid. That is the median of She's Not Cookin, Together as Family and Taste of Home, up from 2 1/2 cups.
  - The simmer is now 12–14 min, and cookMinutes went to 28.
  - The 2 1/2 broth to 1/2 milk split is still ours.
- **cheesy-beef-and-spinach-pasta-bake (4 → 5).**
  - Cheddar went from 2 1/2 to 2 cups. That is the median across Well Plated, Food.com, HelloFresh, Damn Delicious and Taste of Home, scaled to 12 oz pasta.
  - Oven went from 375°F to 350°F, and the bake from 20–25 to 25–30 min. cookMinutes went to 50.
  - The tagline no longer says "thick".
- **chicken-divan-with-parmesan-sauce (4 → 5).**
  - The sauce takes 1 cup of poaching liquid instead of 1 1/4. That is 1.64 tbsp flour per cup of liquid; the median of Skinnytaste, Suburban Soapbox, Nancy Fuller and Cook's Country is about 1.65.
  - Oven went from 400°F to 350°F, and the bake from 20 to 25–30 min. cookMinutes went to 70.
- **porcupine-meatballs-in-tomato-sauce (4 → 5).**
  - Rice went from 1/2 to 3/4 cup, the median of 1/2 cup per lb.
  - Tomato sauce went from 30 oz to 23 oz (one 15 oz can plus one 8 oz can), the median of 15 oz per lb.
  - Brown sugar went from 1 to 1 1/2 tbsp, the median of 1 tbsp per lb.
  - The recipe now makes 20–22 meatballs.
- **roast-chicken-thighs-over-buttered-potatoes (4 → 5).** No number moved: 425°F, 40–45 min and 3/4 cup broth already match The Kitchn, Inspired Taste, Modern Nonna and ATK. The 4 came from the dish itself. The slices under the thighs lag behind the edges, so the recipe now has a rack position and a knife cue for those slices.
- **skillet-pork-chops-with-potatoes-and-green-beans (4 → 5).** No number moved: the sear, the 145°F finish, the amounts of potatoes, beans and butter all sit at typical values. The 4 came from timing three foods in one pan. The finishing step now leads with 145°F, and if the beans are still firm they get 1–2 more covered minutes while the chops rest.
- **southern-baked-macaroni-and-tomatoes (4 → 5).**
  - Sugar went from 2 tsp to 1/2 tsp, the median of Lana's, Gonna Want Seconds, Julia's and Feast and Farm.
  - Oven went from 375°F to 350°F, and the bake from 25–30 to 30–35 min, matching the baked versions (Feast and Farm, Food.com). cookMinutes went to 60.
  - The fresh tomatoes stay; they define this recipe.

## breakfast.ts

- **arroz-a-la-cubana (4 → 5).**
  - Water went from 2 1/2 to 3 cups (2:1), as in Fascinating Spain, Directo al Paladar and ¡Hola!.
  - There are now 4 bananas, one per plate, fried in two batches with the same oil.
  - Rice stays: about 70 g per person against a median of about 75 g. cookMinutes went to 50.
- **broccoli-potato-and-cheddar-frittata (4 → 5).**
  - Eggs went from 10 to 8, the median for 10-inch pans.
  - Cheddar went from 1 to 3/4 cup, so the cheese per egg stays the same.
  - Oven went from 375°F to 350°F (the median), and the bake from 14–18 to 18–22 min. cookMinutes went to 40.
  - The tagline no longer says "thick, cheddar-rich".
- **buttermilk-biscuits-and-sausage-gravy (4 → 5).** The biscuit numbers are medians of 5 formulas (Food.com, Taste of Home, King Arthur, ATK, Cooking with Carlee), scaled to 2 1/2 cups of flour.
  - Biscuit butter went from 8 to 10 tbsp, so the butter total is now 3/4 cup.
  - Baking powder went from 1 tbsp to 2 1/2 tsp, and salt from 1 tsp to 3/4 tsp.
  - Baking soda (1/2 tsp), buttermilk (1 cup), 450°F and 13–16 min already matched and stay.
  - Gravy flour went from 1/3 to 1/4 cup per 3 cups of milk, as in Live Well Bake Often, Mrs Happy Homemaker, ATK and Frugal Hausfrau.
- **kedgeree (4 → 5).** These are medians of 6 versions (BBC quick and classic, Tasting Table, Saveur, Sainsbury's, Woman & Home).
  - Smoked salmon went from 8 to 12 oz.
  - Eggs went from 4 to 3.
  - Butter went from 4 tbsp to 2 tbsp, all used for the onion.
  - Water went from 2 1/4 to 2 2/3 cups (1.8:1). The rice cue now reads "almost all the water is absorbed".
  - Rice (1 1/2 cups) and curry powder (1 tbsp) stay. The tagline no longer says "buttery".
- **omurice (4 → 5).**
  - Chicken went from 8 to 5 oz, the median of about 2 1/2 oz per plate.
  - Ketchup in the rice went from 1/4 cup to 3 tbsp, so the total is 5 tbsp. The sources were Just One Cookbook, Apron and Sneakers, Japanese Cooking 101, Chopstick Chronicles and The Takeout.
  - Rice, eggs and butter already matched.

No recipe needed a new catalog ingredient. Every recipe now scores 5.

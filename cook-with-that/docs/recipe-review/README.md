# Recipe review (2026-10-11)

Eleven reviewers read all 548 recipes as cooks, against the checklist in the review brief: does it work (ratios,
amounts, pan sizes, yields), is every step possible, is it safe, is it accurate (title, tagline, tags, ingredient IDs),
is it clear. Imported recipes were compared line by line with their source. Each reviewer's file (`rv01.md` …
`rv11.md`) lists every change and every question. `npm run audit:recipes` (report: `../recipe-audit.md`) ran first and
fed them script flags.

## What was fixed (97 recipes)

No recipe was dropped, no transcription slips were found in the imports, and no unsafe temperature survived. The fixes
were small and practical:

- **Quantities that didn't add up:** cookie and crêpe yields (36 not 24, 48 not 36, 1/3 cup batter not 1/4), servings
  that didn't match the food, a glaze with twice the cornstarch it needed, a cocoa weight, a cacio e pepe with too
  little cheese to make a sauce, leavening that would give dense muffins, gravy too thin to coat.
- **Pans and batches:** dishes that would overflow (lasagna, banana pudding, spinach dip, seven-layer dip), skillets
  that couldn't hold the batch (crab cakes, burritos), a mussel pot size, a blender filled too full with hot soup.
- **Step order:** preheating at the right time, a frittata's dish swap before the eggs go in, blending before the
  spices scorch, the pasta not left to sit while the sauce cooks.
- **Food safety:** marinades moved to the fridge, a reheat temperature for chicken and frozen burritos, a frying
  temperature for pork, lemon juice no longer curdling the cream.
- **Accuracy:** taglines that promised times or flavors the recipe doesn't deliver, missing dish types, an ingredient
  ID that said fresh spinach for frozen, optional seasonings that were really part of the dish.

## Owner decisions (applied 2026-10-11)

1. **Dish types.** Added one type, **Dips & Salsas** (`dip`): hummus, tzatziki, guacamole, pico de gallo, corn salsa,
   seven-layer dip, refried black beans, and spinach-artichoke dip and baba ganoush (also Casserole/Bake). Pancakes
   and crêpes are Skillet; fresh lumpia is a wrap. No "No-Bake Desserts" type (owner: they "can just go in dessert")
   and no "Grilled" type. 34 recipes still have no dish type: desserts, sides and appetizers found by their meal, plus
   grilled, air-fried and deep-fried mains that fit none of the nine types (huli huli and sesame-ginger chicken
   skewers, chicken satay, ginger-soy pork tenderloin, Greek flank steak, turkey mole, air fryer tenders and
   drumsticks, fish and chips). Thai peanut noodles stays Pasta: it's made with spaghetti or linguine.
2. **Eggs.** Owner: "being scared of people not cooking yolk is ridiculous... people eat over easy eggs every day."
   No egg warnings anywhere; the pasteurized-egg wording added to carbonara and tiramisu was taken out.
3. **Steak doneness.** Owner: medium-rare is fine, with "a disclaimer of what the USDA says". Steaks and lamb chops
   cook to 130°F (54°C) for medium-rare, followed by "The USDA recommends 145°F (63°C) with a 3-minute rest."
   (garlic-butter steak, steak tacos, bitoque, Greek flank steak, rosemary lamb chops).
4. **Salt "if it's fitting"** (owner: "you dont salt certain foods, like bacon"). Salt added only where nothing in the
   dish is salty: to taste in minestrone, unstuffed cabbage rolls, lasagna soup, shrimp and broccoli pasta, red beans
   and rice, summer vegetable stew and roasted beets; measured (1/2 tsp, 1/4 tsp) in the spinach egg bake and the
   crispy cod's crumb, which can't be tasted raw. Recipes seasoned by cheese, ham, salsa, soy or salted broth were
   left alone.
5. **The four tweaks, checked against USDA and extension guidance and published recipes:**
   - `slow-cooker-chicken-tacos`: low 4–5 hours (or high 2–3), lid on, until 165°F and shreddable, checking every
     30 minutes after that; the chicken line says "thawed if frozen" (USDA: never slow-cook frozen meat). The pot is
     now 3 to 4 quarts, so the chicken and onions fill it about half (USDA: half to two-thirds full). Tested
     recipes for boneless breasts with little liquid give 4–5 hours on low; the old 6–8 hours dried them out.
   - `frijol-con-puerco`: boneless pork shoulder instead of loin (loin dries out in a 90-minute simmer). "Pork
     butt" and "Boston butt" are now search aliases of pork shoulder.
   - `green-chile-chicken-stew`: thighs only, with the fat skimmed before serving.
   - `flammkuchen`: 3/4 cup (180 g) full-fat sour cream instead of 1/3 cup, the usual ~200 g for this much dough.
6. **Equipment** never adds or removes recipes; there's no equipment filter. Waffle iron, food processor, kirsch,
   massaman paste, liver spread and mixed spice all stay.
7. **Near-duplicates** all stay. Clearer titles for the confusable ones: "Chicken and Spinach Pasta in Garlic Broth"
   (was "Chicken, Spinach & Garlic Pasta", next to "Creamy Garlic Chicken Pasta"), "Rice Pilaf with Onion and Thyme"
   (next to "Rice and Vermicelli Pilaf"), "Picnic Potato Salad with Egg and Dill" (was "Savory Potato Salad") and
   "Greek Lemon Chicken and Rice Bake" (next to the avgolemono soup). IDs are unchanged, so favorites keep working.
8. **Cooked rice:** all 36 lines that list cooked rice by the cup now say how much uncooked rice makes it ("4 cups
   cooked basmati rice, from about 1 1/3 cups uncooked rice"). Metric shows the uncooked amount in grams. Recipes
   that cook their own rice "as the package directs" already list the uncooked amount and were left alone.

## Cook-test first

The reviewers flagged these as the riskiest on paper; cook them before anything else:
jollof rice (liquid for parboiled rice), cherry pie (cornstarch with fresh cherries), panna cotta (gelatin set),
rosemary focaccia (hydration with all-purpose flour), unstuffed cabbage rolls (brown rice time), carrot muffins and
apple coffee cake (high baking soda), whole-wheat pumpkin pancakes (high baking powder), cinnamon rolls (very sweet
filling), cheesy ham and potato bake (enough cream?), okonomiyaki (dense batter), quick apple strudel (jam bubbling
out), sticky five-spice pork chops (salty after 3 hours in soy), Uzbek plov and Valencian paella (liquid), red beans and
rice (brothy), chicken korma (yogurt splitting), pad see ew (noodle soak), potstickers (yield and steaming), crab cakes
(binding), lamb chops (time to 130°F), beef empanadas (filling per round), slow-cooker chicken tacos (the
new 4–5 hours).

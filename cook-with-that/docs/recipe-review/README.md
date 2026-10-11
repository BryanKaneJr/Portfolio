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
  temperature for pork, lemon juice no longer curdling the cream, pasteurized-egg options for raw-yolk dishes.
- **Accuracy:** taglines that promised times or flavors the recipe doesn't deliver, missing dish types, an ingredient
  ID that said fresh spinach for frozen, optional seasonings that were really part of the dish.

## Decisions for the owner

1. **45 recipes have no dish type**, so any Dish type filter hides them. Most fall into three groups: dips and salsas
   (6), chilled or no-bake desserts (12) and grilled or air-fried mains (10); pancakes, waffles and crêpes (5) could
   take Skillet like French toast. *Recommendation:* add three dish types (Dips & Salsas, No-Bake Desserts, Grilled),
   tag pancakes and crêpes Skillet, and keep Asian noodles out of Pasta (retag Thai Peanut Noodles).
2. **Lightly cooked eggs:** runny yolks in 7 recipes, raw yolks in tiramisu and carbonara, hollandaise in eggs
   Benedict. *Recommendation:* keep them; carbonara and tiramisu already offer pasteurized eggs, so add the same to eggs
   Benedict and a "cook longer for firm yolks" note where yolks are runny.
3. **Medium-rare steak:** two steak recipes offer 130°F (medium-rare) or 145°F (USDA). *Recommendation:* keep both.
4. **Unsalted government recipes:** a few VA and NHLBI recipes add no salt at all (minestrone, unstuffed cabbage rolls,
   spinach egg bake, shrimp and broccoli pasta) and will taste flat. *Recommendation:* add "salt to taste" as the last
   step.
5. **Quality tweaks the reviewers suggested but left alone** because they change a source recipe: pork shoulder
   instead of lean loin in the 90-minute frijol con puerco, 4–6 hours (not 6–8) for chicken breasts in the slow
   cooker, thighs only in the green chile stew, more sour cream on the flammkuchen. *Recommendation:* apply all four.
6. **Specialty ingredients and equipment:** waffle iron (waffles), food processor (falafel), kirsch (fondue), massaman
   curry paste (satay), liver spread (kaldereta), British mixed spice. *Recommendation:* keep; each defines its dish.
7. **Near-duplicates:** the reviewers checked every flagged pair and found different dishes; they recommend keeping
   all. The closest is four chicken, spinach and pasta recipes. *Recommendation:* keep.
8. **Cooked rice with no instructions:** several recipes list "cooked rice" with no step for it, and five beef recipes
   say "cook the rice as the package directs". *Recommendation:* give the uncooked amount ("from about 2/3 cup
   uncooked") in each.

## Cook-test first

The reviewers flagged these as the riskiest on paper; cook them before anything else:
jollof rice (liquid for parboiled rice), cherry pie (cornstarch with fresh cherries), panna cotta (gelatin set),
rosemary focaccia (hydration with all-purpose flour), unstuffed cabbage rolls (brown rice time), carrot muffins and
apple coffee cake (high baking soda), whole-wheat pumpkin pancakes (high baking powder), cinnamon rolls (very sweet
filling), cheesy ham and potato bake (enough cream?), okonomiyaki (dense batter), quick apple strudel (jam bubbling
out), sticky five-spice pork chops (salty after 3 hours in soy), Uzbek plov and Valencian paella (liquid), red beans and
rice (brothy), chicken korma (yogurt splitting), pad see ew (noodle soak), potstickers (yield and steaming), crab cakes
(binding), lamb chops (time to 145°F), beef empanadas (filling per round).

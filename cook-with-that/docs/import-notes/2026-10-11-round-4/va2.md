# va2: 25 more VA recipes (round 4)

Base: `16934c17`, the working branch. `patch.diff` here is the full worktree diff against it. `npm run check` passes
in the worktree: 467 recipes (442 + 25), 351 ingredients (346 + 5), 653 tests. All changed files are Prettier-clean.

Files changed: `src/data/imported/va.ts` (25 recipes appended after Crispy Baked Cod), `scripts/import/ingredient-map.ts`
(48 entries in a new "Reviewed by parallel import worker va2" section), `src/data/ingredients.ts` (5 entries, added by
`import:draft` and `import:catalog`), and the `va` entry's `exclude` list in `scripts/import/sources/index.ts`
(10 pages, plus a reworded comment above the list).

## Imported (source key → id: title, what it adds)

| Source key | id: Title | Gap it fills |
|---|---|---|
| hearty-pumpkin-chili | hearty-pumpkin-chili: Hearty Pumpkin Chili | Turkey chili with three beans and pumpkin; pumpkin as a dinner ingredient |
| mini-turkey-meatloaves | mini-turkey-meatloaves: Mini Turkey Meatloaves | Ground turkey dinner; muffin-tin meatloaf (the library has one full loaf, beef) |
| asian-inspired-chicken-kebabs | sesame-ginger-chicken-kebabs: Sesame-Ginger Chicken Kebabs | Grilled/broiled chicken skewers; chicken with ginger |
| air-fried-chicken-drumsticks | air-fryer-chicken-drumsticks: Air Fryer Chicken Drumsticks | Everyday drumsticks (oven method given too) |
| chicken-chow-mein | chicken-chow-mein: Chicken Chow Mein | No chow mein in the library; chicken with celery and mushrooms |
| chicken-couscous-paella | chicken-couscous-paella: Chicken Couscous Paella | Leftover/rotisserie chicken dinner; chicken with couscous |
| citrus-tomato-fish-over-quinoa | citrus-tomato-fish-over-quinoa: Citrus-Tomato Fish over Quinoa | Fish with quinoa; cod with tomato |
| lemony-pan-seared-fish-with-wilted-kale | lemony-pan-seared-fish-with-wilted-kale: Lemony Pan-Seared Fish with Wilted Kale | 20-minute fish dinner; kale |
| quinoa-shrimp-and-black-bean-casserole | cumin-quinoa-with-shrimp-and-black-beans: Cumin Quinoa with Shrimp and Black Beans | Shrimp with black beans and corn; one pot |
| baked-balsamic-tofu | baked-balsamic-tofu: Baked Balsamic Tofu | Tofu main (only stir-fry and curry before) |
| slow-cooker-moroccan-chickpea-lentil-stew | slow-cooker-moroccan-chickpea-and-lentil-stew: Slow-Cooker Moroccan Chickpea and Lentil Stew | Vegan slow-cooker dinner; butternut squash with chickpeas |
| curried-lentil-and-pumpkin-soup | curried-lentil-and-pumpkin-soup: Curried Lentil and Pumpkin Soup | Pantry soup; brown lentils |
| carrot-and-coriander-soup | carrot-and-coriander-soup: Carrot and Coriander Soup | No carrot soup in the library |
| bean-and-barley-soup | bean-and-barley-soup: Bean and Barley Soup | Meatless barley soup; great northern beans |
| calabacitas-con-elote | calabacitas-con-elote: Calabacitas con Elote | Zucchini with corn side |
| indian-stir-fried-cauliflower | indian-spiced-cauliflower-and-peas: Indian-Spiced Cauliflower and Peas | Cauliflower side; peas |
| roasted-broccoli-fennel-and-chickpeas | roasted-broccoli-fennel-and-chickpeas: Roasted Broccoli, Fennel and Chickpeas | Fennel; broccoli with chickpeas |
| asparagus-and-spinach-risotto | asparagus-and-spinach-risotto: Asparagus and Spinach Risotto | Second risotto; asparagus |
| festive-green-bean-salad | green-bean-salad-with-cranberries-and-almonds: Green Bean Salad with Cranberries and Almonds | Make-ahead holiday side |
| massaged-kale-salad | massaged-kale-salad: Massaged Kale Salad | Kale salad (none in the library) |
| carrot-and-raisin-slaw | carrot-and-raisin-slaw: Carrot and Raisin Slaw | Mayo-free slaw; raisins |
| blueberry-oatmeal-pancakes | blueberry-oatmeal-pancakes: Blueberry Oatmeal Pancakes | Buttermilk/oat pancakes |
| baked-pumpkin-oatmeal | baked-pumpkin-oatmeal: Baked Pumpkin Oatmeal | Make-ahead breakfast (the library's baked oatmeal is berry) |
| cranberry-almond-breakfast-quinoa | cranberry-almond-breakfast-quinoa: Cranberry-Almond Breakfast Quinoa | Hot breakfast grain other than oats |
| carrot-muffins | carrot-muffins: Carrot Muffins | Breakfast muffin (not on any originals list) |

Taglines are all new and none says "healthy". The VA's low-sodium choices are kept (no-salt-added cans, low-sodium
broth, small amounts of salt).

## Provenance (every candidate searched)

I web-searched every candidate (ingredient list with amounts, plus a distinctive method phrase when the first search
was inconclusive) and compared the closest hits line by line.

**Excluded, now in `SOURCES.va.exclude` and `excludes.txt` (10):**
- apple-pork-tenderloin: **"Submitted by" a VA dietitian**, yet it's 12 Tomatoes' viral "Slow Cooker Hasselback Pork
  Loin" (same glaze down to 2 tbsp soy, 1 tbsp each Dijon and balsamic). So a "Submitted by" credit is not proof
  either; I reworded the comment above the exclude list to say so.
- braised-mustard-greens-with-red-beans: Food & Nutrition Magazine's "Sautéed Mustard Greens" (2018) plus beans.
- confetti-couscous: Vegetarian Times' "Confetti Couscous".
- cream-of-celery-soup: a lightened America's Test Kitchen "Cream of Celery Soup" (same covered sweat of celery,
  russet and sage, same blend-in-batches finish).
- egg-drop-cabbage-soup: Gimme Some Oven's "Cabbage Egg Drop Soup" at half size.
- garden-fresh-gazpacho: Alton Brown's gazpacho, step for step.
- lamb-vegetable-kabobs-with-tzatziki: the already-excluded SparkPeople lamb kabobs re-uploaded under a new title
  without the credit (found by comparing every candidate's ingredient words with the excluded recipes; the script
  flagged no other re-upload among my picks).
- lemon-thyme-orzo-primavera: the "Lemon Orzo Primavera" posted on Food.com/Allrecipes.
- one-pot-chicken-barley-stew: MyRecipes' "Chicken and Barley Stew".
- winter-vegetable-soup: Cooking Light's "Winter Vegetable Soup" (pancetta swapped for bacon).

`content/import/va/README.md` lists every exclusion; it isn't in my file list, so the integrator should add these 10
there (now 74 in all) and regenerate `docs/import-reports/va.md` with `npm run import:stage -- va`.

**Searched and cleared** (the VA PDF, a VA repost or nutrition.gov was the only match, or the closest published
recipes differ in ingredients, amounts and method): all 25 imports, plus mashed-potatoes-and-cauliflower,
italian-summer-soup, turkey-chili-with-beans-and-corn, oven-baked-fish-sticks and sweet-and-sour-cabbage (left out
for other reasons, below). Notes on the closer calls:
- blueberry-oatmeal-pancakes: identical on nutrition.gov, a federal site that reposts VA recipes. Kept.
- bean-and-barley-soup: word for word on a 2021 Oklahoma City TV "Tasty Tuesday" page, which copies the VA PDF
  (same "1 clove garlic, minced (½ teaspoon)" wording; the PDF credits a VA dietitian). Kept.
- hearty-pumpkin-chili: also on a va.gov facility page. Other pumpkin turkey chilis (Stetted, Savory Spice) differ.
- calabacitas-con-elote: the AHA version has no tomatoes and uses cotija. Kept.
- air-fryer-chicken-drumsticks: the 400°F, flip-at-10-minutes method is generic and the spice list differs from the
  blogs found. Kept, but it's the thinnest pick; drop it first if you want fewer.
- sweet-and-sour-cabbage: a "Sweet and Sour German Red Cabbage" on a recipe-box site has the same half head,
  1/4 cup balsamic and toss-to-coat start, with different fat and sugar. Not excluded (it's a common dish), but I
  didn't import it.

## Editing calls (for the culinary reviewer)

- **Choices among the PDF's options:** kebab oil = vegetable/avocado; tofu sweetener = maple syrup (keeps it vegan);
  pumpkin oatmeal = pumpkin pie spice; paella = fennel seeds (not dill); risotto, citrus fish and bean soup = vegetable
  broth; carrot soup garnish = cilantro (made optional); meatloaf = ketchup and Italian seasoning; green bean salad =
  dried cranberries; citrus fish = cod; lemony fish = tilapia; Indian cauliflower = jalapeños.
- **Lemony Fish:** scaled from 1 serving to 2; the "salt-free seasoning blend" became garlic powder, 1/4 tsp salt
  and pepper; second side 2–5 minutes (the PDF's 4–6 overcooks thin fillets).
- **Chicken Chow Mein:** added 1 tbsp reduced-sodium soy sauce to the slurry (the PDF's sauce is broth, cornstarch,
  sugar and pepper only and would be flat). Revert if you'd rather keep it soy-free.
- **Chicken Couscous Paella:** the PDF's "½ cups whole-wheat couscous" with ¾ cup broth made a thin dinner for 4; now
  1 cup couscous and 1 cup broth (tomato juices make up the rest), 1 tbsp olive oil instead of cooking spray, 1/4 tsp
  salt. The cooked chicken now heats in the simmering tomatoes before the couscous goes in (165°F / 74°C).
- **Cumin Quinoa with Shrimp** (PDF title "…Casserole", but it's cooked on the stovetop): raw shrimp steam on the
  quinoa for the last 4–6 minutes (the PDF's own note) instead of pre-cooked shrimp; fresh cilantro instead of dried;
  2 tsp olive oil (PDF: 1 tsp "oil"); 1/4 tsp salt; optional lime.
- **Bean and Barley Soup:** pearl barley needs 30–35 minutes, not the PDF's 20 + 5; added 1/2 tsp salt.
- **Curried Lentil Soup:** added 1/4 tsp salt; serves 6 (about 1⅓ cups), not 8.
- **Hearty Pumpkin Chili:** added 1 tbsp olive oil to brown the lean turkey; the PDF puts raw ground turkey straight
  into the slow cooker, so the slow-cooker step now browns it first, and the time is 6–8 hours on low (PDF 8–12).
  "1 (4-ounce) can green chilies" is mapped to Canned green chiles (the parser had picked fresh green chili).
- **Baked Balsamic Tofu:** added a towel-blot step so the tofu crisps.
- **Indian-Spiced Cauliflower:** spices cook 1–2 minutes over medium, not 3–4 over medium-high (they'd scorch);
  serves 6, not 8. "Chili powder" is the PDF's; a cook may prefer Indian chili powder.
- **Air Fryer Drumsticks:** doneness at least 165°F / 74°C, best at 175°F / 79°C (the PDF says 165–175°F); added an
  oven method.
- **Blueberry Oatmeal Pancakes:** added a pinch of salt; the microwaved oat mixture cools 5 minutes before the egg
  goes in.
- **Massaged Kale Salad:** the PDF adds the salt twice; it's used once, in the massage.
- Doneness added throughout: chicken 165°F / 74°C, ground turkey 165°F / 74°C, fish and shrimp 145°F / 63°C, oven
  temperatures with °C.
- Titles changed (origin unchanged): Sesame-Ginger Chicken Kebabs, Air Fryer Chicken Drumsticks, Cumin Quinoa with
  Shrimp and Black Beans, Slow-Cooker Moroccan Chickpea and Lentil Stew, Indian-Spiced Cauliflower and Peas (keeps it
  apart from r4-world's Aloo Gobi), Roasted Broccoli, Fennel and Chickpeas (no serial comma), Green Bean Salad with
  Cranberries and Almonds.
- Dish types left empty because none fits: Sesame-Ginger Chicken Kebabs, Air Fryer Chicken Drumsticks, Blueberry
  Oatmeal Pancakes.
- Equipment beyond the basics: Air Fryer Drumsticks (oven method given), Moroccan stew (slow cooker), carrot soup
  (blender or immersion blender).

## Catalog and map

- **New catalog entries** (`catalog-keys.txt`, each in `W/new-ingredients.txt`): napa cabbage (produce), bamboo shoots
  (pantry), water chestnuts (pantry), crispy chow mein noodles (grain; alias "crunchy chow mein noodles"; not soft lo
  mein noodles), fennel seeds (spice; the key was already reviewed in the map, so I added it with `import:catalog`). The first four come
  from Chicken Chow Mein; fennel seeds from the paella. None of the five names appears in an existing recipe's steps.
- **Map entries** (`map-entries.ts.txt`): VA wordings mapped to existing IDs (lite/reduced-sodium soy sauce,
  unseasoned rice vinegar, no-salt-added beans and broth, "100% pure pumpkin puree", "93% lean ground turkey",
  "frozen corn kernels", "frozen shrimp", "cauliflower head"…), the four new `{ add }` keys, `'ice cubes': false`
  (an ice bath, like water), and `null` for the "X or Y" lines where the editor picks. Calls worth a look:
  `'sweet or smoked paprika': 'paprika'` (smoked paprika is already paprika's alias), `'canola or avocado oil':
  'vegetable_oil'` (both neutral oils), `'russet or yukon gold potato': 'potato'`, `'white or cremini mushrooms':
  'mushroom'`, `'cooked chicken breast': 'chicken'`. I mapped straight to IDs rather than `=` variants so no odd
  aliases ("100 pure pumpkin puree") reach search.
- **Step-check rewording:** "Napa cabbage" (not "cabbage"), "thawed frozen spinach", "red lentils", "Greek yogurt
  sauce", "Arborio rice", "dried basil", "crispy chow mein noodles", "canned green chiles", "warm tomatoes and
  orange" (not "citrus-tomato sauce", which reads as tomato sauce). Watch "garlic, salt": the checker drops the comma
  and reads garlic salt, so the green bean dressing lists salt before garlic.
- Optional `GRAMS_PER_CUP` additions (these show in ml now; the units test passes either way): couscous 175,
  pearl_barley 200, canned_pumpkin 245, great_northern_beans 170, frozen_spinach 155, kale 67 (chopped),
  napa_cabbage 70 (chopped), dried_cranberries 120, almonds 95 (sliced or chopped), sunflower_seeds 140,
  crispy_chow_mein_noodles 45.

## Skipped, and why

- **On an originals list:** japanese-cucumber-salad (it's a smashed cucumber salad; r4-sides-apps), zesty-glazed-carrots
  and cinnamon-glazed-baby-carrots (Honey-Glazed Carrots), roasted-eggplant-spread (close to Baba Ganoush),
  oven-roasted-cauliflower (plain; near Roasted Cauliflower with Parmesan and Garlic), chocolate-zucchini-muffins
  (Zucchini Bread is listed, and its PDF's steps add chocolate chips its list never names).
- **Near-duplicates of library recipes:** sweet-and-sour-chicken (same title), orange-beef-and-vegetable-stir-fry
  (Stir-Fried Orange Beef), hearty-bell-pepper-and-turkey-skillet (Unstuffed Pepper Skillet), pesto-quinoa-bowl
  (Pesto Chicken Quinoa Bowls), italian-summer-soup (Summer Vegetable Stew, Minestrone), turkey-chili-with-beans-and-corn
  (four chilis already, and I took the pumpkin one), oven-baked-fish-sticks (Crispy Baked Cod, Cornflake-Crusted Baked
  Fish, Lemon Garlic Baked Cod), mashed-potatoes-and-cauliflower (three mashes already), maple-pecan-granola and
  olive-oil-granola (Maple Cardamom Granola), loaded-vegetable-omelet (Western Omelette), baked-french-toast and
  whole-wheat-french-toast (French Toast), banana-oatmeal-protein-pancakes (Banana Pancakes), stovetop-peach-blueberry-crisp
  (three crisps/cobblers), summer-vegetable-ratatouille, zesty-black-bean-soup, broccoli-cheese-soup, white-bean-kale-and-tomato-stew
  (Fennel, White Bean and Kale Soup), summer-vegetable-chowder (Corn Chowder), plus last round's list (pico de gallo,
  black bean burgers, breakfast burritos, chicken fajitas, Italian wedding soup and so on).
- **Too thin or a template:** apple-and-onion-salad, corn-and-celery-saute, steamed-vegetables-with-tahini-sauce
  ("4 cups vegetables, any"), cauliflower-fried-rice ("1 cup vegetables, any"), marinated-vegetables, roasted-vegetables,
  taco-seasoning, red-pizza-sauce, light-and-lemony-hollandaise-sauce, the microwave mug recipes and smoothies.
- **Left for a later batch (not yet searched unless noted):** sweet-and-sour-cabbage (searched, see above),
  spice-crusted-chicken-with-fruit-salsa (needs a fruit-salsa decision), asian-ginger-rice-soup, sweet-potato-hash,
  creamy-spinach-and-pepper-polenta, stir-fried-eggplant, sauteed-swiss-chard, edamame-salad-with-lime-dressing,
  sweet-and-savory-sweet-potato-hummus, chicken-cauliflower-enchilada-skillet, rice-and-vegetable-medley,
  parmesan-zucchini-noodles-zoodles.

## Cross-worker overlap to watch

- r4-world's Aloo Gobi vs Indian-Spiced Cauliflower and Peas (no potato, peas, steamed in the pan). Different, I think.
- r4-weeknight's Chicken and Wild Rice Soup / Pasta e Fagioli vs Bean and Barley Soup: different grains and beans.
- r4-baking-breakfast's Apple Cinnamon Muffins vs Carrot Muffins: different main ingredient, so I kept mine; glance at
  the two side by side when merging.
- If r4-world adds Napa cabbage for Japchae or similar, it should reuse the `napa cabbage` key.

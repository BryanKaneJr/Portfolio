# va: VA Nutrition and Food Services as a recipe source (round 3)

New source `va`: a fetcher that turns the VA's one-recipe PDFs into a committed snapshot, a reader, tests,
and 22 recipes appended to the new `src/data/imported/va.ts`. 12 new catalog entries, 38 new map entries,
64 excluded pages. `npm run check` passes in the worktree: 217 recipes, 266 ingredients, 395 tests.
With these 22 recipes, exact matches for common 2-ingredient pairs go from 80% to 84%, and for triples from 30% to 34%.

**Base:** my worktree was created at `c061183a` (master, 124 recipes). Before changing anything I reset it to
`0759aea8` (the round-3 base, 195 recipes, 362 tests), so `patch.diff` is against `0759aea8`.

## The source

- 54 listing pages under nutrition.va.gov/NUTRITION/Recipes.asp link 468 recipe PDFs. They hold
  **336 distinct recipes** (same recipe linked from several pages, or re-uploaded with a new date in the file
  name). The snapshot keeps the newest upload of each title, lists the rest in `alsoAt`, and keeps any
  different credit from another upload in `otherCredits`. **All 468 PDFs parsed; none dropped.** The eight
  multi-recipe cookbooks are not included and would need their own reader.
- Files: `scripts/import/fetch-va.ts` (`npm run import:fetch-va`, needs `pdftotext` and `pdfinfo` from
  poppler-utils), `scripts/import/sources/va.ts` (layout parser, listing parser, snapshot reader),
  `content/import/va/recipes.json` + `README.md` (policy quote, every exclusion, how to refetch), registry entry
  `va` in `scripts/import/sources/index.ts`, `RECIPE_COLLECTIONS.va`, `src/data/imported/va.ts`, 11 fixture
  tests in `tests/import.test.ts` (no network), doc updates in `docs/recipe-import.md` and
  `docs/recipe-sources.md` §2.
- The parser reads both layouts the site uses: two columns (an "Ingredients … Directions" header row,
  split at the Directions column; notes can sit beside the directions) and stacked headings. It rejoins
  wrapped ingredient lines (open parentheses, trailing commas or "or", "Optional toppings:" lists), drops
  group labels ("Dressing", "Equipment") and step-group headings, skips one PDF's template placeholders
  ("Recipe Title", "Prep: minutes"), and reads one PDF that labels its notes "Directions". A skipped step
  number throws, so mixed-up columns can't be saved silently. I checked a sample by eye against the PDFs
  and every anomaly the survey flagged.
- Each entry's `categories` (the listing-page headings: "Main Dishes: Poultry Recipes", "Side Dishes: …") feed
  `RawRecipe.tags`, so stage guesses meals sensibly.
- `credit` keeps the footer text as printed, including VA dietitians' names ("Submitted by …"). Those names stay
  in the snapshot only: the reader sets no `author`, so nothing but the VA credit reaches the app.

## Provenance (read this one)

- 56 recipes say "Adapted from" a blog, magazine, cookbook or organization; 2 more (hearty-red-lentil-soup,
  kale-chips) say it only on an older upload, so the newer one dropped the credit, not the recipe. The fetcher
  warns about all 58, and a test fails if any is missing from `exclude`. Two of the 56 are "Adapted from"
  another VA dietitian's recipe (foil-packet-fish, summer-fruit-salad-with-lime-yogurt-sauce). I excluded them
  too: the rule is any "Adapted from", and one of those two dietitians' own submissions are mostly adapted from
  outside sites.
- **Uncredited is not the same as VA-written.** I web-searched every pick and several candidates. Six
  uncredited recipes turned out to be published recipes, so they are excluded with the evidence in `exclude`:
  - walnut-chili-mac: the California Walnut Commission's "Walnut Chili Mac" (same ½ lb beef, ¾ cup walnuts,
    ½ cup onion, 1 tbsp oil and salsa)
  - black-bean-covered-sweet-potato: SparkPeople's "Black-Bean Smothered Sweet Potatoes"
  - flourless-black-bean-brownies: the widely published version (Prevention RD, Skinnytaste), down to "spreading
    it to the edges"
  - tuscan-bean-soup: the American Heart Association's "Tuscan Bean Soup", step for step
  - creamy-roasted-cauliflower-soup: Cookie and Kate's
  - braised-cod-and-green-beans-with-pesto: the syndicated "Poached Cod & Green Beans with Pesto" (Orlando
    Health, Just A Pinch), same reduction "to about ½ cup"
- Searched and cleared (no matching published recipe found; the VA PDF is the only hit or the closest results
  differ in ingredients and amounts): all 22 imports, plus crispy-baked-cod, asian-inspired-chicken-kebabs,
  oven-baked-fish-sticks, spinach-mozzarella-egg-bake and sweet-and-sour-chicken.
  **Lasagna Soup** is the closest call: The Mediterranean Dish has a turkey lasagna soup with the same main
  ingredients, but the amounts differ (2 vs 4 cups broth, ½ vs ¾ cup ricotta, extra spices) and lasagna soup is
  a common dish; I kept it. Drop it if you'd rather be stricter. Green Beans Almondine uses a common
  covered-skillet method that also appears on other sites, but with different amounts.
- `excludes.txt` is empty on purpose: all 64 exclusions are in `SOURCES.va.exclude`.

## Imported (source key → id: title, gap filled)

| Source key | id: title | Gap |
|---|---|---|
| grilled-chicken-taco-salad-bowls | grilled-chicken-taco-salad-bowls: Grilled Chicken Taco Salad Bowls | **Black beans with chicken**, black beans with tomato; salad, bowl |
| quinoa-enchilada-bake | quinoa-enchilada-bake: Quinoa Enchilada Bake | **Black beans with bell pepper**, black beans with cheddar; meatless bake |
| crustless-quiche-muffins | chicken-and-broccoli-quiche-muffins: Chicken and Broccoli Quiche Muffins | **Chicken with cheddar**, **broccoli with bell pepper**; make-ahead breakfast |
| vegetable-thai-curry | thai-red-curry-with-tofu-and-vegetables: Thai Red Curry with Tofu and Vegetables | **Broccoli with bell pepper**; tofu dinner (no Thai curry in the library) |
| shrimp-and-broccoli-pasta | shrimp-and-broccoli-pasta: Shrimp and Broccoli Pasta | Broccoli with pasta; quick seafood pasta |
| spinach-mozzarella-egg-bake | spinach-and-mozzarella-egg-bake: Spinach and Mozzarella Egg Bake | Spinach with eggs and tomato; breakfast for a crowd |
| stove-to-oven-vegetable-frittata | hash-brown-vegetable-frittata: Hash Brown Vegetable Frittata | Potato with eggs and cheddar |
| stuffed-bell-peppers | turkey-and-spinach-stuffed-peppers: Turkey and Spinach Stuffed Peppers | Ground turkey dinner (frozen spinach, so not the spinach pair) |
| un-stuffed-pepper-skillet | unstuffed-pepper-skillet: Unstuffed Pepper Skillet | One-pan weeknight dinner |
| unstuffed-cabbage-rolls | unstuffed-cabbage-rolls: Unstuffed Cabbage Rolls | Ground beef one-pot; cabbage |
| lasagna-soup | lasagna-soup: Lasagna Soup | Soup; pasta |
| spaghetti-squash-with-turkey-ragu | spaghetti-squash-with-turkey-ragu: Spaghetti Squash with Turkey Ragù | Lighter "pasta night" |
| apricot-chicken-tagine | apricot-chicken-tagine: Apricot Chicken Tagine | Chicken with chickpeas; one-pot |
| smokey-ham-and-bean-soup | smoky-ham-and-bean-soup: Smoky Ham and Bean Soup | Soup with ham |
| zesty-tuna-burgers | zesty-tuna-burgers: Zesty Tuna Burgers | Pantry fish dinner; sandwich |
| tuscan-tuna-salad-wrap | tuscan-tuna-salad-wraps: Tuscan Tuna Salad Wraps | No-cook lunch |
| turkey-breakfast-sausage | turkey-breakfast-sausage-patties: Turkey Breakfast Sausage Patties | Breakfast meat |
| whole-wheat-pumpkin-pancakes | whole-wheat-pumpkin-pancakes: Whole-Wheat Pumpkin Pancakes | Breakfast |
| green-beans-almondine | green-beans-almondine: Green Beans Almondine | Side (holiday) |
| okra-with-tomatoes | okra-with-tomatoes: Okra with Tomatoes | Side; okra is new to the catalog |
| garlicky-mashed-potatoes | garlicky-mashed-potatoes: Garlicky Mashed Potatoes | Side: the library had no plain mash |
| ginger-blueberry-crisp | ginger-blueberry-crisp: Ginger Blueberry Crisp | Dessert |

Taglines are all new; none says "healthy". The VA's low-sodium choices are kept (no-salt-added canned goods,
low-sodium broth, small amounts of salt).

## Source fixes and editing calls (for the culinary reviewer)

- **Choices among the source's own options** (the PDFs often say "one type or a combination"): taco bowls,
  quinoa bake and frittata use cheddar (the bake's "Mexican blend cheese" would have needed its own catalog
  item); Unstuffed Pepper Skillet uses ground turkey (source: turkey or chicken); Unstuffed Cabbage Rolls uses
  ground beef and regular brown rice (source: beef, turkey or chicken; "whole-grain rice"); the Thai curry's
  "4 cups vegetables" became 2 cups broccoli, a red bell pepper and 2 carrots; the quiche muffins' "1 cup cooked
  vegetables, ½ cup cheese, ⅓ cup cooked meat" became broccoli, bell pepper and onion, cheddar, and chicken;
  the egg bake uses fresh spinach; the tuna burgers use dried dill (source: dill or parsley, optional); the ham
  soup uses smoked paprika (not liquid smoke); the pancakes use maple syrup (not brown sugar).
- **Apricot Chicken Tagine:** the sour-cream topping's "hot sauce or hot chili oil" became a pinch of cayenne
  (the catalog has no hot sauce; adding `hot_sauce` breaks the step check on Chicken Paprikash, see nhlbi2's
  notes). The cinnamon stick became 1 tsp ground cinnamon, the PDF's own alternative, because the step checker
  reads "cinnamon stick" as ground cinnamon. Serves 4, not 6: it uses 4 thighs. The PDF gives 175°F; the recipe
  says at least 165°F / 74°C, juicy up to 175°F.
- **Unstuffed Cabbage Rolls:** the PDF simmers 1 cup uncooked brown rice for 20–30 minutes, too short for
  regular brown rice; now 40–45 minutes, in a Dutch oven (6 cups of cabbage plus about 5 cups of liquid won't fit
  a skillet). Doneness 160°F added.
- **Quiche muffins:** the PDF assumes leftover cooked vegetables; I added a 4–5 minute sauté (1 tsp olive oil,
  listed). Bake time 12–15 → 15–20 minutes with 160°F in the center. The egg mixture is about 2½ tbsp per cup
  (the PDF's 3 tbsp × 12 is more than the batch makes).
- **Spaghetti squash:** each half microwaves 8–12 minutes, not 6–8, for a 4–5 lb squash.
- **Pumpkin pancakes:** vanilla 1 tbsp → 1 tsp (1 tbsp for 1 cup of flour looks like a slip). Revert if you
  disagree.
- **Unstuffed Pepper Skillet** browns lean turkey with no oil, so it now says a nonstick skillet; the optional
  dash of cayenne is dropped.
- **Ham and bean soup:** "4 stalks celery (about 1 cup)" → 2–3 stalks; the PDF's bean-mashing note became an
  optional step.
- **Tuscan tuna wraps:** the PDF's optional onion is mixed into the dressing, so it's listed as required.
- **Servings:** turkey sausage serves 4 (2 patties; the PDF gave none); mashed potatoes serve 6, not 8 (½-cup
  portions are small for a side).
- Doneness added throughout: ground poultry 165°F / 74°C, ground beef 160°F / 71°C, shrimp and fish 145°F /
  63°C, egg dishes and egg-bound patties 160°F / 71°C.
- Garnish-only items are `opt(...)`: the bake's cilantro and lime, the curry's brown rice, the tuna burgers' buns
  and toppings, the ragù's Parmesan, the mash's chives.
- Ginger Blueberry Crisp: the PDF suggests 1 tbsp cornstarch with thawed frozen berries; not included.
- Dish types left empty because none fits: Whole-Wheat Pumpkin Pancakes, Garlicky Mashed Potatoes.

## Catalog and map: things to know

- **New catalog entries** (`catalog-keys.txt`): romaine lettuce (same key as o-chicken), enchilada sauce,
  spaghetti squash, whole wheat flour (pre-reviewed key), red curry paste, great northern beans, dried apricots,
  pumpkin pie spice, okra, Cajun seasoning, canned green chiles, frozen spinach (pre-reviewed key). Each new key
  is in `W/new-ingredients.txt`.
- **Not in my catalog: `cornmeal`.** It's a reviewed map key (the same one o-breakfast-sides uses), but adding the
  catalog entry breaks `tests/import.test.ts` "every imported recipe lists each catalog ingredient its steps use".
  Southern Biscuits (Based Cooking) says the dough "looks like coarse cornmeal". I can't edit that recipe, so I
  handed **Crispy Baked Cod** back as `extra-crispy-baked-cod.ts.txt` (searched and cleared, needs `cornmeal`
  and `whole_wheat_flour`). When o-breakfast-sides' cornmeal goes in, reword that biscuit step (e.g. "coarse
  crumbs"), then the cod can be appended to `VA_RECIPES`.
- `frozen spinach` follows the existing map decision ("cooks differently from fresh"), so the stuffed peppers and
  the frittata don't count toward spinach pairs.
- Mapping calls worth a look: `'frozen broccoli florets': 'broccoli'` (frozen broccoli swaps 1:1 with fresh,
  unlike spinach), `'frozen shredded hash brown potatoes': 'potato'`, `'quick cooking brown rice': 'brown_rice'`,
  `'olive oil mayonnaise': 'mayonnaise'`, `'white whole wheat flour': '=whole wheat flour'`. The map also has
  VA's everyday wordings ("lowfat (1%) milk", "plain nonfat Greek yogurt", "no-salt-added black beans") for the
  next VA batch.
- I dropped `'no salt added great northern beans'` from the map: an `=` variant becomes a search alias, and that
  one would have been a strange alias.
- Optional `GRAMS_PER_CUP` additions (these show in ml now; the units test passes either way): romaine_lettuce 47
  (chopped), okra 100 (sliced), great_northern_beans 170, frozen_spinach 155, dried_apricots 130,
  whole_wheat_flour 120.
- All changed files are Prettier-clean.

## Cross-worker overlap to watch

- o-chicken's Chicken Burrito Bowls and o-soups' Taco Salad sit near Grilled Chicken Taco Salad Bowls (chicken,
  lime-yogurt dressing, no tortilla). Different enough, I think.
- o-vegetarian's Spinach, Rice and Feta Stuffed Peppers vs my Turkey and Spinach Stuffed Peppers (meat, no rice).
- o-breakfast-sides' Sausage and Egg Breakfast Casserole vs my Spinach and Mozzarella Egg Bake (meatless, beans).
- nhlbi-books may bring more frittatas or egg bakes.

## Skipped, and why

- **On another worker's dish list:** chicken-fajitas, slow-cooker-chicken-fajitas and microwave-chicken-fajitas;
  chicken-tikka-masala; make-ahead-burrito-bowls; white-chili (o-chicken). black-bean-burgers,
  baked-eggplant-parmesan, pasta-primavera, three-bean-chili, tomato-spinach-and-cannellini-bean-pasta,
  zucchini-fritters (o-vegetarian). italian-wedding-soup, zesty-black-bean-soup, crunchy-taco-salad (o-soups).
  fish-tacos-with-tangy-slaw, fish-tacos-with-strawberry-salsa, curried-salmon-patties (o-pork-seafood).
  pico-de-gallo, breakfast-burritos, lemon-parmesan-broccoli, roasted-brussels-sprouts-and-carrots,
  zesty-glazed-carrots (o-breakfast-sides). turkey-joes (o-beef's Sloppy Joes).
- **Near-duplicates of library recipes:** italian-meatloaf (Tomato-Glazed Meatloaf; its PDF also leaves thyme,
  garlic powder and pepper off the list), broccoli-cheese-soup, creamless-creamy-tomato-soup and
  roasted-fresh-tomato-soup, spicy-chicken-creole, country-lentil-soup, eggs-benedict, indian-style-simmered-chicken
  (close to Chicken, Tomato and Spinach Curry), crispy-oven-fried-chicken (Crunchy Coated Chicken Breasts),
  spinach-and-red-pepper-frittata (took the hash brown frittata instead), creamy-potato-salad.
- **Templates, not recipes** ("1 lb protein, e.g. chicken, beef, tofu…"): anything-baked-burritos, hearty-stir-fry,
  baked-enchilada-casserole, naan-vegetable-pizza, pasta-skillet-with-sausage-and-vegetables,
  chicken-and-vegetable-stir-fry, sheet-pan-chicken-and-vegetables.
- **Doubtful:** chicken-tortellini-soup is close to a widely shared blog recipe (broth, diced tomatoes, kale,
  tortellini, cooked chicken, Italian seasoning).
- **Good next picks (searched, no match found):** asian-inspired-chicken-kebabs, oven-baked-fish-sticks,
  sweet-and-sour-chicken (needs a call on "frozen stir-fry vegetables"), and crispy-baked-cod (above). Not yet
  searched but promising: curried-lentil-and-pumpkin-soup, egg-drop-cabbage-soup, lemony-pan-seared-fish-with-wilted-kale.

# VA recipe snapshot

`recipes.json` is a committed snapshot of the one-recipe PDFs that VA Nutrition and Food Services links
from https://www.nutrition.va.gov/NUTRITION/Recipes.asp and the category pages under it (Main Dishes,
Sides, Breakfast, Desserts, Snacks, Beverages, Dressings, Parties and Holidays, and their subpages). The
import pipeline (`npm run import:stage -- va`, `npm run import:draft -- va …`) reads this file and never
the live site, so every report and draft can be reproduced. The app itself never reads it: drafts are
edited by hand into `src/data/imported/va.ts`. The PDFs are not committed.

- **Fetched:** 2026-10-11 (each entry's `fetchedAt`), by `scripts/import/fetch-va.ts`.
- **What it holds:** 54 listing pages link 468 recipe PDFs. Many recipes are linked from several pages,
  and some were uploaded more than once (file names carry a date), so the 468 PDFs hold **336 distinct
  recipes**, one entry per title. The newest upload (by PDF modification date) is kept; the others are
  listed in `alsoAt`, and a credit on another upload that differs from the kept one is kept in
  `otherCredits`. Every PDF parsed; none was dropped.
- **Left out on purpose:** the eight multi-recipe cookbooks linked from Recipes.asp (*Cooking With Ease*,
  *Cost-Friendly Cooking*, *One-Pot Meals*, *Practical Plant-Based Cooking*, the oncology cookbook, *Garden
  to Table*, *Cooking Around the World* and *Healthy Cooking at Home*). They need their own reader.
- **Entry fields:** `key` (kebab-case of the title, which `source.origin.key` records; titles survive
  re-uploads, file names don't), `url` (the kept PDF), `title`, `servings`, `servingSize`, `prepMinutes`,
  `cookMinutes`, `restMinutes` (a "Chill:" or "Inactive:" time; the reader adds it to prep),
  `ingredientLines`, `steps`, `notes` (the "Recipe Notes" bullets), `credit` (the footer's "Adapted from …",
  "Submitted by …" or "Inspired by a recipe submitted by …" text, or `''`), `otherCredits`, `categories`
  (the headings of the listing pages that link the recipe, which the pipeline uses as tags), `alsoAt` and
  `fetchedAt`. The text is the PDF's own wording, rejoined from `pdftotext -layout` lines. Ingredient
  group labels ("Dressing", "Equipment") are dropped, like NHLBI's. Nutrition facts and photos are not
  captured.
- **Known source slips** to watch when drafting: some PDFs' ingredient lists stop short of what the steps
  use (Italian Meatloaf's steps add thyme, garlic powder and pepper that its list never names), and a few
  number their steps oddly (Baked Balsamic Tofu restarts at 2). The draft step flags the first kind.

## License

VA's copyright policy (https://department.va.gov/copyright-policy), checked 2026-10-11:

> Pursuant to federal law, government-produced materials appearing on this and other VA websites are not
> copyright protected. The United States Government may receive and hold copyrights transferred to it by
> assignment, bequest, or otherwise.

What that means for the app (see also `docs/recipe-sources.md` §2):
- A recipe written by VA staff is a US government work with no US copyright. Recipes are adapted and
  credited per recipe (`source.origin`, collection `va`), with the credit line "Source: U.S. Department of
  Veterans Affairs, Nutrition and Food Services" in `RECIPE_COLLECTIONS`.
- The policy covers *government-produced* material only. A recipe that a VA dietitian adapted from a
  blog, magazine or cookbook is not VA's to release, whatever the PDF says.
- Never use VA logos, seals or photos, and never suggest the VA endorses the app, including in App Store
  copy or ads.

## Provenance check and exclusions (2026-10-11)

Footer credits across the 336 recipes: 249 have none, 21 say "Submitted by" a VA dietitian, 10 say
"Inspired by a recipe submitted by" one, and 56 say "Adapted from" somewhere else. Two more (Hearty Red
Lentil Soup, Kale Chips) are uncredited in their newest upload but "Adapted from" in an older one: the
credit was dropped, not the recipe. `npm run import:fetch-va` warns about all 58, and
`tests/import.test.ts` fails if any of them is missing from `exclude` in `scripts/import/sources/index.ts`.

**A missing credit is not proof that the VA wrote a recipe**, and neither is "Submitted by" a VA dietitian. Web
searches of the importers' picks traced 16 such recipes to published originals, so they are excluded too. Search a distinctive ingredient
list or sentence for every recipe before importing it.

Excluded, with the reason recorded in `exclude` (74 in all):

- **"Adapted from" an outside source (56):** asian-salmon-and-vegetable-packets (foodnetwork.com),
  barbecue-pork-sheet-pan-dinner (stockpilingmoms.com), bean-and-vegetable-tacos
  (HealthySeasonalRecipes.com), braised-chicken-and-vegetable-skillet (lyndasrecipebox.com),
  bread-stuffing-with-apples-and-celery (Delicious on a Dime), broccoli-salad (TheKitchn.com),
  brussels-sprout-and-apple-salad (Onceuponachef.com), cauliflower-quinoa-meatballs (pinchofyum.com),
  chickpea-shakshuka (minimalistbaker.com), chocolate-peanut-butter-smoothie (minimalistbaker.com),
  creamy-tomato-chicken-skillet (diethood.com), crispy-garlic-ginger-tofu (tablefortwo),
  crispy-lemon-fish (themediterraneandish.com), crunchy-thai-chicken-salad (The Lean Green Bean Blog),
  fall-quinoa-salad (EmilieEats.com), fish-and-vegetable-foil-packets (the *Low-Fat Soul Cookbook*),
  flourless-almond-butter-cookies (Live Well Bake Often), foil-packet-fish (another VA dietitian's recipe,
  itself unsourced; left out to be safe), fruit-salad-with-honey-yogurt-dressing (TheLemonBowl.com),
  ground-turkey-sweet-potato-skillet (Cooking Light), indian-spinach-with-tofu (connoisseurusveg.com),
  italian-pasta-skillet (accenthealth.com), lemon-bars (Sparkpeople.com), lemon-chicken-stir-fry
  (eatingwell.com), mediterranean-chicken-and-bulgur-skillet (Cooking Light),
  mediterranean-lamb-kabobs-with-tzatziki (Recipes.SparkPeople.com), mediterranean-salmon-salad
  (eatingwell.com), mexican-stuffed-sweet-potatoes (delish.com), pasta-with-chickpeas
  (dinnerwithjulie.com), peanut-slaw-with-noodles (Cookie and Kate), plant-powered-chocolate-muffins
  (Sarahremmer.com), pork-and-rice-skillet (iwashyoudry.com), pork-and-vegetable-fried-rice
  (smittenkitchen.com), pork-egg-roll-in-a-bowl (nomnompaleo.com), pork-tenderloin-kebabs and
  pressure-cooker-braised-chicken-thighs (America's Test Kitchen), quinoa-and-black-bean-burrito-bowls
  (toriavey.com), quinoa-tabbouleh (Thekitchn.com), rosemary-chicken-salad-sandwiches and
  rosemary-tuna-salad-sandwiches (MyRecipes), sheet-pan-tilapia-and-vegetable-medley (tasteofhome.com),
  skillet-shepherd-s-pie (Cullyskitchen.com), slow-cooker-roasted-chicken (FamilyFreshMeals.com),
  slow-cooker-stuffed-peppers (pinchofyum.com), southwest-chicken-soup (eatingwell.com),
  spinach-artichoke-dip (House of Nash Eats), stovetop-chicken-divan (eatingwell.com),
  summer-fruit-salad-with-lime-yogurt-sauce (another VA dietitian's recipe, itself unsourced),
  sweet-and-tangy-kale-salad (CookieAndKate.com), sweet-potato-swirl-pie-bars (Eating Well),
  sweet-vanilla-acorn-squash (Dessert for Two), tomato-and-sausage-bean-stew (budgetbytes.com),
  tropical-tex-mex-shrimp-fajitas (smittenkitchen.com), tuna-sushi-bowl (EatingWell.com),
  unstuffed-cabbage-roll-soup (the Wholesome Dish), zucchini-muffins (Cookie and Kate).
- **"Adapted from" on an older upload only (2):** hearty-red-lentil-soup (Diabetes.org), kale-chips
  (Ohsheglows.com).
- **Uncredited, traced to a published original (6):** walnut-chili-mac (the California Walnut
  Commission's "Walnut Chili Mac"), black-bean-covered-sweet-potato (SparkPeople's "Black-Bean Smothered
  Sweet Potatoes"), flourless-black-bean-brownies (the widely published flourless black bean brownie:
  Prevention RD, Skinnytaste), tuscan-bean-soup (the American Heart Association's "Tuscan Bean Soup"),
  creamy-roasted-cauliflower-soup (Cookie and Kate's), braised-cod-and-green-beans-with-pesto (the
  syndicated "Poached Cod & Green Beans with Pesto").

- **Matched published recipes in the second import round (10):** apple-pork-tenderloin ("Submitted by" a VA
  dietitian, but 12 Tomatoes' Slow Cooker Hasselback Pork Loin), braised-mustard-greens-with-red-beans (Food &
  Nutrition Magazine), confetti-couscous (Vegetarian Times), cream-of-celery-soup (America's Test Kitchen,
  lightened), egg-drop-cabbage-soup (Gimme Some Oven), garden-fresh-gazpacho (Alton Brown),
  lamb-vegetable-kabobs-with-tzatziki (the excluded SparkPeople kabobs re-uploaded without the credit),
  lemon-thyme-orzo-primavera (Food.com and Allrecipes), one-pot-chicken-barley-stew (MyRecipes) and
  winter-vegetable-soup (Cooking Light). Full evidence is in `exclude`.

That leaves 262 recipes that are importable on their credit line, each still needing a search before
import. Each batch's import notes list the recipes it searched and cleared.

## Refetching

```bash
NODE_USE_ENV_PROXY=1 npm run import:fetch-va                   # PDFs to a temp dir, deleted afterwards
NODE_USE_ENV_PROXY=1 npm run import:fetch-va -- --pdf-dir DIR   # keep the PDFs in DIR and reuse them
git diff content/import/va/recipes.json
```

Needs `pdftotext` and `pdfinfo` (poppler-utils) on the PATH. The fetcher walks every listing page linked
from Recipes.asp (content area only, so the cookbooks in the site menus are skipped), then downloads each
recipe PDF one at a time with a pause, using the User-Agent `Cook With That content review`. It reads two
layouts: two columns (an "Ingredients … Directions" header row) and stacked headings. A PDF in any other
layout, or whose step numbers skip (the sign of mixed-up columns), fails loudly and is reported as
unreadable instead of being saved half-parsed. It warns about every recipe whose credit, on any upload,
says "Adapted from"; add those to `exclude` with the reason. Review the diff before committing: a
re-uploaded recipe keeps its key, so a recipe already imported from it may need the same edit, and a
changed credit may mean an import has to come out.

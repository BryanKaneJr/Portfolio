# nhlbi-books: NHLBI's recipe books as a source, and 23 recipes from them

`npm run check` passes in the worktree: **218 recipes, 265 ingredients, 393 tests** (base: 195 / 254 / 362).
Coverage report with my additions on the round-3 base: common 2-ingredient pairs 80% → 84%, triples 30% → 33%.

**Base.** My worktree was created at `master` (c061183a, 124 recipes). Before changing anything I moved it to the
round-3 base, `0759aea8` (tip of `claude/cook-with-that-recipe-sources`), so `patch.diff` is against 0759aea8.

## The snapshot (content/import/nhlbi-books/)

- **172 recipes** from four PDFs on nhlbi.nih.gov, fetched 2026-10-11: *Deliciously Healthy Dinners* 75,
  *Deliciously Healthy Family Meals* 43, *Heart-Healthy Home Cooking African American Style* (2021 ed.) 26,
  *Delicious Heart-Healthy Latino Recipes* (2024 ed., English pages) 28. PDFs are not committed.
- `scripts/import/fetch-nhlbi-books.ts` (`npm run import:fetch-nhlbi-books`) downloads each PDF to a temp dir,
  runs `pdftotext -layout`, parses, deletes the PDFs and writes `recipes.json` (web-snapshot fields + `book`).
  Keys are `book-<book>/<slug>`; `url` is the PDF with `#page=N`.
- Parser: `scripts/import/sources/nhlbiBooks.ts`. Titles and page numbers come from each book's contents page;
  it finds the step column from the step numbers and splits every line there. Handles continued pages, raised
  fractions (pdftotext splits ⅛ into "1" over "/8"), "4C", "11/3" for 1⅓, glued step numbers, side labels,
  Family Meals' symbol letters, nutrition panels and the few full-width-step pages. I read every one of the 172
  parsed recipes against the layout text and fixed the parser until they read right; the remaining rough edges
  are listed in the README (none in an imported recipe).
- Not snapshotted: *Heart Healthy Recipes* (2003; NHLBI page now 404, PDF gone, Internet Archive unreachable from
  here), the superseded 2008 African American edition, the health manuals (their recipes are on the website), and
  the Latino book's Spanish pages.
- **Provenance:** no recipe credits an outside source or carries a copyright notice → no provenance exclusions.
  *Dinners* and *Family Meals* recipes were written for NHLBI by a contracted chef (and a dietitian); same basis
  as the web recipes (NHLBI's public-domain policy). README has the details; no "Keep the Beat" name, logos or
  photos are used anywhere.

## Pipeline

- Source `nhlbi-books` in `scripts/import/sources/index.ts`: `collection: 'nhlbi'`, `file: 'nhlbi.ts'`,
  `exportName: 'NHLBI_RECIPES'`, `textPolicy: 'reuse'`, file snapshot.
- **Duplicates:** `exclude` is computed at load time by `duplicatesInSnapshots()`: a book recipe whose title
  matches a web page (ignoring case, punctuation, "with"; a parenthetical name counts) is excluded in favor of the
  web page, and a later book's copy in favor of the earlier book's (45). Plus 3 by hand (excludes.txt): two web
  recipes under another name, and the African American meatloaf, whose 2021 printing has impossible amounts.
  172 − 48 = 124 importable; 23 imported; 5 more are ready to draft, the rest wait on ingredient-name review.
- `scripts/import-recipes.ts`: the stage summary now counts only this source's imported keys (both NHLBI sources
  share the collection, so it said "52 imported" for each).
- Tests (no network) in `tests/import.test.ts`, "NHLBI books reader": synthetic two-column (Dinners) and
  flush-column (African American) pages, the pdftotext quirks, title case, the duplicate rule, snapshot checks,
  and the source registration (no book key collides with a web key; reprints are excluded).
- Docs: `docs/recipe-import.md` (loop line; PDF sources; two sources feeding one collection) and
  `docs/recipe-sources.md` §2 (books status) and the ranked-list row.

## Recipes added (23, appended to src/data/imported/nhlbi.ts)

| id: title | Book key | Fills |
|---|---|---|
| stir-fried-orange-beef: Stir-Fried Orange Beef | book-dinners/stir-fried-orange-beef | beef stir-fry; broccoli + bell pepper |
| greek-style-flank-steak-with-yogurt-sauce: Greek-Style Flank Steak with Yogurt Sauce | book-dinners/greek-style-flank-steak-with-tangy-yogurt-sauce | steak dinner |
| beef-tomato-and-rice-skillet: Beef, Tomato and Rice Skillet | book-dinners/quick-beef-casserole | ground beef + bell pepper, tomato, rice |
| lomo-saltado: Lomo Saltado (Peruvian Stir-Fried Beef) | book-latino/stir-fried-beef | beef + potato + tomato |
| moroccan-chicken-stew-with-couscous: Moroccan Chicken Stew with Couscous | book-dinners/moroccan-chicken-stew-with-couscous | chicken one-pot |
| thai-green-curry-chicken: Thai Green Curry Chicken | book-dinners/thai-style-chicken-curry | curry; broccoli + bell pepper |
| sweet-and-sour-chicken: Sweet-and-Sour Chicken | book-dinners/sweet-and-sour-chicken | takeout classic |
| turkey-mole: Turkey Mole | book-dinners/turkey-mole | turkey main |
| mexican-lasagna: Mexican Lasagna | book-family/mexican-lasagna | **black beans + chicken, black beans + spinach** |
| black-bean-and-chicken-stuffed-pitas: Black Bean and Chicken Stuffed Pitas | book-family/empanapita | **black beans + chicken, broccoli, bell pepper** |
| bowtie-pasta-with-chicken-broccoli-and-feta: Bowtie Pasta with Chicken, Broccoli and Feta | book-family/bowtie-pasta-with-chicken-broccoli-and-feta | chicken + broccoli + pasta |
| caribbean-curried-chicken-and-potatoes: Caribbean Curried Chicken and Potatoes | book-african-american/finger-licking-curried-chicken | chicken + potato |
| jamaican-jerk-chicken: Jamaican Jerk Chicken | book-african-american/jamaican-jerk-chicken | chicken bake |
| spanish-style-shrimp-stew: Spanish-Style Shrimp Stew | book-dinners/spanish-style-shrimp-stew | seafood one-pot |
| fish-fillets-provencal: Fish Fillets Provençal | book-dinners/red-snapper-provencal | quick fish dinner |
| linguine-with-clam-sauce: Linguine with Clam Sauce | book-dinners/linguini-with-clam-sauce | seafood pasta |
| crispy-baked-pork-chops: Crispy Baked Pork Chops | book-dinners/baked-pork-chops | pork bake |
| ginger-soy-grilled-pork-tenderloin: Ginger-Soy Grilled Pork Tenderloin | book-dinners/grilled-pork-tenderloin-with-asian-sauce | pork tenderloin |
| caribbean-black-beans-and-rice: Caribbean Black Beans and Rice | book-dinners/caribbean-casserole | **black beans + bell pepper** |
| classic-macaroni-and-cheese: Classic Macaroni and Cheese | book-dinners/classic-macaroni-and-cheese | the library had no mac and cheese |
| brazilian-style-spinach-rice-bake: Brazilian-Style Spinach Rice Bake | book-latino/brazilian-rice | spinach + (brown) rice, vegetarian |
| black-bean-and-pepper-wraps: Black Bean and Pepper Wraps | book-latino/maria-s-veggie-wrap | **black beans + bell pepper**, vegetarian |
| bow-tie-pasta-puttanesca: Bow Tie Pasta Puttanesca | book-dinners/whole-wheat-bow-tie-pasta-with-puttanesca-sauce | vegetarian pasta (no puttanesca in the library) |

Taglines are new (none says "heart-healthy"). NHLBI's low-sodium choices are kept (low-sodium broth and beans,
no-salt-added tomatoes, reduced-sodium soy sauce, small salt amounts, lean cuts, light dairy).

## Changes from the books (for the culinary reviewer)

- **Doneness:** pork 160°F → 145°F (63°C) with a rest; every meat, fish, egg dish has its temperature.
- **Frozen "stir-fry vegetable" bags** (orange beef, Thai curry, sweet-and-sour) became the usual contents cooked
  fresh (broccoli, bell pepper, carrot, sugar snap peas), so the Avoid filter can see them. Family Meals'
  frozen broccoli-corn-pepper mix (stuffed pitas) likewise.
- **Orange beef:** dropped the optional dry sherry. **Greek steak:** fresh oregano → the book's dried
  alternative; broil 5–7 min/side to 145°F, not 10 (a 12-oz flank steak would be overdone); marinate ≤20 min at
  room temperature or longer in the fridge.
- **Beef skillet:** renamed (it cooks covered on the stove, not as a casserole); 8 → 6 main-dish servings; long-grain
  white rice named. **Lomo saltado:** named by the book's Spanish title; "3 cups boiled potatoes" → 1½ lb potatoes
  with a boiling step; "vinegar" → red wine vinegar.
- **Moroccan stew:** 1 lb chicken legs → 1½ lb bone-in thighs and drumsticks (the book's 2 legs each from 1 lb
  is too light), simmer 20–25 min (book 10–15 is short for bone-in); the "Moroccan spice blend" became its
  components from the book's footnote; dropped the optional chili sauce; fresh mint.
- **Thai curry:** lemongrass kept (book's fallback is lemon zest). **Sweet-and-sour:** "Asian hot chili sauce" →
  sriracha. **Turkey mole:** sesame seeds only as garnish (they were "optional" in the sauce); cool 10 min before
  blending.
- **Mexican lasagna:** the book's separate "Super Quick Chunky Tomato Sauce" is inlined (roasted peppers, canned
  tomatoes, garlic, basil; I dropped its 5.5-oz can of tomato juice and simmer 10 min instead); the "grilled
  chicken" leftovers get a bake-the-chicken step (or use leftovers); tortillas per layer spelled out (3/2/2/3).
- **Stuffed pitas (Empañapita):** renamed; 2 pitas holding 1½ cups each → 4 pitas, ¾ cup per half; the book's
  Tangy Salsa → store salsa on the side; added ½ tsp cumin.
- **Bowtie pasta:** broccoli cooks with the pasta (book: pre-cooked); added pepper.
- **Curried chicken:** renamed; the book's 75-minute simmer (30 + 30 + 15) → about 45 minutes (breasts dry out);
  1 potato → 2 (the book has 1 potato for 10 servings); 10 → 6 servings; "hot pepper" → jalapeño or Scotch bonnet.
- **Jerk chicken:** bake 30 covered + 15–25 uncovered to 165°F (book: 40 + 30–40); "vinegar" → white vinegar;
  dried hot pepper → red pepper flakes; foil-lined pan instead of greased; 10 → 6 servings.
- **Shrimp stew:** the book's "2 lb new potatoes (about 2 C)" contradicts itself → 1 lb; oregano → dried (book alt).
- **Fish Provençal:** renamed from "Red Snapper Provencal" because the catalog has tilapia but no snapper (the
  book allows snapper, bass or tilapia); dropped the optional anchovy paste; times for thin fillets.
- **Pork chops:** renamed; bake 15 + 8–12 min for ½-inch chops (book 20 + 15 at 160°F). **Pork tenderloin:**
  renamed; the sauce is split so the brush that touched raw pork never goes back into the basting sauce;
  2 lb serves 6.
- **Caribbean black beans and rice:** the book says the beans are rinsed and then cooked "including liquid";
  I rinse them and add ½ cup water; 10 side servings → 4 main.
- **Mac and cheese:** evaporated milk ½ → 1 cup (½ cup for 8 oz macaroni bakes dry); ¼ cup cheese on top.
- **Spinach rice bake:** renamed from "Brazilian Rice"; the onion is softened in the olive oil first (the book
  stirs raw onion and oil into the mix); "liquid egg-white substitute" → liquid egg whites; 160°F center.
- **Wraps:** renamed from "Maria's Veggie Wrap"; chili powder required (book: optional); salsa listed (the book
  uses it in a step but doesn't list it).
- **Puttanesca:** 35-oz can → 28-oz; dropped the optional anchovy paste; garlic 2 min, not 5; sauce simmers 10 min.

## Skipped, and why

- Reprints (47, excluded in the source) and the misprinted meatloaf.
- On another worker's dish list or close to a library recipe: Pasta Primavera, Three-Bean Chili, Quinoa and
  Black Bean Salad, Baja-Style Salmon Tacos, Chicken Quesadillas, Tuna and Avocado Cobb Salad, Mediterranean
  Kabobs, Pasta Caprese, Oatmeal Pecan Waffles, Bruschetta, Fresh Salsa, Jumpin' Jambalaya, 1-2-3 Peach Cobbler,
  Southern Banana Pudding (originals lists); Shepherd's Pie, Tofu Stir-Fry, Zesty Tomato Soup, Homestyle
  Biscuits, Oven-Crusted Chicken Breast, Crunchy Chicken Fingers, Make-Your-Own Turkey Burger, "Fried" Rice,
  Turkey Meatloaf, Peanut Butter Hummus, Parmesan Green Beans, Red, White, and Green Grilled Cheese (library).
- Would each add two new niche catalog items: Teriyaki-Glazed Salmon (teriyaki sauce, mirin), Pork Chops in Warm
  Cherry Sauce (dried cherries, tarragon), Lemon and Garlic Pasta with Scallops (scallops), Mexican Beef and
  Hominy Stew (hominy).
- **Good next picks:** Cocoa-Spiced Beef Tenderloin with Pineapple Salsa, Beef Steak with Light Tomato Mushroom
  Sauce, Broiled Sirloin with Spicy Mustard and Apple Chutney, Chicken and Celery Stir-Fry, Baked Red Snapper with
  Zesty Tomato Sauce, Rotini with Spicy Red Pepper and Almond Sauce, Lentils with Brown Rice and Kale, Broccoli
  with Asian Tofu, Mediterranean Pork Penne, Garden Turkey Meatloaf, Chilean Corn and Meat Pie, Smothered Greens,
  Candied Yams, Classic Honey Flan, Heart-Healthy Sweet Potato Pie, Broccoli and Cheese, Spinach and Corn
  Pancakes, Teriyaki-Glazed Salmon and the cherry pork chops.

## For the integrator

- **Same file as `sweep`:** both append to `src/data/imported/nhlbi.ts`. My 23 ids are above; my origin keys all
  start with `book-`, so they can't collide with web keys, and every web recipe a book reprints is excluded on
  the book side (so a later web import never duplicates a book import).
- **Possible overlaps with originals** (different dishes, but check after merging): Beef, Tomato and Rice Skillet
  vs o-beef "Ground Beef, Spinach and Rice Skillet"; Black Bean and Pepper Wraps vs o-vegetarian "Black Bean and
  Rice Burritos"; Mexican Lasagna vs the enchilada dishes; Ginger-Soy Grilled Pork Tenderloin vs o-pork "Garlic
  Herb Pork Tenderloin"; Crispy Baked Pork Chops vs "Pork Schnitzel".
- **Catalog (catalog-keys.txt):** 11 entries via `import:catalog`. Shared keys: flank steak (o-beef; pre-reviewed
  in the base map), pork tenderloin (o-pork-seafood), turkey breast (o-chicken), monterey jack (o-vegetarian),
  cornflakes (sweep), mustard powder, sesame seeds, mint (pre-reviewed). New and registered by me: lemongrass,
  green curry paste ("Thai green curry paste"), roasted red peppers. `sesame_seeds` is only optional (garnish) in my
  recipes. `import:catalog` writes one line longer than Prettier allows (roasted_red_peppers); `npm run format`
  after merging if you want ingredients.ts clean.
- **GRAMS_PER_CUP suggestions** (metric shows ml today): `cornflakes: 100` (crumbs), `monterey_jack: 113`,
  `roasted_red_peppers: 150`, `black_olives: 135`, `couscous: 175`. My Monterey Jack line already carries grams.
- Not edited because they're outside my files: the header comment of `src/data/imported/nhlbi.ts` still says
  "recipe pages" only (it could add "or `-- nhlbi-books` from content/import/nhlbi-books/recipes.json"), and
  CLAUDE.md's commands could list `NODE_USE_ENV_PROXY=1 npm run import:fetch-nhlbi-books` (needs poppler's
  `pdftotext`).

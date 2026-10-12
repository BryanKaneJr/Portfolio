# CLAUDE.md — Cook With That

Handoff notes for Claude Code. Read this first, then `README.md`, `AGENTS.md` (Expo SDK rules) and `docs/`.

## What this is
**Cook With That**: an iPhone-first, offline, paid-upfront recipe finder (Expo SDK 57 + React Native + TypeScript, Expo Router).
The original spec is `docs/What_Should_I_Cook_Build_Plan.md` ("What Should I Cook?" was the working name). It's the source of
truth **except where the decisions below override it**.

Hard rules (from the plan, still in force):
- No backend, accounts, APIs, analytics, subscriptions, IAP or remote images. Everything is bundled and works in airplane mode.
  (`tests/offline.test.ts` fails on any `fetch(`/URL in `src/`, including URLs in comments; put links in `docs/`.)
- Matching is deterministic: **Use** = AND over *required* ingredients (optional garnish never counts); **Avoid** = hard
  exclusion over *all* listed ingredients incl. optional; Meal/Dish type are hard filters. Never silently relax a restriction.
- Close matches are labelled ("Uses 2 of 3 · Doesn't use: Spinach"), never called substitutions.
- Never copy recipe directions/photos from sites without permission. Every recipe needs `source` metadata.

## Decisions made with the owner (override the plan where they conflict)
1. **Two home modes** (toggle at top): *Pick ingredients* (Use/Avoid) and *My pantry* (saved list of what you keep on hand →
   shuffled list of recipes you can fully make, narrowed by Meal/Dish type; separate "One ingredient short" section below).
   Pantry was out of scope in the plan; owner asked for it.
2. **Kitchen staples are a My Pantry concept ONLY.** 20 defaults in `src/data/staples.ts` (salt, pepper, water, veg/olive oil,
   butter, flour, sugar, brown sugar, baking soda/powder, vanilla, garlic powder, cinnamon, paprika, oregano, thyme, cumin,
   chili powder, red pepper flakes). In pantry mode they count as on hand and get a STAPLE badge on recipe pages.
   In Pick mode they have **no effect**: cards and recipe pages list every ingredient. User can edit/disable on the
   Kitchen staples screen.
3. **Suggestions:** "Most common" ranked from published recipe-frequency data (`src/data/popularity.ts`,
   `docs/ingredient-popularity.md`). Inline shows **11** (sized so "More options" fits on an iPhone 15 screen without
   scrolling; owner removed Carrot for this). **More options** opens `src/app/ingredients.tsx`: full scrollable list with
   pinned search, works for pick/pantry/staples targets (`src/state/pickerTarget.ts`).
4. Pick-mode suggestions never show generic basics (oil, flour, butter, spices). Owner: "No one is using olive oil as an
   ingredient to come up with ideas." They're still reachable via search / More options (e.g. to Avoid butter).
5. Meal and Dish type are **dropdown buttons** (bottom sheet with recipe counts per option), not chip rows.
6. Home footer has **✓ Use / ⊘ Avoid buttons** that open `src/app/selections.tsx` (move between lists, remove, clear).
7. **Imported recipes grow the catalog** (owner, 2026-10-09: "add ingredients that are missing from our catalogue when a
   recipe includes one we don't have"). A missing ingredient never blocks an import: review its wording once in
   `scripts/import/ingredient-map.ts` (`{ add: category }`), and `import:draft` adds it to `src/data/ingredients.ts`.
   Never alias a different food to an existing ID to avoid adding one. New items aren't "Most common" suggestions unless
   they're on the published frequency lists (corn and orange were; they sit below the 11 inline chips).
8. **Units setting** (owner, 2026-10-09: "a toggle in settings that changes to metric or whatever those British guys
   do"). Settings (gear on home, `src/app/settings.tsx`) → **US / Metric**. Recipes stay authored in US units; metric is
   display-only (`src/logic/units.ts`): grams for solids with a known cup weight (`GRAMS_PER_CUP`), ml for liquids,
   tsp/tbsp unchanged, US cans → tin sizes, oven temps as "175°C (155°C fan, gas 4)" (air-fryer, frying-oil and sugar
   temps get plain °C), inches → cm, and the author's own metric ("1 lb (450 g)") wins. First launch defaults from the device region (US and territories, Liberia, Myanmar →
   US; everyone else metric). `tests/units.test.ts` fails if any recipe leaves a US unit in metric mode. To fit the gear
   without changing the header height (decision 3's sizing), Favorites became a round ♥ button like it.
9. **Taglines** (owner, 2026-10-09: "I like the tagline under the recipe name too. Let's keep that going."). Every recipe's
   `description` is a fresh, concrete one-liner (40–130 chars, no hype, no "!"). Style guide: `docs/recipe-import.md`
   "Taglines"; `tests/taglines.test.ts` enforces it.
10. **No Avoid groups; the cook checks for allergens** (owner, 2026-10-09: "no thats on the person making the food.
   maybe in settings?"). Avoid stays per ingredient: avoiding pork chops doesn't hide bacon, and avoiding chicken
   doesn't hide chicken broth. Don't add food groups or "contains" tags. Instead, Settings has an **Allergies** note
   saying Avoid only sees listed ingredients and the cook must check labels. Keep that note off the Avoid list itself.
11. **Every recipe has a dish type** (owner, 2026-10-11: "add dish types so none are absent from recipes"; no-bake
   desserts "can just go in dessert"). Six were added to the plan's nine: **Grilled** (grill or broiler is the main
   method), **Fried** (deep, shallow in 1/4 inch or more of oil, or air-fried), **Dips & Salsas**, and **Appetizers**,
   **Sides** and **Desserts**. The last three follow from the meal: `RECIPES` adds them to every appetizer, side and
   dessert (`MEAL_DISH_TYPES`, `withMealDishTypes`), so recipe files don't list them, and cards and recipe pages
   don't repeat them next to the meal (`shownDishTypes`). The validator rejects a recipe with no dish type. Keep the
   labels short: the Dish type button cuts off anything longer than about 13 characters.
12. **No egg warnings** (owner: "being scared of people not cooking yolk is ridiculous... people eat over easy eggs
   every day"). Runny yolks, hollandaise, carbonara and tiramisu carry no caution or pasteurized-egg note.
13. **Medium-rare is fine, with the USDA's number beside it** (owner: "just put a disclaimer of what the usda says").
   Steaks and lamb chops cook to 130°F (54°C) for medium-rare, then "The USDA recommends 145°F (63°C) with a 3-minute
   rest." Poultry, ground meat, pork and fish keep the USDA temperatures.
14. **Season savory dishes, where fitting.** A savory recipe with nothing salty in it gets salt (to taste, or measured
   when it can't be tasted raw), even from a low-sodium source. Don't add salt where bacon, ham, cheese, soy or a
   salty sauce already seasons the dish ("you dont salt certain foods, like bacon").
15. **Equipment never filters recipes** (owner: "we dont list equipment in filters"). A waffle iron or food processor
   is fine when it defines the dish.
16. **My Kitchen: your recipes, notes, meal plan, shopping list** (owner, 2026-10-11: "save the recipes, then also edit
   them… save the alterations you made… then maybe a meal plan calendar"). The owner chose: an edit **replaces** the
   bundled recipe for that person everywhere (search, Avoid, pantry, plan), with "Show original" on the recipe page;
   everything is editable; ingredients are picked from the catalog so search stays exact, with a "your own
   ingredient" fallback (`custom:` IDs) that search and Avoid can't see; people can write recipes from scratch (`my-`
   IDs); a week plan with breakfast, lunch and dinner slots plus a shopping list that leaves out the pantry and
   staples. All on the phone (AsyncStorage, `src/state/favoritesStorage.ts`). ♥ on home opens **My Kitchen**
   (Saved · Meal plan · Shopping list): a third header button doesn't fit beside the title at iPhone widths. Every
   screen that searches uses `app.library` (bundled + edits + own), never the bundled `RECIPES` directly.
17. **Our written recipes stay separate from adapted ones** (owner, 2026-10-11: "for now keep original recipes separate
   from our from scratch ones"). `src/data/recipes.ts` has `WRITTEN_RECIPES` (27 seed + `src/data/originals/`, source
   type 'original'), `SOURCE_RECIPES` (`src/data/imported/`, 'licensed') and one switch, `INCLUDE_WRITTEN_RECIPES`
   (on), so a release can leave the written ones out. Nothing in the app labels or filters them. Tests keep each list
   to its own kind and check the adapted recipes alone still form a valid library.
18. **No cook-testing required** (owner, 2026-10-11: "we don't need to test I don't think"). The paper review is the
   last check, so every new batch gets one (reviewers reading each recipe as a cook, plus `npm run audit:recipes`,
   whose `ratio` check flags leavening, yeast and salt per cup of flour, liquid per cup of grain, gelatin per cup of
   liquid, pasta and meat per serving, and oven and frying-oil settings).
   Written recipes are also **checked against published ones** (owner, 2026-10-12: "find recipes on the internet…
   compare against to see if they work… cut the least confident ones"): each is compared with 2–3 published versions
   of the dish, numbers outside their shared range are fixed, and a recipe that matches one source across the board is
   reworked from ratios (`docs/recipe-review/verification/`).

## Layout
```
src/app/         index (home, both modes), results, ingredients (More options), selections, staples, settings,
                 pantry, pantry-results, recipe/[id] (edit, notes, add to plan), favorites (My Kitchen: saved, meal
                 plan, shopping list), edit (recipe editor), plan-add, _layout (ReadyGate waits for storage restore)
src/components/  Chip, Dropdown, IngredientBrowser (compact|full), UseAvoidToggle, SelectionSummary, RecipeCard,
                 AddToPlanSheet
src/data/        types, ingredients (399, with aliases), recipes (27 seed + originals/ + imported/), collections,
                 recipeBuilders, staples, popularity, labels, catalog
src/logic/       matchRecipes (engine), pantry, sortRecipes, normalizeIngredient (search: aliases, plurals, typos),
                 validateContent, units (US/metric display), userRecipes (edits, own recipes, library), mealPlan
src/state/       AppState (context + AsyncStorage persistence), searchState, pickerTarget, favoritesStorage
scripts/         validate-recipes.ts, coverage-report.ts, import-recipes.ts + import/ (parser, mapper, source readers)
tests/           Jest: engine, pantry, staples, content validation, import pipeline, originals, units, taglines,
                 myKitchen (edits, own recipes, plan, shopping), offline audit, searchAudit (randomized invariants over the real library + catalog-wide search checks)
```

## Commands
```
npm install
npx expo start          # Expo Go on iPhone (same Wi-Fi), scan QR
npm run check           # tsc + content validator + jest. Run before calling anything done
npm run coverage-report # which common ingredient pairs/triples have no recipes
npm run import:stage -- based-cooking   # or nhlbi; then import:draft / import:catalog: see docs/recipe-import.md
NODE_USE_ENV_PROXY=1 npm run import:fetch-nhlbi   # refetch the NHLBI snapshot (content/import/nhlbi/)
NODE_USE_ENV_PROXY=1 npm run import:fetch-nhlbi-books   # or import:fetch-va: PDF sources, need pdftotext
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for native deps).

## Current status
- Phases 0–4 of the plan done, plus the features above. Verified via Expo web export + Playwright at iPhone sizes;
  **never yet run on a physical iPhone**: do that early.
- All 668 recipes are drafts marked "needs culinary review" (validator warns): 27 seed and 377 newer originals written
  for the app, 157 adapted from Based Cooking, 59 from NHLBI (web and cookbooks) and 48 from the VA (all public domain).
  98% of common 2-ingredient picks find an exact match (73% of triples).
- Bundle ID `com.cookwiththat.app` is a placeholder.
- **Search and filters audited (2026-10-09, before growing the catalog further).** `tests/searchAudit.test.ts` runs
  1,500 random searches and 500 random pantries against the real library and checks every rule above longhand
  (it was confirmed to catch deliberately broken engine code). The engine was correct. Fixed: ingredient search missed
  plurals ("eggplants", "berry"), misspellings ("brocoli", "parmesean"), describing words ("unsalted butter",
  "extra virgin olive oil") and everyday/British names (sea salt, caster sugar, lemon juice, macaroni, egg whites,
  streaky bacon, yoghurt); see "How search reads what people type" in `docs/ingredient-mappings.md`. Aliases are
  also trusted by the importer as the same food, so only add true synonyms. The results page now says "No recipe
  needs Walnuts yet" for a Use ingredient that's only optional (8 catalog items: lentils, walnuts, capers…) and offers
  "Remove Walnuts" directly.

## Phase 5 so far: sources and import pipeline (2026-10-08)
- **Original recipes** (2026-10-11): open sources can't reach a big library on their own, so recipes written for the
  app go in `src/data/originals/` (one file per theme). Rules: `docs/original-recipes.md` (write from general
  knowledge, never from a published recipe; same standard and checks as imports).
- **Sources reviewed:** `docs/recipe-sources.md` (ranked, with quoted licenses). Bundle only public domain, CC0 or
  Unlicense text, or text we wrote. **No CC-licensed text, not even CC BY:** CC 4.0 forbids "effective technological
  measures", and CC's own wiki says App Store FairPlay may violate that. Wikibooks is for facts and ideas only.
  TheMealDB and the scraped datasets are out.
- **Pipeline:** `docs/recipe-import.md`. Run `npm run import:stage -- based-cooking` (pinned snapshot → report in
  `docs/import-reports/`), then `npm run import:draft -- based-cooking --next N` (drafts land in `src/data/imported/`
  with `source.origin` filled in and TODO markers). Edit the drafts by hand, then run `npm run check`.
  Reviewed ingredient wording lives in `scripts/import/ingredient-map.ts` (never a substitution).
- **Guards:** `validateContent` checks each origin's collection and license against `src/data/collections.ts` and
  rejects a second import of the same original. Tests fail on any TODO/NaN left in `src/data/imported/`, and on a
  step that uses a catalog ingredient the list leaves out (it would slip past Avoid).
- **Batches:** 9 Based Cooking recipes on 2026-10-08, 19 more on 2026-10-09, then a parallel run the same day: four
  workers took alphabetical slices of Based Cooking (58 recipes) and one added **NHLBI** as a second source (14 recipes;
  a source can now be a committed snapshot file, see `scripts/import/snapshot.ts`). 124 recipes, 202 ingredients.
  Exact matches for common 2-ingredient pairs: 35% → 47% → 69%.
- **Round 2 (2026-10-11):** five more workers (four Based Cooking slices, one NHLBI) aimed at the gaps the search audit
  showed: rice (3 → 15 recipes need it), black beans (2 → 5), broccoli, spinach, soups, desserts. 71 recipes, 52
  catalog additions, 18 more exclusions. 195 recipes, 254 ingredients; pairs 69% → 80%, triples 21% → 30%.
- **Round 3 (2026-10-11, owner: "We need more recipes. A lot more."):** ten workers. Seven wrote 176 original recipes
  from dish lists by theme (classics the library lacked, aimed at the coverage gaps); two built PDF sources (VA: 336
  recipes snapshotted, 64 excluded; NHLBI cookbooks: 172) and imported 23 each; one swept Based Cooking and NHLBI's
  web pages for 25 more. 442 recipes, 346 ingredients; pairs 80% → 96%, triples 30% → 64%. Worker notes, including
  what to cook-test, are in `docs/import-notes/2026-10-11-round-3/`. Worktrees from the Agent tool start at `master`,
  not the current branch: tell workers to fast-forward to the working branch before they start.
- **Round 4 (2026-10-11, owner: "one more batch to get at least over 500"):** four workers wrote 81 originals (world
  dinners, weeknight one-pots and sheet pans, sides and appetizers, baking and breakfast) and one imported 25 more VA
  recipes, excluding 10 more VA pages that matched published recipes. 548 recipes, 380 ingredients. Notes in
  `docs/import-notes/2026-10-11-round-4/`.
- **Deep recipe review (2026-10-11):** `npm run audit:recipes` (script flags, `docs/recipe-audit.md`), then eleven
  reviewers read all 548 recipes as cooks and fixed 97 (yields, ratios, pan sizes, step order, safety, taglines, tags).
  The owner then settled the open questions (decisions 11–15; cooked-rice lines now give the uncooked amount; four
  confusable titles were made clearer; four suggested tweaks were applied after checking). Summary, what changed
  for each decision and the cook-test-first list: `docs/recipe-review/README.md`; per-group detail in
  `docs/recipe-review/rv01.md` … `rv11.md`.
- **Round 5 (2026-10-11, owner: "send some workers to write more recipes"):** six writers, 20 originals each, in new
  theme files: comfort food, breakfast, grilled and fried, soups/salads/bowls/dips, world dinners, desserts and snacks.
  Lists aimed at thin areas (breakfast, grilled, fried, dips, salads) and at common trios with no exact match (pasta +
  cheddar + broccoli, eggs + rice + ground beef…). 668 recipes, 399 ingredients; triples 66% → 73%. The owner asked
  whether writers copy recipes from the internet: they write from their own knowledge and may only look up facts.
  This round was audited: no writer made a single web search or fetch (their transcripts were checked), and a web
  search of sample sentences found no published match. Owner's other worry, "recipes that simply dont work", is why
  every batch gets the paper review (decision 18). Notes: `docs/import-notes/2026-10-11-round-5/`; review:
  `docs/recipe-review/round-5/` (36 of 120 fixed; the soft pretzels and layer bars were rewritten from ratios after a
  reviewer recognised published formulas).
- **Checked against published recipes (2026-10-12):** nine checkers compared all 404 written recipes with 2–5
  published versions each (1,208 sources cited). All work: 393 as written, 11 had one number outside the published
  range and were fixed, none scored below 4 of 5, so none was cut. 16 matched one published recipe across the board
  (Toll House cookies, Pioneer Woman tres leches, Eagle Brand fudge…) and were reworked from ratios, then checked the
  same way. Scores, sources and notes for every recipe: `docs/recipe-review/verification/`.
- **Provenance is the real risk in Based Cooking.** Workers traced ~25 pages to commercial recipes (Food.com, Taste of
  Home, HelloFresh, BBC Good Food, Dairy Farmers of Canada…). One contributor copied so often that all their pages are
  excluded (`excludeAuthors`), and 3 earlier imports were removed. Some pages dropped an "adapted from" credit in a later
  edit, so check the page's **git history**, not just the snapshot (a full clone of based.cooking does it). 76 pages are
  excluded, each with its reason, in `scripts/import/sources/index.ts`.
- **History has gaps.** Pages from before the 2022 Hugo move lived at `src/<key>.md` (search `--all -- '*/<key>.md'`).
  Two bulk commits restart a page's history: `0694559` ("add publicdomainrecipes.com recipes", 146 pages; the earlier
  history is in the Public Domain Recipes repo on Codeberg, also Unlicense) and `97e5806` ("foss cooking content
  added"). Check those pages' history in the repo they came from.
- **Public domain by age is fine.** A page crediting a book published before 1931 (Miss Leslie's 1832 receipts) is not
  excluded; keep the credit as the origin's author. A credit to anything newer still means exclusion.

## NEXT TASK
1. **Paper review of every new batch** (decision 18: no cook-testing). Done for all 668: the first 548 in
   `docs/recipe-review/`, round 5's 120 in `docs/recipe-review/round-5/` (36 fixed; two formulas a reviewer recognised
   as published ones were rewritten from ratios). New batches get the same: reviewers reading each recipe as a cook,
   plus `npm run audit:recipes`. The "cook-test first" lists are now lists of the riskiest recipes to re-read.
   All 404 written recipes were then checked against published versions (`docs/recipe-review/verification/`); new
   written batches get that check too. The 96 recipes scored 4 of 5 are the candidates if the owner wants a stricter
   cut.
2. **More recipes:** originals are the main stream now (`docs/original-recipes.md`; assign each writer a theme file
   and a dish list so lists never overlap). Sources still hold more (`docs/import-reports/`: VA 18 ready, NHLBI
   cookbooks 5, Based Cooking 27, NHLBI web 4, plus many waiting on ingredient review). Every VA recipe needs a web
   search before import, credited or not: 16 uncredited or "Submitted by" recipes turned out to be published ones. The
   common-pair gaps left are odd combinations (chicken with ground beef, rice with pasta or potato, pasta with black
   beans); the triples report shows where depth is thin. Merge workers one at a time: copy an originals file whole,
   append importers' recipes, then `npm run import:catalog` for each new key.
3. Next source after these: HowToCook (Chinese home cooking, Unlicense, needs translation), see recipe-sources.md.
4. Before release: an acknowledgements screen built from `RECIPE_COLLECTIONS` (NHLBI asks for its credit line, the VA
   for proper attribution with no implied endorsement; Based Cooking needs none). Optional: British ingredient names in metric mode (plain flour, courgette, coriander).

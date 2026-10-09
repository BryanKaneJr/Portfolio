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
   tsp/tbsp unchanged, US cans → tin sizes, oven temps as "175°C (155°C fan, gas 4)", inches → cm, and the author's own
   metric ("1 lb (450 g)") wins. First launch defaults from the device region (US and territories, Liberia, Myanmar →
   US; everyone else metric). `tests/units.test.ts` fails if any recipe leaves a US unit in metric mode. To fit the gear
   without changing the header height (decision 3's sizing), Favorites became a round ♥ button like it.
9. **Taglines** (owner, 2026-10-09: "I like the tagline under the recipe name too. Let's keep that going."). Every recipe's
   `description` is a fresh, concrete one-liner (40–130 chars, no hype, no "!"). Style guide: `docs/recipe-import.md`
   "Taglines"; `tests/taglines.test.ts` enforces it.

## Layout
```
src/app/         index (home, both modes), results, ingredients (More options), selections, staples, settings,
                 pantry, pantry-results, recipe/[id], favorites, _layout (ReadyGate waits for storage restore)
src/components/  Chip, Dropdown, IngredientBrowser (compact|full), UseAvoidToggle, SelectionSummary, RecipeCard
src/data/        types, ingredients (202, with aliases), recipes (27 seed + imported/), collections, recipeBuilders,
                 staples, popularity, labels, catalog
src/logic/       matchRecipes (engine), pantry, sortRecipes, normalizeIngredient (search: aliases, plurals, typos),
                 validateContent, units (US/metric display)
src/state/       AppState (context + AsyncStorage persistence), searchState, pickerTarget, favoritesStorage
scripts/         validate-recipes.ts, coverage-report.ts, import-recipes.ts + import/ (parser, mapper, source readers)
tests/           Jest: engine, pantry, staples, content validation, import pipeline, units, taglines, offline audit,
                 searchAudit (randomized invariants over the real library + catalog-wide search checks)
```

## Commands
```
npm install
npx expo start          # Expo Go on iPhone (same Wi-Fi), scan QR
npm run check           # tsc + content validator + jest. Run before calling anything done
npm run coverage-report # which common ingredient pairs/triples have no recipes
npm run import:stage -- based-cooking   # or nhlbi; then import:draft / import:catalog: see docs/recipe-import.md
NODE_USE_ENV_PROXY=1 npm run import:fetch-nhlbi   # refetch the NHLBI snapshot (content/import/nhlbi/)
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for native deps).

## Current status
- Phases 0–4 of the plan done, plus the features above. Verified via Expo web export + Playwright at iPhone sizes;
  **never yet run on a physical iPhone**: do that early.
- All 124 recipes are drafts marked "needs culinary review" (validator warns): 27 originals, 83 adapted from Based
  Cooking and 14 from NHLBI (both public domain). 69% of common 2-ingredient picks find an exact match (21% of triples).
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
- **Provenance is the real risk in Based Cooking.** Workers traced ~25 pages to commercial recipes (Food.com, Taste of
  Home, HelloFresh, BBC Good Food, Dairy Farmers of Canada…). One contributor copied so often that all their pages are
  excluded (`excludeAuthors`), and 3 earlier imports were removed. Some pages dropped an "adapted from" credit in a later
  edit, so check the page's **git history**, not just the snapshot (a full clone of based.cooking does it). 58 pages are
  excluded, each with its reason, in `scripts/import/sources/index.ts`.

## NEXT TASK
0. **Avoid groups: waiting on the owner (asked 2026-10-09).** Avoid works per ingredient, so typing "pork" and
   avoiding what it finds (pork chops, pork shoulder, pork sausage) still shows 13 recipes with bacon, ham, pancetta
   or prosciutto. The same gap exists for fish (8 recipes: salmon, tuna, Worcestershire), shellfish (4), chicken
   broth for vegetarians (7), egg inside mayonnaise (3) and nuts (peanut butter, pesto). Proposal: Avoid-only
   groups (All pork, All fish, Shellfish, All meat, Nuts, Dairy, Eggs) that search shows first, each listing what it
   covers, including foods made from it (broth, mayonnaise, pesto). Every new catalog item would then need a group
   tag, which is why it matters before adding more ingredients. Also proposed: a short note on the Avoid list that it
   isn't allergy-safe (the plan rules out allergen certification). Don't build it until the owner answers.
1. **Culinary review** is now the biggest gap: 124 drafts, none cooked or checked. Release needs every recipe reviewed
   (quantities, times, food safety). Consider a review checklist or a sign-off field per recipe. Include tags: 15
   recipes have no dish type (pancakes, guacamole, hummus, baked fries…), so any Dish type filter hides them.
2. **More recipes, same way:** Based Cooking has 30 ready to draft and 264 waiting on ingredient-name review
   (`docs/import-reports/based-cooking.md`); NHLBI has 40 more in its snapshot (`docs/import-reports/nhlbi.md`; the
   worker's picks for next: turkey and beef meatballs, 20-minute chicken Creole). Parallel workers worked well: give
   each a disjoint slice and merge their handoff files (recipes, map entries, catalog keys, excludes) one at a time.
   Before importing a Based Cooking page, check its git history for removed credits.
3. Next source: VA (nutrition.va.gov, ~275 PDFs; skip "Adapted from" ones), which needs a PDF reader.
4. Before release: an acknowledgements screen built from `RECIPE_COLLECTIONS` (NHLBI asks for its credit line; Based
   Cooking needs none). Optional: British ingredient names in metric mode (plain flour, courgette, coriander).

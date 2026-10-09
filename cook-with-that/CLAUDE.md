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

## Layout
```
src/app/         index (home, both modes), results, ingredients (More options), selections, staples,
                 pantry, pantry-results, recipe/[id], favorites, _layout (ReadyGate waits for storage restore)
src/components/  Chip, Dropdown, IngredientBrowser (compact|full), UseAvoidToggle, SelectionSummary, RecipeCard
src/data/        types, ingredients (89, with aliases), recipes (27 seed + imported/), collections, recipeBuilders,
                 staples, popularity, labels, catalog
src/logic/       matchRecipes (engine), pantry, sortRecipes, normalizeIngredient (search/aliases), validateContent
src/state/       AppState (context + AsyncStorage persistence), searchState, pickerTarget, favoritesStorage
scripts/         validate-recipes.ts, coverage-report.ts, import-recipes.ts + import/ (parser, mapper, source readers)
tests/           86 Jest tests: engine, pantry, staples, content validation, import pipeline, offline audit
```

## Commands
```
npm install
npx expo start          # Expo Go on iPhone (same Wi-Fi), scan QR
npm run check           # tsc + content validator + jest. Run before calling anything done
npm run coverage-report # which common ingredient pairs/triples have no recipes
npm run import:stage -- based-cooking   # / import:draft: see docs/recipe-import.md
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for native deps).

## Current status
- Phases 0–4 of the plan done, plus the features above. Verified via Expo web export + Playwright at iPhone sizes;
  **never yet run on a physical iPhone**: do that early.
- All 36 recipes are drafts marked "needs culinary review" (validator warns): 27 originals and 9 adapted from Based
  Cooking (public domain). Coverage is still thin: 45% of common 2-ingredient picks find an exact match.
- Bundle ID `com.cookwiththat.app` is a placeholder.

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
- **First batch:** 9 Based Cooking recipes, 36 in all. Exact matches for common 2-ingredient pairs went from 35% to 45%.

## NEXT TASK
1. **Grow the ingredient catalog.** It's the bottleneck: only 22 of Based Cooking's 440 recipes map to the 89
   ingredients. `docs/import-reports/based-cooking.md` ranks the additions that unblock the most recipes (nutmeg, bay
   leaf, cayenne, yeast, yogurt, powdered sugar, bread crumbs, mayonnaise, maple syrup, cornstarch …). Each addition is
   a product decision: also consider `popularity.ts` / `staples.ts`. Confirm the list with the owner first.
2. Keep importing Based Cooking in batches of 5–15 (realistic yield about 60–120 good recipes). Next source: VA
   (nutrition.va.gov, ~275 PDFs; skip "Adapted from" ones) and NHLBI (~200–250), both public domain. This needs a PDF
   reader in `scripts/import/sources/`. MyPlate.gov was retired in Jan 2026: archive only, ~20% federal. Fill the rest
   with originals aimed at `npm run coverage-report` gaps.
3. Before release: an acknowledgements screen built from `RECIPE_COLLECTIONS` (not legally required for public
   domain, but courteous), and culinary review of every recipe.

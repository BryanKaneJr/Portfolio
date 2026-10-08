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
src/data/        types, ingredients (89, with aliases), recipes (27 seed), staples, popularity, labels, catalog
src/logic/       matchRecipes (engine), pantry, sortRecipes, normalizeIngredient (search/aliases), validateContent
src/state/       AppState (context + AsyncStorage persistence), searchState, pickerTarget, favoritesStorage
scripts/         validate-recipes.ts, coverage-report.ts
tests/           50 Jest tests: engine, pantry, staples, content validation, offline audit
```

## Commands
```
npm install
npx expo start          # Expo Go on iPhone (same Wi-Fi), scan QR
npm run check           # tsc + content validator + jest. Run before calling anything done
npm run coverage-report # which common ingredient pairs/triples have no recipes
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for native deps).

## Current status
- Phases 0–4 of the plan done, plus the features above. Verified via Expo web export + Playwright at iPhone sizes;
  **never yet run on a physical iPhone**: do that early.
- All 27 recipes are original drafts marked "needs culinary review" (validator warns). Coverage is thin: about a third of
  common 2-ingredient picks find an exact match.
- Bundle ID `com.cookwiththat.app` is a placeholder.

## NEXT TASK: find open / free-to-distribute recipe sources (Phase 5)
Goal: grow to ~250–350 recipes we're legally allowed to bundle in a **paid, offline App Store app**. For each source,
confirm commercial use, redistribution inside an app binary, attribution and share-alike duties, and App Store compatibility.

Findings so far (verify before relying on them):
- **US copyright:** a mere listing of ingredients isn't protected. Substantial literary expression (written directions,
  headnotes, photos) is. Safest strategy remains: use ideas/ingredient lists as inspiration and **write original directions**,
  then human-review. Copyright Office fact sheet FL-122 "Recipes"; NYC Bar guide:
  https://www.nycbar.org/wp-content/uploads/2023/05/20221024-SecretIngredientsHowtoProtectRecipes_FINAL_22.6.6.pdf
- **based.cooking**: README says "This website and all its content is in the public domain" and contributors waive
  ownership. Likely usable as-is; confirm the LICENSE file and count the recipes. https://github.com/slendidev/based.cooking
- **Wikibooks Cookbook**: CC BY-SA 4.0 (a dataset dump exists: huggingface.co/datasets/gossminn/wikibooks-cookbook). Usable
  with attribution, but share-alike applies to adapted text and CC BY-SA 4.0 restricts "effective technological measures".
  Check App Store DRM compatibility before bundling. Quality varies.
- **RecipeNLG / Recipe1M / Food.com / Epicurious datasets**: scraped from commercial sites, research or non-commercial use.
  **Don't bundle.**
- **USDA MyPlate Kitchen** (and other US-gov recipe sites: NIH/NHLBI, SNAP-Ed): federal works are generally public domain,
  but some recipes are contributed by third parties. Confirm per-recipe. Not yet verified.
- **TheMealDB**: terms not yet checked. It's an API (the app can't call APIs), so only usable if the license allows bundling.
- Other ideas to check: Project Gutenberg cookbooks (pre-1929, public domain; needs modernized quantities and our own
  rewrite), other CC0 or Unlicense recipe repos on GitHub.

Deliverable the owner wants next: a short ranked list of usable sources (license, size, effort, risk), then an import
pipeline into `src/data/recipes.ts` format with `source` metadata filled in, running `npm run validate` after each batch.

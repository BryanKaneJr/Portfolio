# Cook With That

Pick the ingredients you want to use, rule out what you don't, and find something good to cook.
iPhone-first, offline, paid-upfront. No accounts, no server, no API, no subscriptions.

Source of truth: [`docs/What_Should_I_Cook_Build_Plan.md`](docs/What_Should_I_Cook_Build_Plan.md).

## Run it

```bash
npm install
npx expo start        # scan the QR code with the Expo Go app on your iPhone
```

Works from Windows: install **Expo Go** from the App Store, make sure the phone and PC are on the
same Wi-Fi, run `npx expo start`, and scan the QR code with the iPhone camera.

## Checks

```bash
npm run check            # typecheck + content validator + tests
npm run validate         # recipe/ingredient content gate (fails on any problem)
npm run coverage-report  # pair/triple ingredient coverage + gaps
npm test
```

## Layout

```
src/app/            screens (Expo Router): index (Find / My pantry), results, ingredients (More options), selections, staples, pantry, pantry-results, recipe/[id], favorites
src/components/     Chip, Dropdown, IngredientBrowser, SelectionSummary, RecipeCard
src/data/           types, ingredient catalog, recipes, labels (all bundled, offline)
src/logic/          matching engine, sorting, ingredient search, content validator
src/state/          search-state rules, local storage, app provider
src/theme/          colors (light/dark), spacing, typography
scripts/            validate-recipes.ts, coverage-report.ts
tests/              engine, content and offline-audit tests
docs/               build plan, ingredient mapping notes
```

## Matching rules (summary)

1. **Avoid** — hard exclusion against every listed ingredient, optional ones included. Never relaxed automatically.
2. **Meal / Dish type** — hard restrictions, one of each (or Any).
3. **Use** — AND across *required* ingredients. Optional garnish doesn't count.
4. Zero exact results → **Close matches**, clearly labelled with what they don't use (2 picks: must use 1; 3+: missing 1, then 2).
5. More than 30 results → non-blocking "Narrow it down?" with counts that equal what you get after tapping.

## My pantry mode

A toggle at the top of the home screen switches between **Pick ingredients** and **My pantry**.

- The pantry is a saved list of ingredients you usually have (stored on the phone only). Kitchen staples (below) count automatically.
- **Can make** = every *required* ingredient is in the pantry. Optional toppings never block a recipe.
- The list is shuffled. The order stays put while you browse and changes only when you tap **Shuffle**. Narrow it with Meal / Dish type.
- Below the list, a separate **One ingredient short** section names the single missing item on each card.
- Recipe pages opened in pantry mode show ✓ next to pantry items and a "Not in your pantry" box.

> Note: the original plan listed pantry tracking as out of scope for v1. This is a deliberate addition: a simple saved list, not inventory or quantities.

## Kitchen staples

On by default: 20 things most kitchens have — salt, pepper, water, vegetable & olive oil, butter, flour,
sugar, brown sugar, baking soda, baking powder, vanilla, garlic powder, cinnamon, paprika, oregano, thyme,
cumin, chili powder, red pepper flakes (`src/data/staples.ts`).

- They drop out of "You'll also need" on cards (shown as "+ staples") and don't hurt ranking.
- They count as on hand in My Pantry.
- Recipe pages still list them with amounts, badged **STAPLE**.
- **Avoid always wins**: avoiding butter still hides every recipe with butter.
- Users can turn the assumption off, remove items, add their own, or reset (Kitchen staples screen).

> Note: the original plan said never assume salt/oil/water/pepper. This is a deliberate product change, kept
> honest by always listing staples on the recipe page and letting users switch it off.

## Filters & selections

- **Meal** and **Dish type** are dropdown buttons that open a bottom sheet with a recipe count beside each option.
- The **✓ Use** / **⊘ Avoid** buttons in the home footer open *Your ingredients*: every selected item, with
  move-to-Use/Avoid, remove, and clear actions.

## Status

- [x] Phase 0 — Expo SDK 57 + TypeScript (strict), Expo Router, theme tokens, Jest
- [x] Phase 1 — 89-ingredient catalog with aliases, 27 seed recipes, validator, coverage report
- [x] Phase 2 — deterministic engine + 36 tests (all of plan §11 that can run without a device)
- [x] My pantry mode — saved pantry, can-make list, shuffle, meal/dish narrowing, one-short section (+6 tests)
- [x] "Most common" suggestions ranked from published recipe-frequency data (docs/ingredient-popularity.md). Screens show search + the top 12; **More options** opens a full scrollable ingredients screen (pinned search, every ingredient by popularity then category) that works for picking, pantry and staples
- [x] Dropdown filters, Use/Avoid selections screen, kitchen staples (+6 tests); fixed a startup race where an early tap could be overwritten by the saved-state restore
- [x] Phase 3/4 — Find, Results (exact / close / narrowing / adjust), Recipe (step check-off), Favorites; last search + favorites persist locally
- [ ] Phase 5 — grow to 30–50 → 120–150 → 250–350 **human-verified** recipes
- [ ] Phase 6 — polish & accessibility pass on a real iPhone (VoiceOver, large text)
- [ ] Phase 7 — TestFlight, App Store listing, paid-app setup

**Every seed recipe is an original draft marked "needs culinary review."** Someone must cook/check
quantities, times and food-safety notes before release.

Bundle ID `com.cookwiththat.app` is a placeholder — change it in `app.json` before creating the App Store record.

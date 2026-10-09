# WHAT SHOULD I COOK?
## Complete Product Specification & Build Roadmap

**Status:** Build-ready product specification (v1.0)  
**Platform:** iPhone / Apple App Store first  
**Business model:** One-time paid download; no subscriptions, advertisements, in-app purchases, or paywalls  
**Architecture:** Offline-first, local recipe collection, no accounts, no server, no API, no recurring per-user infrastructure cost  
**Working App Store name:** **What Should I Cook?**  
**One-sentence pitch:** *Pick the ingredients you want to use, rule out what you don't want, and find something good to cook.*

---

# 1. The idea

The user is looking at food they already have and wondering what to make. They open **What Should I Cook?**, choose ingredients they want a recipe to include, optionally select ingredients to avoid, and see matching recipes from a curated, bundled database.

If too few results match, the app suggests **close matches** and clearly states which requested ingredients those recipes do **not** use. If there are too many results, it suggests useful ways to narrow the list. The user taps a recipe to see ingredients and straightforward steps. No internet connection is required, including on the first launch after installation.

**Primary action:** `Pick ingredients -> See recipes -> Cook`.

**Product principles**
1. Understandable in five seconds.
2. Search requires no account, no sign-up, and no questionnaire.
3. No meal planning, pantry tracking, shopping ecosystem, social network, nutrition tracking, or AI functionality.
4. Never silently ignore an ingredient the user explicitly requested or excluded.
5. A recipe must be fully readable within the app, even with airplane mode enabled.
6. Prefer fewer well-tested recipes to a huge database of repetitive, unreliable recipes.
7. Design for one-handed use and minimal taps.

**Out of scope for v1:** Barcode scanning, photo recognition, online recipe search, crowdsourced recipes, ingredient price comparisons, stores, meal calendars, nutrition macros, automatic ingredient substitutions, generated recipes, cooking videos, and a backend dashboard.

---

# 2. Who it's for and why they pay

**Target user:** Someone at home with a few ingredients, little inspiration, and no desire to sort through search results, blogs, ads, or long personal stories before finding dinner.

**What they are buying:** A focused, offline recipe finder with an intentionally simple interaction and clean, complete recipes.

**Not the promise:** "You can cook with only these ingredients." Selecting ingredients to **use** does not prove the user has all the *other* ingredients a recipe requires.

**Proposed launch price:** **$4.99 USD**, one-time paid download. Validate willingness to pay before release. All recipes and features are included. Configure the price in App Store Connect, rather than implementing payment screens.

**Differentiation to test:** A simple, high-quality, ad-free, offline experience built specifically around **use these / avoid these**, rather than a pantry inventory or recipe-search platform. The concept has competition; usability and recipe quality must be materially better in the target workflow.

---

# 3. Exact feature scope

## Must-have for v1
- Searchable ingredient directory with familiar everyday names.
- **Use these** ingredient selection (each selected ingredient is required to appear in a recipe).
- **Avoid these** ingredient selection (recipes containing any of these are excluded).
- Clearly visible selected ingredient chips, each removable with one tap.
- Optional **Meal** filter: Breakfast, Lunch, Dinner, Dessert, Appetizer, Snack, Side.
- Optional **Dish type** filter: Pasta, Soup, Salad, Sandwich/Wrap, Skillet, Casserole/Bake, One-Pot, Bowl, Baked Goods. This is a separate facet from Meal.
- Results with recipe title, prep/cook time, brief description, and other ingredients required.
- **Close matches** when zero exact matches exist.
- **Narrow your search** suggestions when a broad search returns many results.
- Recipe detail with servings, exact ingredient quantities, ordered instructions, preparation/cooking time, and optional ingredients clearly marked.
- Favorites saved locally and available offline.
- Recent selection retained locally, plus a prominent **Clear all** action.
- Accessible, responsive, polished UI with light and dark appearance support if feasible without adding significant complexity.

## Small optional polish (only after the above works)
- Recipe serving-size multiplier (requires reliable quantity parsing; otherwise defer).
- A simple **Cook Mode** that checks off steps without losing scroll position.
- Haptics on selection and favorites.
- Share a recipe title/summary as plain text (not a deep link that requires the recipient to own the app).
- Basic local filters for time such as **30 minutes or less**. Include only after result logic is tested.

## Explicitly not v1
- User-generated recipes.
- Custom meal plans or weekly schedules.
- A full kitchen inventory.
- Automatic substitutions.
- Dietary or allergen safety certification.
- Ratings/reviews and recommendation personalization.
- A subscription or any internet-dependent feature.

---

# 4. Taxonomy and how filters work

Do **not** put all labels into one confusing category list. Use **two distinct recipe facets**:

| Facet | Purpose | v1 values |
|---|---|---|
| **Meal** | When or how it is served | Breakfast, Lunch, Dinner, Dessert, Appetizer, Snack, Side |
| **Dish type** | What kind of food it is | Pasta, Soup, Salad, Sandwich/Wrap, Skillet, Casserole/Bake, One-Pot, Bowl, Baked Goods |

A recipe can have **multiple Meal tags** and **multiple Dish type tags**. A pasta salad could be Lunch + Side and Pasta + Salad. Do not artificially limit it to one label.

**Initial defaults:** All Meals; All Dish Types. Both filters are **optional**; a user can search by ingredients alone.

**Simple v1 selection rule:** Only one selected Meal and one selected Dish type at a time (or **All**). This avoids confusing multi-select filter behavior. Under the hood, each recipe can still have many tags.

**Filter precedence:**
1. Apply **Avoid these** as hard exclusions.
2. Apply selected Meal and Dish type as hard restrictions.
3. Find recipes containing **all** selected **Use these** ingredients.
4. If none remain, calculate explicitly labeled close matches within the same hard restrictions.

### Ingredient selection semantics
- **Use these** means `AND`: selecting chicken + garlic + spinach requires all three to appear as substantive ingredients in the recipe.
- **Avoid these** means `NOT`: if garlic is avoided, do not show recipes listing garlic. This is always enforced, including in close matches.
- Nothing selected in **Use these** means "browse matching recipes," not an error.
- An ingredient cannot be in both lists. Moving it from one side to the other automatically removes it from the previous side.
- **Optional toppings/garnishes do not count toward satisfying 'Use these'.** They *do* count for exclusions to avoid surprising someone who said not to use that item.
- **Never automatically treat salt, oil, water, or pepper as already owned.** Recipe detail and "You'll also need" must still list required quantities/ingredients, although a separate visual label such as "Basics" is fine.
- A selected ingredient can be broad (e.g., "Chicken") but each actual recipe must specify the cut or form required (e.g., chicken thigh). A broad search match is not a promise that different cuts are interchangeable.
- Search aliases should cover simple variations ("scallion" / "green onion"), not unsafe or misleading substitutions ("milk" / "almond milk," "garlic" / "garlic powder").

### Example
User chooses:
- Meal: Dinner
- Dish type: Pasta
- Use these: Chicken, Garlic, Spinach
- Avoid these: Cream

Show only dinner pasta recipes containing all three requested ingredients and **no cream**. If the user does not have Parmesan, the recipe can still appear, but the results card must show Parmesan as an **additional ingredient needed**.

---

# 5. Screen-by-screen UX

## Screen A: Find Recipes (home)

**Header:** `What Should I Cook?`  
**Helper text:** `Pick what you'd like to use.`

1. **Meal** horizontal chips, default `Any meal`; choices Breakfast, Lunch, Dinner, Dessert, Appetizer, Snack, Side.
2. **Dish type** smaller dropdown or horizontal chips, default `Any type`; shows Pasta, Soup, etc. Keep this visually secondary so the screen does not become a wall of filters.
3. A simple two-option selector: **Use these** | **Avoid these**.
4. Search input: `Search ingredients...`.
5. Tappable suggestions grouped by Produce, Proteins, Dairy/Eggs, Grains/Pasta, Canned/Pantry, Spices/Condiments.
6. Two small sections visible at all times: `Use: Chicken · Garlic · Spinach` and `Avoid: Cream`.
7. Sticky primary button: **Find recipes** (show the exact result count if cheaply available, e.g., `See 12 recipes`).
8. Small actions: **Clear all**, **Favorites**.

**Interaction details**
- Typing `chick` shows Chicken, Chicken breast (only if the ingredient catalog explicitly supports that distinction), Chicken stock, etc.
- One tap adds the ingredient to whichever mode is active.
- After selection, the ingredient stays visible as a removable chip; taps should not require opening an extra screen.
- Avoid mode uses a clear text label/icon, not color alone. Make the difference unmistakable to color-blind users.
- Disable adding duplicate ingredient entries.
- The search remains entirely usable with keyboard and screen readers.
- When both ingredient lists are empty, show **Browse recipes** rather than an intimidating list of all results on first launch.

**Sketch**

```text
What Should I Cook?            [Favorites]
Pick what you'd like to use.

Meal       [Any] [Dinner] [Lunch] [Breakfast] ...
Dish type  [Any type v]

         [ Use these ] [ Avoid these ]
[ Search ingredients...                   ]

Popular: [Chicken] [Garlic] [Spinach] [Eggs] ...

USE       [Chicken x] [Garlic x] [Spinach x]
AVOID     [Cream x]

                         [ See 8 recipes ]
                         Clear all
```

## Screen B: Results

Header: `12 recipes` or `No exact matches`.

Top row shows active selections, with **Edit** returning to the home selector and preserving selections.

**Recipe card**
- Title and 1-line description.
- `25 min · Dinner · Skillet`.
- `Uses: Chicken, Garlic, Spinach` (the matches requested by this user).
- `You'll also need: Oil, Parmesan, Salt, Pepper` (actual required ingredients not selected in Use).
- Favorite icon.
- A bundled photo **only if** it is licensed and attractive; otherwise use attractive typographic cards and simple local illustrations instead of generic bad stock photos.

**Sorting (v1):** Exact-match recipes first, then a deterministic tie-break using fewer additional required ingredients, shorter total time, and title. Do not claim the ranking is personalized or intelligent. Keep it predictable.

If the result count is **more than 30**, place a compact prompt **above** the list:

> Lots to choose from. Narrow it down?
> [Dinner (18)] [Pasta (9)] [30 min or less (14)]

Only show suggestions that are **not already selected** and that would actually reduce results. Compute counts from the current result set. Show up to three suggestions; prioritise current Meal/Dish filters, and only include time if implemented.

Do not block scrolling. The user can ignore suggestions.

## Screen C: No Exact Results / Close Matches

State clearly: `No recipes match every ingredient you chose.`

**Close matches** may omit **one** selected **Use** ingredient, or **two at most** if the request had at least three. Each result must show the omission clearly:

- `Garlic Chicken Skillet` — **Uses 2 of 3**; **Doesn't use: Spinach**.
- `Spinach Pasta` — **Uses 2 of 3**; **Doesn't use: Chicken**.

Never show a recipe with anything from **Avoid these**. Never silently turn a close match into an exact result.

Close matches are **not substitutions** and should not be labeled as such.

Above the close-match section, offer removable ingredient chips in a small row: `Try without: [Spinach] [Chicken]` (only if each action unlocks results). Tapping a suggestion updates the filters intentionally and reruns the search.

If there are no close matches within Meal/Dish/Avoid restrictions:
- Say `Nothing close with these filters.`
- Show explicit actions: **Change meal**, **Change dish type**, **Remove an ingredient**, **Clear avoided ingredients**. Do **not** modify exclusions without a tap.

When there are no **Use** ingredients selected, do **not** run an invented missing-ingredient similarity algorithm; show the no-results filter state and adjustment actions instead.

## Screen D: Recipe Detail

Top: recipe title, short description, servings, preparation time, cook time, total time, Meal/Dish tags, Favorite button.

Sections:
1. **Ingredients**: actual ingredient form, quantity, unit, preparation note, optional flag if appropriate.
2. **You'll also need**: ingredients required but not part of the user's selected Use list. Do not hide pantry basics.
3. **Steps**: short, numbered, specific, complete instructions in cooking order.
4. **Optional**: a check-off UI for steps, if trivial to add without corrupting state.

A back action must return to the same result list and scroll position. Do not require an active internet connection to open full recipe instructions.

## Screen E: Favorites

A small locally saved list of recipes. Opening a favorite shows the normal recipe page. If zero favorites: `Tap the heart on any recipe to save it here.` No profile or account.

---

# 6. The recipe database: the real product

**This is the biggest quality job.** Coding the filter is straightforward; creating a broad, accurate library is not.

### Content target
- **Prototype:** 30–50 verified recipes for testing flows and matching.
- **Private beta:** 120–150 verified recipes focused on common ingredient combinations.
- **Release target:** Approximately **250–350 curated recipes**, subject to real usage testing. Quality and coverage matter more than the headline count.
- Start with heavily reused, common grocery items (chicken, eggs, rice, pasta, potato, garlic, onion, spinach, tomato, beans, cheese, etc.).
- Aim for believable cross-coverage: someone selecting 2–3 common ingredients should usually see useful exact **or clearly labeled close** results.
- Include appropriate distribution across Breakfast, Lunch, Dinner, Dessert, Appetizer, Snack, and Side, without forcing equal numbers in categories with differing demand.
- Prevent near-duplicate filler (e.g., 14 identical chicken-and-garlic recipes whose only change is garnish).

### Recipe requirements
Every recipe must have:
- Unique stable ID and human-readable title.
- Short, practical description.
- Meal tag(s), dish type tag(s).
- Prep minutes, cook minutes, servings.
- All required ingredients with quantities/units and an exact preparation form where relevant.
- Optional ingredients stored separately/flagged, with genuinely optional steps.
- Specific, complete ordered steps, including heat, timing and doneness instructions where necessary.
- Explicit, reviewable rights/source metadata.
- Optional local image ID, only when a licensed/original image exists.

**Do not copy recipe directions, photos, or collections from food blogs or websites without appropriate permission.** Use original editorial recipes or verified, appropriately licensed material. Ingredient lists alone and recipe ideas do not grant unrestricted rights over a site's directions, photography, or database. If using AI to draft recipes, human-review every ingredient, quantity, procedure, food-safety note, and claimed cook time; AI-generated text is not automatically accurate or uniquely owned.

**No images required for the first functioning release candidate.** If pictures significantly improve conversion, add a small curated set of properly licensed/original, compressed images. They become part of the binary and must not depend on a CDN.

### Ingredient dictionary
Each ingredient has:
- Stable canonical ID: `chicken`, `garlic`, `spinach`, `heavy_cream`, `garlic_powder`.
- Display name.
- Category for the selection UI.
- Aliases for ordinary synonyms (e.g., `scallion`/`green onion`).
- Optional ingredient-family tag for future browsing; **do not** silently equate different foods or forms.

For v1, err on the side of **unambiguous exact canonical IDs** rather than a complex ingredient hierarchy. If recipes label chicken breasts and thighs separately but search exposes only Chicken, index that recipe under the broad ingredient `chicken` while still displaying the actual required cut on the detail page. Treat garlic cloves and garlic powder separately. Document every mapping and test for accidental false positives.

### Sample content format
Use TypeScript types plus a JSON file (or an equivalent structured local collection). This is illustrative data, **not** a verified cooking recipe:

```ts
type Ingredient = {
  id: string;
  name: string;
  category: 'produce' | 'protein' | 'dairy' | 'grain' | 'pantry' | 'spice';
  aliases: string[];
};

type RecipeIngredient = {
  ingredientId: string;     // canonical ID for matching
  displayName: string;     // e.g. "boneless chicken thigh"
  quantityText: string;    // e.g. "1 lb"; exact authored quantity
  preparation?: string;   // e.g. "diced"
  optional: boolean;
};

type Recipe = {
  id: string;
  title: string;
  description: string;
  meals: Array<'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'appetizer' | 'snack' | 'side'>;
  dishTypes: string[];
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  imageAsset?: string;
  source: { type: 'original' | 'licensed'; note: string; license?: string };
};
```

**Example:**

```json
{
  "id": "example-chicken-spinach-skillet",
  "title": "Garlic Chicken & Spinach Skillet",
  "description": "A simple weeknight chicken skillet.",
  "meals": ["dinner", "lunch"],
  "dishTypes": ["skillet"],
  "prepMinutes": 10,
  "cookMinutes": 20,
  "servings": 2,
  "ingredients": [
    {"ingredientId": "chicken", "displayName": "chicken breast", "quantityText": "12 oz", "preparation": "cut into bite-size pieces", "optional": false},
    {"ingredientId": "garlic", "displayName": "garlic cloves", "quantityText": "3", "preparation": "minced", "optional": false},
    {"ingredientId": "spinach", "displayName": "baby spinach", "quantityText": "3 cups", "optional": false},
    {"ingredientId": "olive_oil", "displayName": "olive oil", "quantityText": "1 tbsp", "optional": false},
    {"ingredientId": "salt", "displayName": "salt", "quantityText": "to taste", "optional": false}
  ],
  "steps": [
    "Prepare all ingredients before heating the pan.",
    "Cook the chicken in the heated oil until fully cooked; verify safe doneness with a food thermometer.",
    "Add the garlic and cook briefly without burning it.",
    "Add the spinach and cook until wilted; season and serve."
  ],
  "source": {"type": "original", "note": "Illustrative draft for testing, not final culinary QA"}
}
```

**Important:** Recipe data should not ship with loose placeholder directions, guessed safe temperatures, broken measurement units, empty steps, or missing cooking details. The example above is merely a schema demonstration and must be replaced or reviewed before release.

### Content creation workflow
1. Define canonical ingredient names and tags.
2. Create a recipe authoring spreadsheet or JSON/CSV source file **for development only**.
3. Author recipes in small batches, concentrating on the most commonly selected ingredients.
4. Validate structure automatically (required fields, duplicate IDs, unknown ingredients, plausible positive times/servings, at least one required ingredient, nonempty steps).
5. Review every recipe for feasibility, ingredient/step consistency, and food safety.
6. Export the validated file or local database to the app bundle.
7. Generate a coverage report for common ingredient pairs and triples; fill gaps deliberately.
8. Freeze the release library. Later changes ship as app updates, not server pushes.

---

# 7. Deterministic matching algorithm

**Important:** Matching is deterministic local filtering, not AI and not a web search.

For each recipe, compute:
- `requiredIds`: canonical ingredient IDs appearing in substantive/required recipe ingredients.
- `allIds`: required **plus** optional listed ingredients.
- `selectedUse`: all chosen **Use** IDs.
- `selectedAvoid`: all chosen **Avoid** IDs.

**Exact match:**

```ts
function matchesHardFilters(recipe: Recipe, state: SearchState): boolean {
  const allIds = new Set(recipe.ingredients.map(i => i.ingredientId));
  const avoidsAny = state.avoidIds.some(id => allIds.has(id));
  if (avoidsAny) return false;
  if (state.meal && !recipe.meals.includes(state.meal)) return false;
  if (state.dishType && !recipe.dishTypes.includes(state.dishType)) return false;
  return true;
}

function matchingRequestedIngredients(recipe: Recipe, useIds: string[]): string[] {
  const requiredIds = new Set(recipe.ingredients.filter(i => !i.optional).map(i => i.ingredientId));
  return useIds.filter(id => requiredIds.has(id));
}

function isExactMatch(recipe: Recipe, state: SearchState): boolean {
  return matchesHardFilters(recipe, state)
    && matchingRequestedIngredients(recipe, state.useIds).length === state.useIds.length;
}
```

`SearchState` holds `meal: string | null`, `dishType: string | null`, `useIds: string[]`, and `avoidIds: string[]`.

**Sorting exact results** (use stable, simple ranking):
1. Fewer additional **required** ingredients not in the Use list.
2. Lower total time (`prepMinutes + cookMinutes`).
3. Alphabetical title, then stable ID.

Do not imply that ingredient quantity has been checked against the user's pantry; it has not.

### Close matches
Only trigger when there are **zero exact results** and `useIds.length > 0`.

1. Filter all recipes through `matchesHardFilters`. Exclusions, Meal, and Dish type remain non-negotiable.
2. Calculate `missing = useIds - matchingRequestedIngredients(recipe, useIds)`.
3. For **one** selected Use ingredient, there is no meaningful ingredient overlap if it's missing; do **not** present random recipes as close matches. Suggest changing/clearing that ingredient instead.
4. For **two** selected Use ingredients, a close match must contain at least **one**.
5. For **three or more**, initially require all but **one**. If zero close matches, allow recipes missing **two**, but require at least one requested ingredient present. Label the omission(s).
6. Sort by **fewest missing selected ingredients**, then fewer additional required ingredients, then total time, then title.
7. Show at most the top 12 close matches, clearly titled **Close matches**, never labeled simply "matches".
8. If no recipe qualifies, show helpful manual filter-adjustment actions, not arbitrary recipes.

**Hard exclusion invariant:** Never show an excluded ingredient in either exact results or close matches. Apply this to *all* listed recipe ingredients, including optional ones. Do not automatically relax exclusion filters.

### Too many results
If `exactMatches.length > 30`:
1. Display all results normally, with a nonblocking prompt at the top.
2. Calculate counts for unselected Meal/Dish type options based on the current exact result set.
3. Suggest up to 3 options that **reduce** the result set, preferably to roughly 3–20 results.
4. Never suggest an ingredient to add unless it appears as a **required** ingredient in the narrowed recipes and is not already selected/avoided; reserve this for later polish if simpler Meal/Dish suggestions suffice.
5. Tapping a suggestion updates the actual filter visibly. Do not infer the user's choice silently.

### Edge cases to implement intentionally
- Empty Use + Empty Avoid + Any Meal/Type: offer Browse recipes.
- Empty Use + several Avoid items: show all allowed recipes under selected category filters; no invented use-ingredient matching.
- Use and Avoid conflict: moving an ingredient automatically resolves the conflict.
- Results disappear when a Meal/Type is selected: preserve ingredient choices, show why, offer undo/change filters.
- No results due entirely to Avoid: suggest reviewing the Avoid list; never override it automatically.
- Unknown ingredient search: `No ingredient found` and a clear reset; do not search the internet.
- Ingredient aliases: searching an alias picks the same canonical ingredient ID.
- Duplicate ingredients and spelling variants do not inflate match counts.
- Recipe with selected ingredient only as an optional garnish: does **not** count as an exact Use match.
- Recipes missing any required data are blocked at content-validation time, not displayed as broken cards.

---

# 8. Technical architecture (intentionally boring)

**Recommended:** Expo / React Native + TypeScript, iOS-first. This matches a simple, familiar mobile workflow and can later support Android without a rewrite. If a fully native iOS-only workflow is preferred, SwiftUI is also viable; **pick one, do not build two frameworks for v1**.

**No backend:** Do not add Firebase, Supabase, auth, API calls, push notification infrastructure, server-side analytics, or remote image URLs.

**Content storage, simplest approach:**
- Put the immutable recipe and ingredient data in bundled `JSON`/TypeScript files for the first implementation.
- In a 250–350 recipe app, an in-memory indexed search is likely sufficient; verify responsiveness on a real, older iPhone.
- Use local persistent key-value storage (such as AsyncStorage or equivalent) **only** for favorites, last selection, and optional UI preferences.
- If dataset size/performance demands it later, move the bundled catalog to local SQLite. `expo-sqlite` supports bundled databases; this is an optimization option, **not** a requirement for the initial build.
- Do not persist recipe data unnecessarily twice. Saved favorites reference stable recipe IDs.
- Keep all code paths offline. Audit dependencies for accidental network requests.

**Suggested project organization:**

```text
what-should-i-cook/
  app/
    index.tsx                 # ingredient/filter home
    results.tsx               # exact/close results
    recipe/[id].tsx           # recipe detail
    favorites.tsx             # saved recipes
  src/
    components/
      IngredientPicker.tsx
      IngredientChip.tsx
      FilterChips.tsx
      RecipeCard.tsx
      EmptyState.tsx
      CloseMatchCard.tsx
    data/
      ingredients.json
      recipes.json
      types.ts
    logic/
      normalizeIngredient.ts
      matchRecipes.ts
      suggestFilters.ts
      sortRecipes.ts
    state/
      searchState.ts
      favoritesStorage.ts
    theme/
      colors.ts
      spacing.ts
      typography.ts
  scripts/
    validate-recipes.ts
    coverage-report.ts
  tests/
    matchRecipes.test.ts
    suggestions.test.ts
    contentValidation.test.ts
  assets/
    app-icon.png
    launch.png
  README.md
  app.json
  package.json
```

Use Expo Router **only if** it fits the selected Expo SDK and makes navigation easier. Keep the stack small and pin compatible dependency versions. Do not introduce complex global state management for a four-screen app.

---

# 9. Visual direction

**Overall:** Friendly, bright, food-oriented, uncluttered. More "beautiful little kitchen tool" than food-delivery app or recipe blog.

Suggested palette (starting point, not a design mandate):
- Background: warm cream `#FFF9F0`.
- Primary text: dark charcoal `#242424`.
- Primary action: tomato-red `#D9543F`.
- Supporting accent: herb-green `#5D8065`.
- Cards: white `#FFFFFF`.
- Secondary text: muted slate `#667085`.

Use generous touch targets, high text contrast, consistent rounded chips, clear hierarchy, and restrained motion. Use labels and icons in addition to color for **Use** vs **Avoid**. Avoid filling the UI with decorative cooking imagery.

**Minimum design bar:** The first screenshot should demonstrate the complete premise: selected ingredient chips -> appetizing recipe results. App Store screenshots should use real screens from the shipping app, not mock functionality that does not exist.

**Interaction design rules**
- A selection is added in one tap.
- The primary action is always visible or easy to find.
- The interface never jumps to another screen after each individual ingredient selection.
- The user can edit filters from results in one tap.
- The app remembers where the user was when returning from a recipe.
- All controls function with larger accessibility text; test VoiceOver labels and contrast.

---

# 10. Build order for Claude Code / developer

**Execution rule:** Complete each phase, run checks, and test on a device before adding scope. Avoid implementing later phases early. Never invent API dependencies to solve a local-data problem.

## Phase 0 — Initialize and lock scope
- [ ] Create an Expo React Native TypeScript project targeting iPhone.
- [ ] Choose an iOS bundle ID and store the working name.
- [ ] Add simple navigation for Find, Results, Recipe, and Favorites.
- [ ] Set up formatting, strict TypeScript, and a test runner.
- [ ] Create the above folders; no backend, payments SDK, auth SDK, or tracking SDK.
- [ ] Establish the style tokens (spacing, colors, typography).

**Done when:** The app boots in an iOS simulator and the basic four routes exist.

## Phase 1 — Build and validate the ingredient/recipe data shape
- [ ] Implement the canonical ingredient catalog and aliases.
- [ ] Define recipe types and immutable seed data (start with 15–20 realistic test entries covering inclusion, exclusion, close match, categories, and optional ingredients).
- [ ] Write a content validation script; fail on unknown IDs, duplicate IDs, invalid tags, bad quantities, empty steps, and missing fields.
- [ ] Write a coverage script to count zero, exact, and close hits for common ingredient selections.

**Done when:** Seed data passes validation and can be searched without internet access.

## Phase 2 — Implement and test the matching engine BEFORE UI polish
- [ ] `matchesHardFilters()` for Avoid, Meal, Dish type.
- [ ] Exact `AND` matching for all selected Use IDs.
- [ ] Additional-required-ingredients calculation.
- [ ] Stable exact-result sorting.
- [ ] Close-match scoring and visible missing-ingredient labels.
- [ ] Broad-result suggestion calculation and accurate result counts.
- [ ] Automated tests for all edge cases in Section 7.

**Done when:** Given the same recipe data and selected filters, the engine returns correct, deterministic output every time.

## Phase 3 — Build the actual ingredient-selection UX
- [ ] Home layout, Meal chips, Dish type control.
- [ ] Use/Avoid mode selector.
- [ ] Search across names and aliases.
- [ ] Selected chips visible and removable.
- [ ] Conflict handling, Clear all, basic persistent last search.
- [ ] Browse/Find primary action.

**Done when:** A new user can select Chicken, Garlic, Spinach and avoid Cream in a few seconds with no tutorial.

## Phase 4 — Results, no-results, and recipe page
- [ ] Correct result-count heading and recipe cards.
- [ ] "You'll also need" additional-required-ingredient preview.
- [ ] Broad-search narrowing suggestions.
- [ ] Empty exact-result state + labeled close matches.
- [ ] Recipe page, ingredient quantities, steps and time/serving metadata.
- [ ] Preserve search and scroll state when going back.
- [ ] Favorites persisted locally.

**Done when:** All flows work with seed data in airplane mode, including an intentional no-results query.

## Phase 5 — Build the content library
- [ ] Expand to 30–50 human-verified recipes; conduct early usability tests.
- [ ] Expand to 120–150 for private beta.
- [ ] Create the release target of approximately 250–350 curated, validated recipes, adjusting based on coverage/quality.
- [ ] Run content validation after every batch.
- [ ] Check that ingredients/quantities and directions agree.
- [ ] Verify recipe rights and food safety.
- [ ] Measure pair/triple-ingredient coverage and fill common holes.
- [ ] Add only local, properly licensed/original images if they materially improve presentation.

**Done when:** Typical ingredient combinations produce genuinely useful choices; no filler recipes or broken instructions remain.

## Phase 6 — Polish and accessibility
- [ ] Responsive layouts for compact and large iPhones.
- [ ] Empty, loading (if any), error, and near-result states are clean.
- [ ] Search bar keyboard behavior and focus management.
- [ ] VoiceOver labels, dynamic type, large touch areas.
- [ ] Improve recipe readability for greasy hands / cooking use.
- [ ] Recheck back-navigation and restoration.
- [ ] Remove debug and sample content from production.

**Done when:** The app feels like a paid, finished utility rather than an unfinished demo.

## Phase 7 — Test, validate, and prepare release
- [ ] Test fresh install, upgrades, force-close/restart, offline first run, and airplane mode.
- [ ] Test 0 results, 1 result, exactly 30 results, 31+ results, and broad browsing.
- [ ] Test selected Use ingredient as optional garnish, duplicates, aliases, and conflicts.
- [ ] Test close matches never violate Avoid.
- [ ] Test realistic content, no broken references/images, and extreme text sizes.
- [ ] Test on at least one physical iPhone, not just the simulator.
- [ ] Run the automated test suite and recipe validator.
- [ ] Create original icon, App Store screenshots, and accurate description.
- [ ] Prepare support contact, privacy policy/disclosure appropriate to the actual app, and accurate App Privacy responses.
- [ ] Set the app as **paid** in App Store Connect and accept any required paid-app agreements.
- [ ] Distribute a TestFlight build to outside testers; resolve failures and confusion.
- [ ] Archive and submit for App Review.

**Done when:** A user can purchase, install, search, and cook entirely offline and every App Store promise is demonstrated in the app.

---

# 11. Minimum automated tests (must pass)

Create fixture recipes and test these cases explicitly:

1. `Use [chicken, garlic, spinach]` returns only recipes with all three as required ingredients.
2. Adding `Avoid [cream]` removes every recipe listing cream, even when cream is optional.
3. Meal `dinner` and type `pasta` return the intersection of both tags.
4. Meal `dinner` never excludes a recipe tagged both `lunch` and `dinner`.
5. `Use [chicken, garlic, spinach]` with zero exact matches returns a clearly labeled recipe missing only spinach if available.
6. With `Use [chicken]` and zero exact matches, no arbitrary 0-of-1 recipe is advertised as a close match.
7. With `Use []` and zero results due to hard filters, show adjustment actions instead of random close matches.
8. Close matches never include ingredients from Avoid.
9. Changing a selected ingredient from Use to Avoid removes it from Use atomically.
10. Selecting "green onion" and "scallion" cannot add duplicate canonical entries.
11. A recipe containing garlic solely as optional garnish does not fulfill `Use [garlic]`.
12. Counts displayed beside suggested filters equal counts after tapping those filters.
13. The >30 result prompt does not appear at exactly 30 results; it appears above 30.
14. One recipe with many extra ingredients ranks behind an otherwise equivalent recipe with fewer extra ingredients.
15. All recipe IDs are unique and every ingredient ID exists in the catalog.
16. Favorites survive force close and reopening; a saved ID resolves to a valid recipe.
17. Full detail and every ingredient-selection/search path work after disabling network access.
18. User's current selections and results survive navigating to a recipe and back.

---

# 12. Real-device usability tests

Ask 5–10 people who were not involved in development to perform these tasks **without coaching**:

1. "You have chicken, garlic, and spinach. Find a dinner using all three."
2. "Now imagine you cannot use cream. Remove recipes containing it."
3. "Search for pasta dishes, then find something without using tomatoes."
4. "Choose a set of ingredients that returns no exact recipe. Explain what 'close matches' means."
5. "Save one recipe and find it again after reopening the app."

Record: where they hesitate, whether they correctly understand **Use vs Avoid**, whether they think additional ingredients are already available, and whether proposed recipes are worth cooking. Redesign confusing steps **before** expanding scope.

**Market test:** Show the app's screenshot and a 15-second demonstration, with the proposed $4.99 price, to prospective buyers. Do not treat compliments as purchases. The competition is free recipe websites and other ingredient-search apps, so the paid product must feel distinctly easier or better.

---

# 13. Launch package

**Proposed display name:** What Should I Cook?  
**Suggested subtitle:** Recipes From Your Ingredients  
**Value proposition:** Pick ingredients you want to use. Exclude what you don't. Find straightforward recipes, all available offline.

**Screenshot story (five frames)**
1. `What's in your kitchen?` — show chicken, garlic, spinach selected.
2. `Skip what you don't want.` — show Cream excluded.
3. `Find recipes that actually fit.` — show meaningful results and other required ingredients.
4. `Nothing exact? Try close matches.` — show an explicitly labeled omission.
5. `Cook without distractions.` — show a complete recipe and numbered steps.

**App Store setup checklist**
- [ ] Confirm the display name and branding are not confusingly close to an existing app or trademark.
- [ ] Create app record, bundle ID, icon, screenshots, description, keywords, category, support contact, and privacy-policy URL as needed.
- [ ] Enroll in the Apple Developer Program; arrange the required tax/banking and Paid Apps Agreement details.
- [ ] Set an upfront purchase price; implement no in-app purchase SDK.
- [ ] Confirm metadata and privacy disclosures match the shipping binary.
- [ ] Submit build and respond to any App Review feedback.

The only intended running expenses are normal store/developer account fees and any **optional** externally purchased tools or assets. Developer time, device/hardware requirements, app-maintenance time, payment commissions, and optional design/content costs are real costs even without a backend.

---

# 14. Success criteria and scope guardrails

**Ship when all are true:**
- The main flow works in 3 steps or fewer after choosing ingredients: **select -> results -> recipe**.
- Offline operation is complete.
- Exact matches obey every explicitly selected filter.
- Close matches are clear and never break the Avoid rule.
- Too-many-results suggestions are correct and nonblocking.
- Every released recipe has been validated for ingredients, directions, completeness, and legal use.
- It is visually coherent, responsive, and has working favorites.
- There are no accounts, subscriptions, APIs, or server dependencies.
- App Store listing promises only implemented features.

**Do NOT expand scope because another recipe app has more features.** The appeal is speed and simplicity.

**Potential future ideas only after launch:** time filter, vegetarian/dietary preferences with clear limitations, improved search synonyms, optional serving adjustments, and more vetted local recipes released through ordinary app updates.

---

# 15. Exact kickoff prompt for Claude Code

Copy this into a fresh Claude Code session after putting this file in the repository:

> Read `What_Should_I_Cook_Build_Plan.md` completely and treat it as the source of truth. Build **What Should I Cook?**, an iPhone-first, paid-upfront, offline recipe finder. It must never call external APIs, require an account, use a backend, or implement subscriptions. Work in the phase order in this plan. First set up the TypeScript Expo app and create the complete ingredient/recipe data model, seed fixtures, validator, matching engine, and comprehensive tests. Then build the four screens and only afterward expand content and polish. Keep all matching deterministic, with strict AND rules for "Use," strict exclusions for "Avoid," clearly labeled close matches, and useful narrowing suggestions above 30 results. Do not silently relax the user's restrictions. Do not claim a recipe can be prepared using only the selected ingredients; always show additional required ingredients. Use local files for everything. For each phase, run applicable checks and give a concise summary of completed work, test results, and what remains. Do not add features outside the specification without a concrete reason.

---

# 16. Reference documentation

These references are for **development and release**, not network calls used by the app:

- Expo local SQLite and bundled databases: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo asset bundling: https://docs.expo.dev/develop/user-interface/assets/
- Expo local data storage options: https://docs.expo.dev/develop/user-interface/store-data/
- Apple App Store Connect pricing: https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Developer Program: https://developer.apple.com/programs/enroll/

**Final guiding sentence:** *Select what you want to use. Exclude what you don't. Get a real recipe, even offline.*

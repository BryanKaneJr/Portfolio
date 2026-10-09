# Importing recipes from open collections

How recipes from an outside collection get into the app. Which collections are allowed, and why, is in
[recipe-sources.md](recipe-sources.md). Only add a collection there after its license has been checked.

## The loop

```bash
npm run import:stage -- based-cooking            # fetch the pinned snapshot, parse, map, write the report
npm run import:draft -- based-cooking --next 10  # append the next 10 ready recipes as drafts
npm run import:draft -- based-cooking chili tacos  # or name the source keys you want
npm run import:catalog -- "ground ginger"        # add a reviewed ingredient by hand while editing
# edit the drafts in src/data/imported/basedCooking.ts
npm run check                                    # typecheck + validate + tests: must pass before committing
```

One batch is one commit. Keep batches small (5–15) so each can be reviewed.

1. **Stage** fetches exactly the commit pinned in `scripts/import/sources/index.ts` into `.import-cache/`
   (git-ignored), reads every entry, parses each ingredient line and maps it to a catalog ID. It writes
   `docs/import-reports/<source>.md`. That report has counts, a greedy "review these names next" list, the
   catalog additions waiting on a draft, and every name that blocks a recipe.
2. **Draft** appends recipes in the `src/data/recipes.ts` format, with `source` metadata filled in
   (license, collection, original key, title and author). Wherever an editor must decide, it leaves
   `TODO` markers: missing quantities, times, descriptions and meal tags. It also leaves
   `// TODO check:` comments for steps that use an unlisted ingredient and for near-duplicates of
   recipes already in the library. `--next N` picks recipes built on common, non-staple ingredients
   first, preferring ones that add fewer new catalog ingredients. Recipes with unreviewed or vague names
   are only drafted if you pass `--allow-blocked`; their lines get `TODO_` IDs to fix by hand. Any
   reviewed ingredient the catalog lacks is added to `src/data/ingredients.ts`.
3. **Edit** every draft by hand (checklist below).
4. **Check.** `npm run check` fails while any `TODO` or `NaN` is left in `src/data/imported/`, or while
   a step uses a catalog ingredient that the list leaves out.

## Editing checklist

- **Every ingredient the steps use is listed**, with a quantity. Avoid filters on the list, so a
  pancake fried in unlisted butter would wrongly show for someone avoiding butter. Pasta-cooking water
  is the one exception, and the test skips water.
- **Exact heat, times and doneness.** Give oven temperatures in °F with °C, convert gas marks, and add
  safe internal temperatures for meat (ground beef 160°F / 71°C, poultry 165°F / 74°C).
- **US units first**, with metric in parentheses where the source gave it. The Metric setting converts
  everything else on the fly (`src/logic/units.ts`) and prefers your parenthetical metric figure. If
  `npm run check` reports a US unit left over in metric mode, reword it ("1 cup of the X" is fine) or
  add the ingredient's weight per cup to `GRAMS_PER_CUP`.
- **Write the tagline** (`description`) in the house style; see "Taglines" below.
- **Tag meals and dish types.** The guesses come from the source's tags and title, so check them.
- **Set realistic times**, including chilling or resting.
- **Leave out the source's chatter**: "Enjoy!", anecdotes, links to other pages.
- **Optional means optional.** Only garnishes and serve-withs are `opt(...)`; the recipe must work
  without them.
- **No near-duplicates.** If the draft says it's close to a library recipe, keep it only if it's a
  genuinely different dish.
- **Keep `needs culinary review`** in the source note until someone has cooked or checked it.
- **Keep the `from(...)` origin unchanged.** It's how we credit the original and find it again.
  `validateContent` rejects a second import of the same original.

## Taglines

The line under each recipe title is part of the product (owner, 2026-10-09: "I like the tagline under the
recipe name too. Let's keep that going."). Write a fresh one for every recipe; never paste the source's
intro. `tests/taglines.test.ts` enforces the shape.

- **One concrete sentence**, 40–130 characters: what the dish is, plus the one thing that makes it worth
  cooking (texture, a technique, speed, an occasion). A short second sentence is fine: "Ready in ten minutes."
- **Name real things:** ingredients, textures, methods. "Golden chicken bites with garlicky wilted spinach
  and a shower of Parmesan." beats "A tasty chicken dish."
- **No hype or filler:** no "!", "delicious", "tasty", "amazing", "perfect" or "this recipe". End with a
  period. No two recipes share a tagline.
- **A colon works for foreign or unfamiliar names:** "Italian egg-drop soup: beaten eggs stirred into
  simmering broth until they set into soft ribbons."

Good ones from the library:
- "Soft cinnamon apples under a buttery oat crumble."
- "Crisp, cheesy quesadillas with spiced black beans. A great pantry dinner."
- "A double-crust apple pie whose cinnamon filling is cooked down first, so it never turns soupy."
- "Rome's three-ingredient pasta: spaghetti tossed with Pecorino Romano and toasted cracked peppercorns
  into a creamy sauce."

## Ingredient mapping and catalog growth

**Owner rule (2026-10-09): when a recipe we import needs an ingredient the catalog doesn't have, the
catalog gains it.** A missing ingredient never blocks an import. Only unreviewed wording does.

`scripts/import/ingredient-map.ts` holds reviewed mappings from source wording. Each entry is one of:

- **A catalog ID:** the same food, written differently ("sweet butter" → `butter`).
- **`{ add: category }`:** a real ingredient the catalog lacks. When a recipe that uses it is drafted,
  `import:draft` adds the entry to `src/data/ingredients.ts`, under the "Added for imported recipes"
  section. The ID comes from the key, `name` sets the display name, and the key's spelling variants
  become aliases.
- **`'=other key'`:** a spelling variant of another key ("bay leaves" → `'=bay leaf'`).
- **`null`:** too vague to index ("cheese", "broth", "vinegar"). The editor names the specific food in
  the draft.
- **`false`:** equipment that was listed as an ingredient.

The catalog rules in [ingredient-mappings.md](ingredient-mappings.md) apply here too: **never map a
substitution**. Cayenne is not chili powder, bouillon is not broth, ground ginger is not fresh ginger.
A food that differs gets its own `{ add }` entry. The report's "Suggestion" column is a word match for
the editor to consider and is never applied automatically.

Tests check that:
- every target exists;
- no entry contradicts or shadows a catalog name;
- adding every reviewed ingredient at once still gives a valid catalog.

So the loop is:

1. Stage.
2. Review the names the report lists (or the ones the recipes you want need) into the map.
3. Draft.
4. Check each new catalog entry's name and category.

If editing swaps an ingredient for one the catalog lacks (say "ginger" in a spice blend was really
ground ginger), add it with `npm run import:catalog -- "ground ginger"`, which uses the same reviewed entry.

New ingredients aren't ranked as "Most common" suggestions. Search and More options find them. If one
is on the published frequency lists in [ingredient-popularity.md](ingredient-popularity.md), as corn
and orange were, add it to `src/data/popularity.ts` below the inline suggestions. Leave `staples.ts`
alone: the staples list is the owner's.

## Adding a collection

1. Record the license review in `recipe-sources.md`: quote the license and note how far reuse may go.
2. Add the collection to `RECIPE_COLLECTIONS` in `src/data/collections.ts`, with its exact license
   string and a credit line. Its `home` takes no `https://`, because `src/` must stay URL-free.
3. Write a reader in `scripts/import/sources/` that returns `RawRecipe[]`, and register it in
   `scripts/import/sources/index.ts`. Give it a pinned commit, an `exclude` list for entries with
   doubtful provenance, and a `textPolicy`:
   - **`reuse`:** public domain, CC0 or Unlicense. The source's wording can be kept and edited.
   - **`rewrite`:** ingredient lists and ideas only. Drafts get placeholder steps that must be written
     fresh, so the source's wording never lands in the app.
4. Add a `src/data/imported/<file>.ts` exporting the array, and include it in `src/data/imported/index.ts`.

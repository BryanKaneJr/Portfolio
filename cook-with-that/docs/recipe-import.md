# Importing recipes from open collections

How recipes from an outside collection get into the app. Which collections are allowed, and why, is in
[recipe-sources.md](recipe-sources.md). Only add a collection there after its license has been checked.

## The loop

```bash
npm run import:stage -- based-cooking            # fetch the pinned snapshot, parse, map, write the report
npm run import:draft -- based-cooking --next 10  # append the next 10 ready recipes as drafts
npm run import:draft -- based-cooking chili tacos  # or name the source keys you want
# edit the drafts in src/data/imported/basedCooking.ts
npm run check                                    # typecheck + validate + tests: must pass before committing
```

One batch is one commit. Keep batches small (5–15) so each can be reviewed.

1. **Stage** fetches exactly the commit pinned in `scripts/import/sources/index.ts` into `.import-cache/`
   (git-ignored), reads every entry, parses each ingredient line and maps it to a catalog ID. It writes
   `docs/import-reports/<source>.md`. That report has counts, every ingredient that blocks a recipe, and a
   greedy "add these to the catalog next" list.
2. **Draft** appends recipes in the `src/data/recipes.ts` format, with `source` metadata filled in
   (license, collection, original key, title and author). Wherever an editor must decide, it leaves
   `TODO` markers: missing quantities, times, descriptions and meal tags. It also leaves
   `// TODO check:` comments for steps that use an unlisted ingredient and for near-duplicates of
   recipes already in the library. `--next N` picks recipes built on common, non-staple ingredients
   first. Only recipes whose ingredients all map are drafted, unless you pass `--allow-blocked`.
3. **Edit** every draft by hand (checklist below).
4. **Check.** `npm run check` fails while any `TODO` or `NaN` is left in `src/data/imported/`, or while
   a step uses a catalog ingredient that the list leaves out.

## Editing checklist

- **Every ingredient the steps use is listed**, with a quantity. Avoid filters on the list, so a
  pancake fried in unlisted butter would wrongly show for someone avoiding butter. Pasta-cooking water
  is the one exception, and the test skips water.
- **Exact heat, times and doneness.** Give oven temperatures in °F with °C, convert gas marks, and add
  safe internal temperatures for meat (ground beef 160°F / 71°C, poultry 165°F / 74°C).
- **US units first**, with metric in parentheses where the source gave it.
- **Write a description** in the house style: one short, practical sentence.
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

## Ingredient mapping

`scripts/import/ingredient-map.ts` holds reviewed mappings from source wording to catalog IDs. Each
entry maps to one of:

- a catalog ID: the same food, written differently;
- `null`: a real ingredient with no catalog entry yet;
- `'=other key'`: a spelling variant of another key;
- `false`: equipment that was listed as an ingredient.

The catalog rules in [ingredient-mappings.md](ingredient-mappings.md) apply here too: **never map a
substitution** (cayenne is not chili powder, bouillon is not broth). The report's "Suggestion" column
is a word match for the editor to consider. It is never applied automatically. Tests check that every
target exists in the catalog and that no entry contradicts a catalog alias.

To unblock more recipes, add catalog ingredients in the order the report suggests, then re-stage.
Before adding an ingredient to the catalog, check whether it should also go into
`src/data/popularity.ts` or `staples.ts`.

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

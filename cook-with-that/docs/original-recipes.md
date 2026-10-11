# Writing original recipes

Open collections run out: Based Cooking yields roughly 120–150 good recipes and the federal sources lean healthy and
low-sodium ([recipe-sources.md](recipe-sources.md)). The rest of the library is **original recipes written for the
app**. They live in `src/data/originals/`, one file per theme, and use the same data format, catalog and checks as
imports. The 27 seed recipes in `src/data/recipes.ts` are originals too.

## What makes a recipe ours

Ingredient lists and the idea of a dish are facts nobody owns (US Copyright Office, Circular 33). Written directions,
headnotes and a particular cook's exact formula are expression. So:

- **Write from general cooking knowledge.** Don't search for, open or paraphrase a published recipe for the dish,
  and don't copy a specific source's quantities. Classic dishes have standard ratios (a roux, a vinaigrette, a basic
  cookie dough); use those and your own judgement.
- **Facts are fine to check:** what goes in a traditional dish, safe internal temperatures, a cut's cooking time.
  Never copy the wording of whatever you checked.
- **No outside credit.** `source: ORIGINAL_DRAFT` (from `src/data/recipeBuilders.ts`), never an `origin`.

## Standard

The editing checklist in [recipe-import.md](recipe-import.md) applies in full. In short:

- **The version a US or UK home cook expects**, from ordinary supermarket ingredients, with an oven, stovetop,
  sheet pans and a blender at most. A slow cooker or air fryer is fine as an alternative.
- **List every ingredient a step uses**, with a quantity (US units; metric is converted on screen). Optional means
  garnish or serve-with only.
- **Exact heat, times and doneness:** ground meat 160°F / 71°C, poultry 165°F / 74°C, pork 145°F / 63°C, fish
  145°F / 63°C; oven temperatures as "375°F (190°C)"; realistic prep and cook minutes, including resting or chilling.
- **Steps** a beginner can follow: one action per step, visual cues ("until golden at the edges"), no filler.
- **A tagline** in the house style (see "Taglines" in recipe-import.md).
- **Meals and a dish type** from `src/data/types.ts`. Give a dish type whenever one honestly fits.
- **Ingredients come from the catalog.** If a recipe needs one the catalog lacks, review its key into
  `scripts/import/ingredient-map.ts` as `{ add: category }` and run `npm run import:catalog -- "<key>"`. Never alias a
  different food to an existing ID.
- **No near-duplicates** of a library recipe. A different dish built on the same ingredients is fine.

`npm run check` enforces the mechanical parts: unique IDs, known ingredients, tagline shape, no US units left in
metric mode, no step naming an unlisted catalog ingredient, and the "needs culinary review" note
(`tests/originals.test.ts`). Like every recipe in the library, an original stays a draft until someone cooks or
checks it.

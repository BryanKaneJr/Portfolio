# NHLBI recipe books snapshot

`recipes.json` is a committed snapshot of the recipes in four recipe books that the National Heart,
Lung, and Blood Institute publishes as PDFs on nhlbi.nih.gov. It is the second NHLBI stream, next
to the web recipe pages in `content/import/nhlbi/`: same collection (`nhlbi`), same license and
credit line, and drafts land in the same file (`src/data/imported/nhlbi.ts`). The import pipeline
(`npm run import:stage -- nhlbi-books`, `npm run import:draft -- nhlbi-books …`) reads this file and
never the PDFs. The PDFs themselves are not kept or committed.

- **Fetched:** 2026-10-11 (each entry's `fetchedAt`), by `scripts/import/fetch-nhlbi-books.ts`.
- **172 recipes:** 75 + 43 + 26 + 28 (table below).
- **Entry fields:** the web snapshot's fields (`key`, `url`, `title`, `description`, `recipeSource`,
  `servings` or `yields`, `servingSize`, `prepMinutes`, `cookMinutes`, `ingredientLines`, `steps`,
  `tips`, `fetchedAt`) plus `book`, the book's title. `key` is `book-<book>/<recipe slug>`
  (`book-dinners/turkey-mole`), so it can never collide with a web page's key. `url` is the PDF with
  `#page=N` (the PDF page, not the printed page number). `recipeSource` and `book` both name the
  book. `description` is the book's headnote; `tips` are its "Tip:", "Hint:", "Note:", "Make It a
  Meal" and footnote paragraphs, and Family Meals' "Chefs in Training" lines. Nutrition facts,
  photos and the recipe symbols are not captured.

| Book (`book`) | Key prefix | NHLBI page | Edition | Recipes |
|---|---|---|---|---|
| *Deliciously Healthy Dinners* | `book-dinners/` | [resource page](https://www.nhlbi.nih.gov/resources/keep-beat-recipes-deliciously-healthy-dinners), [PDF](https://www.nhlbi.nih.gov/sites/default/files/publications/10-2921.pdf) | NIH Pub. No. 10-2921, October 2009 (reprinted June 2010) | 75 |
| *Deliciously Healthy Family Meals* | `book-family/` | [resource page](https://www.nhlbi.nih.gov/resources/keep-beat-recipes-deliciously-healthy-family-meals), [PDF](https://www.nhlbi.nih.gov/sites/default/files/publications/10-7531.pdf) | NIH Pub. No. 10-7531, December 2010 | 43 |
| *Heart-Healthy Home Cooking African American Style* | `book-african-american/` | [resource page](https://www.nhlbi.nih.gov/resources/heart-healthy-home-cooking-african-american-style), [PDF](https://www.nhlbi.nih.gov/sites/default/files/publications/WEHL-RecipeBook_508.pdf) | NIH Pub. No. 21-HL-3792, February 2021 | 26 |
| *Delicious Heart-Healthy Latino Recipes* (*Platillos latinos ¡sabrosos y saludables!*) | `book-latino/` | [resource page](https://www.nhlbi.nih.gov/resources/delicious-heart-healthy-latino-recipes-book-platillos-latinos-sabrosos-y-saludables), [PDF](https://www.nhlbi.nih.gov/sites/default/files/publications/Your_Heart_Your_Life_Recipe_Book.pdf) | NIH Pub. No. 24-HL-4049S, April 2024; English pages only (each recipe is printed again in Spanish) | 28 |

The first two books' covers say "Keep the Beat™ Recipes: …". That is an HHS trademark, so the
snapshot, the app and these docs name the books by their subtitles only.

## License

NHLBI's policy page (https://www.nhlbi.nih.gov/about/contact/trademark-branding-and-logo), checked
2026-10-09 and quoted in full in `content/import/nhlbi/README.md`:

> Unless noted otherwise, information posted on the NHLBI website within the nhlbi.nih.gov domain is in
> the public domain.

The PDFs are posted on nhlbi.nih.gov ("only available online for download and self-printing"), and
no recipe page carries a copyright notice. The same conditions as the web recipes apply (see
`docs/recipe-sources.md` §2):

- Recipes are adapted and credited per recipe (`source.origin`, collection `nhlbi`), with NHLBI's
  citation in `RECIPE_COLLECTIONS`. We never present an edited recipe as an NHLBI publication, and
  never suggest NHLBI endorses the app.
- Never use NHLBI or NIH logos, the "Keep the Beat™" name, the We Can!® name or logos (Family
  Meals), or any photo: the books' food photographs are by Ben Fink Photography, a commercial studio.
- *Dinners* and *Family Meals* say their recipes were "created for the NHLBI" by a contracted
  chef/instructor (and, for *Dinners*, a consultant dietitian), so 17 U.S.C. §105 doesn't strictly
  cover them; NHLBI still publishes them under the public-domain policy above, which is the same
  basis as the web recipes (many web pages are these recipes).

## Provenance check (2026-10-11)

The fetcher flags any recipe whose text says "adapted", "reprinted", "courtesy of", "copyright",
"used with permission" or "contributed by", or has a ©. None does. A search of the four books' full
text for those words, "source:" and "recipe by/from" found only non-recipe pages: the
acknowledgments (recipe developers and testers), a "Source: Food and Drug Administration" line under
a food-label chart, *Dinners*' "Reprinted June 2010" imprint and a "Source: Dietary Guidelines"
line in Family Meals' appendix. **No recipe is excluded for provenance.**

## Exclusions (`exclude` in `scripts/import/sources/index.ts`)

- **Duplicates, computed at load time** (`duplicatesInSnapshots`): the books reprint each other and
  the website, and `validateContent` only catches identical keys. A book recipe whose title matches
  a web page's (ignoring case, punctuation and "with"; a parenthetical name counts, so
  "Chickadillo (Chicken Picadillo)" matches "Chicken Picadillo") is excluded in favor of the web
  page, and a later book's copy in favor of the earlier book's. 45 recipes as of this snapshot.
- **Duplicates under another name:** `book-latino/oven-fried-yuca` (the web page spells it
  "Oven-Fried Yucca") and `book-african-american/mouth-watering-oven-fried-fish` (the web page calls
  it "Baked Fish").
- **Misprinted:** `book-african-american/scrumptious-meatloaf`. The 2021 edition prints 4 cups each of
  onion, green and red pepper, 8 teaspoons of nutmeg and 4 cups of breadcrumbs for 1 lb of beef
  (fractions lost in typesetting); the parse matches the printed page, but the recipe is wrong.

## How the PDFs are read, and what to check

`pdftotext -layout` prints each page as characters in columns. The parser
(`scripts/import/sources/nhlbiBooks.ts`) takes titles and page numbers from each book's table of
contents (the printed titles wrap around the prep-time box), finds the step column from the step
numbers, splits each line there, and reads the ingredient column, the steps, the headnote, the
tip paragraphs and the yield block separately. It also handles: recipes continued on the next page,
fractions printed as raised numerals (pdftotext splits "⅛" into "1" over "/8"), "4C" for "4 C",
"11/3" for 1⅓, step numbers set tight against the ingredient text, side labels ("main dishes"),
Family Meals' symbol letters, nutrition panels beside or under the columns, and the few
African American–style pages whose steps run full width under the ingredients.

Every parsed recipe was read against the layout text. Known rough edges, none in an imported recipe:
a few headnotes keep a stray phrase (`book-dinners/caribbean-pink-beans` starts with its prep-time
note), two notes printed side by side merge (`book-family/baked-eggrolls`), one left-column note is
cut short (`book-family/mexican-lasagna`), a garnish line joins the line above
(`book-latino/baked-tilapia-with-tomatoes`), and a serving size can keep a fragment
(`book-family/peanut-butter-hummus`). Group labels ("For sauce:") are dropped, like the web
snapshot does, so a recipe that lists lemon juice twice keeps both lines. Check amounts against the
PDF page (`url`) before importing.

## Not in the snapshot

- *Heart Healthy Recipes* (2003, the same series' first book): its resource page now returns "Page Not Found",
  the PDF is gone from nhlbi.nih.gov, and the Internet Archive wasn't reachable from the fetch
  environment. Several of its recipes are in *Dinners* anyway.
- The 2008 edition of the African American book (`/files/docs/public/heart/cooking.pdf`), replaced
  by the 2021 edition above.
- *Stay Young at Heart* and the American Indian/Alaska Native, Filipino and Vietnamese health
  manuals (*Honoring the Gift of Heart Health*, *Healthy Heart, Healthy Family*, *Your Health Is
  Golden!*): they aren't recipe books, and their recipes are on the website (`content/import/nhlbi/`).
- The Latino book's Spanish pages.

## Refetching

```bash
npm run import:fetch-nhlbi-books    # needs pdftotext (poppler-utils); behind a proxy Node's fetch ignores, prefix NODE_USE_ENV_PROXY=1
git diff content/import/nhlbi-books/recipes.json
```

The fetcher downloads each PDF in `NHLBI_BOOKS` to a temporary directory (one at a time, with a
pause, User-Agent `Cook With That content review`), converts it with `pdftotext -layout`, parses it
and deletes the PDFs. It warns about provenance wording and about contents entries that look like
recipes but don't parse, and fails if a book yields no recipes (a moved PDF or a new layout). Review
the diff before committing: a recipe already imported from a changed entry may need the same edit.

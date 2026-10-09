# NHLBI recipe snapshot

`recipes.json` is a committed snapshot of the 54 recipe pages the National Heart, Lung, and Blood
Institute publishes at
https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-foods/healthy-eating-recipes.
The import pipeline (`npm run import:stage -- nhlbi`, `npm run import:draft -- nhlbi …`) reads this file
and never the live site, so every report and draft can be reproduced. The app itself never reads it:
drafts are edited by hand into `src/data/imported/nhlbi.ts`.

- **Fetched:** 2026-10-09 (each entry's `fetchedAt`), by `scripts/import/fetch-nhlbi.ts`.
- **Entry fields:** `key` (the page slug, which `source.origin.key` records), `url`, `title`,
  `description` (the bold headnote), `recipeSource` (the page's "Recipe Source:" line), `servings`
  (or `yields` when the page doesn't give a plain serving count), `servingSize`, `prepMinutes`,
  `cookMinutes`, `ingredientLines`, `steps`, `tips` (the "Tip:" paragraphs) and `fetchedAt`. The text is
  the page's own wording; ingredient group labels ("For garnish:") and the recipe videos are left out.
  Nutrition facts and photos are not captured.

## License

NHLBI's policy page (https://www.nhlbi.nih.gov/about/contact/trademark-branding-and-logo), checked
2026-10-09:

> Unless noted otherwise, information posted on the NHLBI website within the nhlbi.nih.gov domain is in
> the public domain.

> The NHLBI asks only that no changes be made to the publications, videos, images, or other formatted
> multimedia products and that the material, as well any NHLBI webpage links, not be used in any direct
> or indirect product endorsement or advertising.

> If you use content from NHLBI, please use the following language to cite the source of the materials:
> Source: National Heart, Lung, and Blood Institute; National Institutes of Health; U.S. Department of
> Health and Human Services.

What that means for the app (see also `docs/recipe-sources.md` §2):
- Recipes are adapted and credited per recipe (`source.origin`, collection `nhlbi`) with the citation
  above in `RECIPE_COLLECTIONS`. We edit recipe text, not NHLBI's formatted publications, and never
  present an edited recipe as an NHLBI publication.
- Never use NHLBI or NIH logos, the "Keep the Beat™" name, or the cookbook photos (a commercial
  studio's), and never suggest NHLBI endorses the app, including in App Store copy or ads.

## Provenance check (2026-10-09)

Every page's "Recipe Source:" names an NHLBI publication: *Deliciously Healthy Dinners* (21 pages),
*Stay Young At Heart* (10), *Heart Healthy Home Cooking African American Style* (6), *Delicious Heart
Healthy Latino Recipes* (5), *Deliciously Healthy Family Meals* (5), *Honoring the Gift of Heart Health*
(American Indian and Alaska Native manual, 4), *Healthy Heart, Healthy Family* (Filipino manual, 2) and
*Your Health Is Golden!* (Vietnamese manual, 1). No page says it is from or adapted from a non-federal
source, and none carries a copyright notice or a third-party credit. **No page is excluded**, so
`exclude` in `scripts/import/sources/index.ts` is empty. Add a page there, with the reason, if a later
refetch brings one that fails this check.

Not imported for fit, not provenance (see the 2026-10-09 batch notes): drinks (mango shake, summer breeze
smoothie), recipes needing a turkey carcass, dried pink beans and plantains, yucca, rice-paper or lumpia
wrappers, frozen puréed squash, and near-duplicates of library dishes (fried rice, lentil soup).

## Refetching

```bash
npm run import:fetch-nhlbi    # rewrites recipes.json; behind a proxy Node's fetch ignores, prefix NODE_USE_ENV_PROXY=1
git diff content/import/nhlbi/recipes.json
```

The fetcher walks the listing pages (`?page=0`, `1`, …) until one adds no new recipe, then fetches each
page one at a time with a pause, using the User-Agent `Cook With That content review`. It warns about any
page whose Recipe Source isn't a known NHLBI publication or whose text mentions adaptation or copyright;
check those by hand before importing them. A redesign of the site makes the parser fail loudly rather
than save partial recipes. Review the diff before committing: an edited page keeps its key, so a recipe
already imported from it may need the same edit.

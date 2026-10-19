# Recipe pictures

Owner, 2026-10-19: every recipe gets a picture, made with AI or taken from stock, in "a cool old fashion style… like a
50's style kitchen" for a premium feel. One look across the whole set is what makes it read as premium, so every
picture follows the style below, stock ones included (pick vintage-style illustrations, or leave the recipe on its
dish icon until a matching picture exists).

Where they show: the recipe page (a wide 4:3 picture at the top), recipe cards and the meal-plan chooser (a small
square cropped from the middle). A recipe without a picture keeps its dish icon, so they can be added a batch at a time.

## The look
A 1950s American cookbook illustration of the finished dish:

- **Medium:** gouache and screen-print look, visible paper grain, soft halftone shading, warm daylight.
- **Palette:** tomato red, mustard yellow, mint green, cream and charcoal (the tomato is the app's accent colour).
- **Subject:** the food is the hero, centered and filling the middle of the frame, seen from a three-quarter angle,
  served simply on vintage 1950s dishware, on a laminate counter or table.
- **Setting:** a cheerful 1950s kitchen behind it, simple and softly out of focus: checkered floor, a rounded pastel
  refrigerator, chrome trim, a starburst clock.
- **Never:** people or hands, text or lettering, labels, logos or recognisable brands (draw a plain bottle, not a
  Kewpie or sriracha label).
- **Shape:** landscape 4:3, at least 1200×900 (1536×1152 or larger is best). Keep the dish inside the middle square:
  cards crop the sides off.
- **Accuracy:** the dish should look like our recipe (the tagline says what's in it). No garnish, sides or
  ingredients the recipe doesn't have.

## Prompts
`recipe-images/prompts.md` has a ready prompt for every recipe still without a picture: the title and tagline, then
the same style text (it lives in `scripts/images/recipe-images.ts` as `STYLE`; change it there, not by hand). To
keep the set consistent:

1. Make a few pictures first and pick the one that best fits the look above.
2. Use that one as a **style reference** for every picture after it (most image generators accept a reference image).
3. Stay with the same tool and settings for the whole set; redo any picture that drifts from the others.

## Adding pictures
1. Save each picture in `content/images/incoming/` (this folder isn't committed), named by its recipe ID as listed in
   `prompts.md` (`garlic-chicken-spinach-skillet.png`). The recipe title works too.
2. Run `npm run images -- --source "ai: <tool name>"` (or `--source "stock: <site>"`). It makes a small WebP of each
   in `assets/recipes/` (4:3, at most 160 KB), moves the original to `content/images/originals/`, records the source
   in `recipe-images/credits.json`, and rewrites the app's picture list (`src/data/recipeImages.ts`) and the prompts.
3. For a stock picture, add its `license` (and `url`) to its entry in `credits.json`.
4. Run `npm run check`, then commit `assets/recipes/`, `src/data/recipeImages.ts` and `docs/recipe-images/`.

`tests/recipeImages.test.ts` fails if a picture has no shipped recipe, is over 200 KB, is missing from the app's
list, or has no source (or, for stock, no license).

## Rights
- **AI pictures:** the tool's terms must allow commercial use (on some tools only paid plans do). Keep the tool's
  name in `credits.json`.
- **Stock pictures:** the license must cover use inside an app sold on the App Store. Record it in `credits.json`.
- Never pictures from recipe sites, social media or image search: they belong to someone.

## Size
About 100–160 KB each, so all 406 come to roughly 40–65 MB in the app download.

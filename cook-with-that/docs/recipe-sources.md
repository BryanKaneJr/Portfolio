# Recipe sources: what we can legally bundle

Cook With That is a **paid, offline App Store app**. Every recipe ships inside the binary, which Apple
encrypts with FairPlay. A source is usable only if it allows commercial use and redistribution inside a
paid binary, and if its attribution and share-alike duties are ones we can meet. Reviewed 2026-10-08.
This is research, not legal advice: get a lawyer's read before launch if anything here is load-bearing.

## Ranked list

| # | Source | License | Size | Effort | Risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | [Based Cooking](#1-based-cooking) | Unlicense (public domain dedication) | 440 recipes | Medium: an editorial pass on each recipe, plus catalog growth | Low | **Use now.** Pipeline built; 9 imported |
| 2 | [US federal recipes](#2-us-federal-recipes) (USDA MyPlate Kitchen, NIH/NHLBI) | Public domain in the US if written by federal staff; third-party recipes vary | Hundreds | Medium: a per-recipe provenance check | Low for federal-authored recipes | **Use, recipe by recipe** |
| 3 | [HowToCook](#3-howtocook) | Unlicense; contributors certify their recipes as public domain | 372 recipes (Chinese) | High: translation, plus Chinese pantry ingredients | Low; exclude the 64 that cite references | Later, for a Chinese home-cooking set |
| 4 | [Project Gutenberg cookbooks](#4-project-gutenberg-cookbooks) | Public domain in the US (published before 1931) | Thousands | High: archaic measures, no oven temperatures | Low in the US; check other countries | Ideas plus text to adapt; strip all Project Gutenberg branding |
| 5 | [Wikibooks Cookbook](#5-wikibooks-cookbook) | CC BY-SA 4.0 / GFDL | ~3,600 recipes | Same as writing originals | **High if the text is bundled** | **Facts and ideas only.** Never ship its wording |
| 6 | [fossrecipes](#6-small-cc0-sets) | CC0 1.0 | 21 recipes | Low | Low | Optional quick add |
| ✗ | [Not usable](#not-usable) | TheMealDB, scraped datasets, NC-licensed books, Cookpad | | | | **Don't use** |

**Coverage reality check.** The current catalog has only 89 ingredients. Today only 22 of Based
Cooking's 440 recipes map to it in full; the other 406 each need at least one ingredient we don't carry.
The import report's greedy list shows how adding ingredients unlocks recipes:

| Catalog ingredients added | 10 | 25 | 50 | 100 | 150 | 200 |
|---|---|---|---|---|---|---|
| Based Cooking recipes unlocked (approx.) | 9 | 19 | 32 | 74 | 114 | 131 |

These counts are a lower bound: some blocking "ingredients" are parsing noise that review cleans up.
Many of the unlocked recipes are niche (cocktails, preserves, regional dishes), so for this app Based
Cooking realistically yields **about 60–120 good recipes**. Reaching 250–350 takes three streams:
Based Cooking, federal recipes, and **original recipes written for the app**. Wikibooks and the old
cookbooks can serve the originals as idea and fact sources, steered by `npm run coverage-report` gaps.

## Ground rules (apply to every source)

- **Facts are free, expression isn't.** US Copyright Office, Circular 33: *"A mere listing of
  ingredients or contents, or a simple set of directions, is uncopyrightable."* Written directions
  with "substantial literary expression", headnotes and photos are protected. An original recipe built
  from an idea or an ingredient list owes nothing to the source, provided we don't paraphrase its
  wording closely or copy its selection wholesale.
- **CC licenses and the App Store don't mix, including plain CC BY.** CC 4.0 §2(a)(5)(C): *"You may
  not offer or impose any additional or different terms or conditions on, or apply any Effective
  Technological Measures to, the Licensed Material if doing so restricts exercise of the Licensed
  Rights by any recipient."* CC's own wiki
  (https://wiki.creativecommons.org/wiki/4.0/Technical_protection_measures) says: *"Apple's iOS App
  Store … uses … FairPlay TPM … distribution of CC-licensed materials via the App Store may constitute a
  violation of the license."* CC considered and rejected a "parallel DRM-free copy" fix for 4.0.
  The clause is in **CC BY**, not just BY-SA. **We only bundle text that is public domain, CC0 or
  Unlicense**, or text we wrote ourselves.
- **Provenance beats the label.** A public domain dedication only covers what the contributor owned.
  Pages that credit a blog, magazine or video get excluded (each source keeps an `exclude` list).
- **No images** from any source until each one is checked individually. The app doesn't need them yet.
- **Credit anyway.** Every imported recipe records its collection, original key, title and author
  (`source.origin`). Public domain doesn't require credit, but an acknowledgements screen built from
  `RECIPE_COLLECTIONS` costs little and is good manners. *No credits screen exists yet.*

## 1. Based Cooking

https://github.com/LukeSmithxyz/based.cooking. This is the live repository: last commit 2026-09-09,
many PRs merged in August 2026. `slendidev/based.cooking` is a stale 2023 copy, and
publicdomainrecipes.com and foss.cooking are near-identical copies that add one recipe between them.

- **License:** `LICENSE.md` is the Unlicense: *"Anyone is free to copy, modify, publish, use,
  compile, sell, or distribute this software … for any purpose, commercial or non-commercial … the
  author or authors … dedicate any and all copyright interest in the software to the public domain."*
  The README, since the first commit (2021-03-10), adds: *"This website and all its content is in the
  public domain. By submitting text or images or anything else to this repository, you waive any
  pretense of ownership to it."* The repo was CC0 1.0 from 2021-03-16 and switched to the Unlicense on
  2022-05-27. Each recipe was therefore contributed under the README waiver, CC0 or the Unlicense, all
  of which allow commercial use.
- **Size:** 440 Markdown recipes, most with tags and author, and about 300 with prep and cook times or
  servings. The format is uniform: `## Ingredients` plus `## Directions`.
- **Quality:** uneven community writing, mixed metric and US units, 65 recipes with no quantities,
  and steps that use ingredients the list leaves out (salt, butter for the pan). Every import needs
  the editorial pass in [recipe-import.md](recipe-import.md).
- **Provenance:** 7 pages credit an outside original and are excluded: couscous (196flavors.com),
  kettle-chips (a chef's blog), yorkshire-puddings (BBC Good Food), tuscan-style-pork-roast (Binging
  With Babish), and beef-tips, gumbo-shrimp-and-sausage and shrimp-and-grits (YouTube videos).
  The 11 "Miss Leslie" recipes are transcribed from Eliza Leslie's 1832/1857 books (public domain).
- **Don't bundle `data/authors/`**: it holds email and donation addresses. The importer reads only the
  display name.
- **Status:** pinned at commit `9d4a31a0`. 9 recipes imported (Spanish tortilla, menemen, Irish potato
  casserole, cheesy pasta bake, banana pancakes, blueberry muffins, Southern biscuits, hamburger
  patties, brown butter cinnamon sugar biscuits), and 13 more map in full today.

## 2. US federal recipes

*Verification in progress: this section will be completed with quoted terms.*

- **Status:** works written by US federal employees as part of their jobs have no US copyright
  (17 U.S.C. §105). Federal recipe sites also carry recipes contributed by outside groups: MyPlate
  Kitchen's About page says *"Some recipes featured in MyPlate Kitchen have been developed by…"*. Those
  third-party recipes stay copyrighted unless the page says otherwise, so **check every recipe's own
  source line**.
- **Fit:** modern US home cooking with °F temperatures and cup/tbsp measures, a strong match for the app.
- **Caveats:** §105 is US law only, so another country could in principle treat a US government work as
  copyrighted. Photos are often third-party; don't take them. Don't imply USDA or NIH endorsement, and
  don't use their logos.

## 3. HowToCook

https://github.com/Anduin2017/HowToCook. About 102k stars and actively maintained.

- **License:** `LICENSE` is the Unlicense. The PR template requires contributors to confirm the recipe
  can be declared public domain (*"任何人都可以自由复制，修改，发布，使用，编译，出售…"*: anyone may
  freely copy, modify, publish, use, compile, sell…) and that it involves no copyrighted material.
- **Size and format:** 372 recipes in Chinese, very structured: ingredients and tools, per-serving
  gram and ml quantities, then steps. A translation is our own work, made from a public domain text.
- **Risk:** 64 recipes list "参考资料" (references), 12 of them on xiachufang.com, a commercial recipe
  site. Exclude all 64.
- **Fit:** good Chinese home cooking, but it needs pantry items the catalog lacks (Shaoxing wine,
  oyster sauce, doubanjiang). Worth a set later, not first.

## 4. Project Gutenberg cookbooks

- **Status:** works published before 1931 are public domain in the US (1930 works entered on
  2026-01-01). The App Store sells worldwide, though, and many countries protect works for 70 years
  after the author's death. Prefer authors who died before 1956, or restrict territories.
- **Trademark:** *"If you strip the Project Gutenberg license and all references to Project Gutenberg
  from the text, you are left with a text unrestricted by U.S. intellectual property law."* Strip the
  header, the START/END markers, the license footer and the "Produced by" lines. A thank-you in an
  acknowledgements screen is fine.
- **Candidates:** Boston Cooking-School Cook Book (#65061, Fannie Farmer, died 1915), White House Cook
  Book (#13923, 1887), Mrs. Wilson's Cook Book (#17438, 1920, some °F), Marion Harland's Complete Cook
  Book (#64459), the USDA's *Aunt Sammy's Radio Recipes* (#65379, a federal work) and *Money-Saving
  Main Dishes* (#65706, 1962, a federal work with modern °F temperatures).
- **Effort:** high. Measures like "butter the size of an egg", "moderate oven", lard and suet, and
  outdated food safety all need fixing. Our modernized rewrite is our own text. Best used for classic
  dishes the library lacks.

## 5. Wikibooks Cookbook

- **License:** CC BY-SA 4.0, mostly dual-licensed with the GFDL. The GFDL doesn't help: §2 says
  *"You may not use technical measures to obstruct or control the reading or further copying."*
- **Size:** the Hugging Face dump `gossminn/wikibooks-cookbook` (CC BY-SA 4.0, July 2024) has 3,895
  pages. 3,658 of them have at least 3 ingredients and 2 steps. It has no author or revision fields.
- **Why not bundle:** see the CC/App Store rule above. Share-alike would also make our edited text
  BY-SA, free for competitors to copy.
- **Allowed use:** facts and ideas. Look up which ingredients go together, then write an original
  recipe with our own directions (`textPolicy: 'rewrite'` if it's ever wired into the pipeline).

## 6. Small CC0 sets

- **fossrecipes** (https://github.com/kennedy/fossrecipes): CC0 1.0, *"Attribution is appreciated,
  but not required"*, and contributors affirm they have the rights. Only 21 recipes.
- Sandwich-Zone/sandwiches (CC0, 9 recipes) and similar: too small to bother with.

## Not usable

- **TheMealDB:** its terms say *"You cannot publish apps to an appstore unless you are a paid
  subscriber"* and *"You cannot use third-party content in the API unless you have the owner's
  permission."* Most of its 790 meals link a commercial source (BBC Good Food 277, Allrecipes 44, BBC
  23 …), and at least one is copied word for word. It can't license text it doesn't own.
- **Scraped datasets:** RecipeNLG, Recipe1M, Food.com, Epicurious, plus the "open" ones that turned out
  to be scraped: fictivekin/openrecipes ("scraped from various publishers"), dpapathanasiou/recipes
  (MIT label, but the text comes from Allrecipes, Epicurious and Food Network) and dspray95/open-recipe
  (a BBC Good Food scraper).
- **LibreTexts culinary books:** CC BY-NC-SA, and non-commercial rules them out. BCcampus culinary
  textbooks: CC BY (the App Store problem), and they contain hardly any recipes.
- **Cookpad research data:** academic use only.
- **Uncertain Unlicense repos:** skoenig/kochbuch (some text looks pasted from Chefkoch),
  clarklab/chowdown (one recipe "scanned from" a blog; images from Flickr), Koha cookbook (README says
  CC0, LICENSE says GPL).
- **Wikidata** (CC0) has no quantities or directions. It's useful later for dish names and
  ingredient links, not recipes.

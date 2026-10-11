# bc7 handoff: Based Cooking slice 3 (lemon-pudding … quesadilla)

12 recipes imported, appended in this order. `npm run check` passes in the worktree: 136 recipes,
213 ingredients, 300 tests (288 + 12 new tagline cases).

## Imported (source key → id: title, and the gap it fills)

| Source key | id: title | Gap |
|---|---|---|
| pilaf | uzbek-beef-plov: Uzbek Beef Plov | **Rice dish** (`rice` + beef chuck + carrot + onion). Beef is `chuck_roast`, so a Use search for *ground* beef + rice still finds nothing |
| lenten-chili | lenten-bean-and-rice-chili: Lenten Bean and Rice Chili | **Rice** + **beans** (kidney) + canned tomatoes + corn; soup/one_pot; meatless |
| paella | valencian-style-chicken-paella: Valencian-Style Chicken Paella | **Rice dish** with chicken, but the rice is `bomba_rice` (Paella rice), not `rice`. Fills **beans with chicken** (lima beans), beans + fresh tomato, chicken + green beans |
| miso-ginger-pork | miso-ginger-pork-rice-bowls: Miso Ginger Pork Rice Bowls | **Rice** + ground pork + zucchini; bowl |
| meatloaf | tomato-glazed-meatloaf: Tomato-Glazed Meatloaf | Classic missing from the library; ground beef bake |
| pastitsio | pastitsio: Pastitsio (Greek Baked Pasta) | Ground beef + pasta bake |
| modern-borscht | beef-borscht: Beef Borscht | **Soup**; beef + potato + cabbage + beets |
| lentejas | sopa-de-lentejas: Sopa de Lentejas (Spanish Lentil Soup) | **Soup**; bell pepper + fresh tomato + lentils |
| oatmeal-cookies | oatmeal-cookies: Oatmeal Cookies | **Dessert**, baked goods |
| portuguese-creamy-cod | portuguese-creamy-cod-bake: Portuguese Creamy Cod Bake | Fish + potato bake |
| lithuanian-cold-borscht | lithuanian-cold-beet-soup: Lithuanian Cold Beet Soup (Šaltibarščiai) | **Soup** (cold); potato + egg + cucumber |
| limoncini | limoncini: Limoncini (Lemon Sugar Swirls) | **Dessert**, baked goods |

Every recipe has at least one dish type. No page in this slice uses black beans, so gap 2 (black beans)
gets nothing from me.

### Main edits beyond wording (all need the usual culinary review)
- **Plov:** scaled from 1 kg rice / 1.5 kg meat to 2 cups rice / 1 1/2 lb beef; picked beef chuck for
  "lamb or any other meat"; added the tomato paste the steps used but the list left out; replaced the
  source's 1.5–2 h simmer-with-rice (would turn the rice to mush) with the usual plov sequence: stew the
  meat first, then layer the rice and steam it 25–30 min.
- **Lenten chili:** picked white rice for "white or brown"; source says 4 servings but 4 cans of beans
  plus 29 oz sauce makes ~8; cut the crushed red pepper from 1 tbsp to "1 tsp, up to 1 tbsp".
- **Paella:** dropped rabbit and snails (hard to find) and the optional artichokes, so the title says
  "Valencian-Style Chicken"; garrofó → frozen lima (butter) beans; scaled to fit a 12-inch skillet.
  The draft mapped "large white beans" to `cannellini_beans` through the existing `white beans` entry,
  which is wrong for garrofó, so the line was fixed by hand.
- **Miso pork:** source has no quantities; I supplied them. Dropped the quick-pickled daikon garnish,
  the optional broth and crushed red pepper; picked zucchini for "zucchini or bok choy". "Sushi rice" is
  written as "white rice, preferably short-grain" on `rice` (the bowl is just served over steamed rice);
  I did **not** add a `sushi rice` map entry, because mapping it to `rice` would be wrong for real sushi.
- **Meatloaf:** scaled 4 1/2 lb → 2 lb in one loaf; Campbell's soup → `condensed_tomato_soup`;
  3 brown sugar cubes → 1 tbsp packed brown sugar (fixed by hand, no map entry for the cube wording);
  dropped the optional Frank's RedHot.
- **Pastitsio:** the source's béchamel (226 g butter + 226 g flour for 1.2 L liquid) is a paste, so it's
  1/2 cup butter + 2/3 cup flour; one 6-oz can of tomato paste instead of 340 g; 1 lb pasta for a
  9x13 dish; dropped the optional cloves.
- **Beef borscht:** the page has no "Directions" heading (drafted as `no_steps`), so the steps are
  rewritten from its "Prep" and "Cooking" sections; tenderloin → chuck/stew meat; added 2 cups water.
- **Lentejas:** chorizo made required (it's the point of the dish; "optional" isn't a garnish), as
  cured Spanish chorizo; water 2 → 4 cups so it's a soup; no overnight soak for brown lentils.
- **Oatmeal cookies:** source has no leavening and no oven temperature: added 1 tsp baking soda and
  350°F; "whisk butter" → beat softened butter.
- **Cod bake:** flour 1/2 tbsp → 2 tbsp so 400 ml milk actually thickens; cheese → mozzarella (the
  source's suggestion); fresh cod as in the source (real bacalhau com natas uses salt cod; the tagline
  says so).
- **Cold beet soup:** source gives per-serving amounts; written for 4. Kefir only (buttermilk/yogurt
  alternatives left out); radishes and pickled beets dropped.
- **Limoncini:** 25 g fresh "brewer's yeast" (Italian *lievito di birra*) → 1 tbsp (9 g) active dry;
  00/0 flour → all-purpose; a pinch of salt → 1/2 tsp for 650 g flour.

## Provenance checks (all 12 imports)
- Snapshot grep and full `git log --follow -p` grep in based-luke: no outside credits. Hits were only
  the contributors' own websites/donate links (miso-ginger-pork, meatloaf, lentejas, lenten-chili) and an
  unrelated multi-file commit message on pilaf.
- **Integrator's extra step (commit 0694559):** paella, modern-borscht, oatmeal-cookies,
  lithuanian-cold-borscht and limoncini were added by that commit. Their full histories in
  `pdr-codeberg` have no credit hits; the only removed lines are whitespace and tag fixes.
- **portuguese-creamy-cod** has a similar gap: its based.cooking history starts at bulk commit
  97e5806 ("foss cooking content added", Aug 2026). The local `Rushmore75_foss.cooking` clone is shallow
  (1 commit, same text, no credit), so I checked the page's original 2022 PR in a public based.cooking mirror
  (merge commit 3c373f2, "Adds Portuguese creamy cod" by taislin): no source, "adapted from" or link.
  It's cleared, but flagged here because that bulk commit is a second "history starts here" case like 0694559.
- Web searches of one or two distinctive sentences from every import found only based.cooking mirrors.

## Promising pages skipped, and why
- **mapo-tofu:** doubanjiang, douchi, Sichuan peppercorns and Shaoxing wine are hard to find for a US/UK
  supermarket shopper. Provenance clean.
- **pork-based-chili-con-carne, quesadilla, pan-pizza, oats, miso-soup, pho-soup, bitoque
  (portuguese-steak-with-beer-sauce), potato-soup, oven-asado:** no quantities or too thin to cook from;
  quesadilla also duplicates Black Bean & Cheddar Quesadillas.
- **merchants-buckwheat, pan-seared-chicken:** history says "Originally published at yaroslavps.com",
  which is the contributor's own blog (Yaroslav de la Peña Smirnov, author `yaroslav-smirnov`), so not an
  outside original. Skipped anyway: buckwheat needed heavy rescaling (6–8 tbsp tomato paste for 1/2 cup
  buckwheat) and pan-seared chicken has no proportions at all.
- **long-cooked-chuck-steak:** thin slow-cooker page, no gap filled.
- **mazurek:** its topping is another page (orange jam).
- **potato-pure, pancake, oatmeal-pancakes, oaty-pancakes, overnight-oats, popcorn:** near-duplicates of
  library recipes (mashed potatoes, pancakes, overnight oats, kettle corn). Oaty pancakes also has 2 tsp
  baking soda plus 2 tsp baking powder, and its wording reads like a printed cookbook (not confirmed).
- **matcha-cookies:** matcha, white couverture and macadamias; intro reads like copied web text and the
  method names a professional Unox oven (not confirmed, not used).
- **pumpkin-flatbread:** Hokkaido pumpkin and soy yogurt; reads like translated German magazine copy
  ("type 405" flour, "top and bottom heat"), but no match found, so not listed as an exclusion.
- **omelet:** a vintage tapioca soufflé omelet (double boiler); probably from an old Minute Tapioca booklet,
  not confirmed. Skipped for fit.
- **okonomiyaki:** dashi, tonkatsu sauce, katsuobushi, nori. **paneer-tikka-masala:** paneer, fenugreek,
  skewers. **pulled-rabbit, pulpo-gallega, lobster-bisque, liverpate:** rabbit, octopus, live lobster, liver.
  **pozharskiye-cutlets:** no quantities. **okroshka, quarkbaellchen:** kvass or "boiled sausage", quark.
  **naan-bread:** method is broken (milk never added; 30–35 min bake for naan).
- **Bare components/drinks/jams (out of scope):** limoncello, manhattan, milus-fast-kvass, oat-milk,
  orange-glorious, orange-jam, original-gatorade, party-mimosa, mayonnaise-or-aioli, mushroom-sauce,
  pasta-sauce, pepper-sauce, pizza-sauce, pizza-dough, no-knead-pizza-dough, no-knead-bread, puff-pastry,
  peanut-butter, pickled-onions, pasta, pretzels (also needs lye), onion-raitha (sauce).

## For the integrator
- **New catalog entries (11):** bomba_rice (Paella rice; key already reviewed), saffron, ground_pork,
  miso_paste, garlic_salt (keys already reviewed), plus my new keys beet, cod (already reviewed),
  lima_beans, condensed_tomato_soup, kefir, spanish_chorizo. `beet` is singular with aliases `beets`,
  `beetroot`; searchAudit passes with all of them.
- **Likely overlaps with other workers:** `chorizo` (I set it to `null` because Spanish and Mexican
  chorizo cook differently, and added `spanish chorizo`), `lima beans`/`butter beans`, `beet(s)`,
  `kefir`, and `meat: null`. Reconcile if another worker reviewed the same keys differently.
- `brewer s yeast` is `null` on purpose: in translated Italian recipes it means fresh baker's yeast,
  in English it's the inactive supplement.
- **GRAMS_PER_CUP (optional):** fresh dill shows as ml in metric ("1/4 cup" → 60 ml; "1/3 cup" → 80 ml).
  I didn't add a dill weight because I couldn't confirm one. Everything else in my recipes either has
  the author's metric figure or converts already; no test changes needed.
- `docs/import-reports/based-cooking.md` was regenerated by `import:stage` but came out identical, so
  there's nothing to hand back.

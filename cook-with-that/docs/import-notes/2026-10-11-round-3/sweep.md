# sweep: what was left in Based Cooking and NHLBI's web recipes (round 3)

24 recipes imported: 17 from Based Cooking, appended to `src/data/imported/basedCooking.ts`, and 7 from NHLBI,
appended to `src/data/imported/nhlbi.ts`. A 25th, **Easy Beef Pho**, is handed back separately in
`extra-easy-beef-pho.ts.txt` (see "Deferred extra" below).

`npm run check` passes in my worktree: 219 recipes (195 + 24), 278 ingredients (254 + 24), 386 tests. Both recipe
files are append-only: the diff has no removed lines. `basedCooking.ts`, `nhlbi.ts`, `ingredients.ts` and
`ingredient-map.ts` are Prettier-clean. `ingredients.ts` changed only through `import:draft` and `import:catalog`.

The worktree was created at `c061183a`. I fast-forwarded it to `0759aea8` (the round-3 base) before changing anything.

Coverage report in my worktree (without the other workers' recipes): 2-ingredient pairs 80% → 82%, triples
30% → 35%.

## Imported

| Source key | id: title | Gap or reason |
|---|---|---|
| based-cooking/hoisin-pork-belly | hoisin-pork-belly: Hoisin Pork Belly | pork belly main (a reserve pick from bc6) |
| based-cooking/fume-sauce | pasta-al-fume: Pasta al Fumè (Pancetta, Tomato and Cream) | quick weeknight pasta |
| based-cooking/crostata (+ shortcrust-pastry) | apricot-jam-crostata: Apricot Jam Crostata | dessert, baked goods |
| based-cooking/granita | lemon-granita: Lemon Granita | dessert (frozen) |
| based-cooking/french-crepes | french-crepes: French Crêpes | breakfast/dessert; the library had no crêpes |
| based-cooking/apple-strudel | quick-apple-strudel: Quick Apple Strudel | dessert, baked goods |
| based-cooking/gnocchi | potato-gnocchi-with-sage-butter: Potato Gnocchi with Sage Butter | homemade gnocchi; potato main or side |
| based-cooking/kalderetang-manok | kalderetang-manok: Kalderetang Manok (Filipino Chicken Stew) | **chicken + cheddar** (required), chicken + potato + bell pepper |
| based-cooking/schinkenfleckerl-gratinated | schinkenfleckerl: Schinkenfleckerl (Viennese Ham and Noodle Bake) | ham + pasta bake |
| based-cooking/ragu-napoletano | ragu-napoletano: Ragù Napoletano (Sunday Gravy) | ground beef + pasta + tomato; a weekend project (bc8 suggested it for a later round) |
| based-cooking/fondue | swiss-cheese-fondue: Swiss Cheese Fondue | dinner or appetizer for a group |
| based-cooking/savory-squash | whipped-butternut-squash-with-blue-cheese: Whipped Butternut Squash with Blue Cheese | side |
| based-cooking/merchants-buckwheat | merchants-buckwheat-with-pork: Merchant's Buckwheat with Pork | one-pan pork and grain dinner |
| based-cooking/okonomiyaki | okonomiyaki: Okonomiyaki (Japanese Cabbage Pancakes) | cabbage + bacon + eggs dinner |
| based-cooking/babas-feta-pasta | babas-feta-pasta: Baba's Feta Pasta | **broccoli + tomato** (required), broccoli + pasta, broccoli + mushroom |
| based-cooking/potato-soup | baked-potato-soup: Baked Potato Soup | soup; potato + cheddar |
| based-cooking/portuguese-steak-with-beer-sauce | bitoque: Bitoque (Portuguese Steak and Egg) | steak + eggs skillet dinner |
| nhlbi/asparagus-lemon-sauce | asparagus-with-lemon-sauce: Asparagus with Lemon Sauce | side (nhlbi2's suggested next pick) |
| nhlbi/roasted-beets-orange-sauce | roasted-beets-with-orange-sauce: Roasted Beets with Orange Sauce | side (nhlbi2's suggested next pick) |
| nhlbi/baked-fish | cornflake-crusted-baked-fish: Cornflake-Crusted Baked Fish | fish dinner (nhlbi2's suggested next pick) |
| nhlbi/lentil-soup | lentil-and-vegetable-soup: Lentil and Vegetable Soup | meatless soup (Sopa de Lentejas has chorizo; Lebanese lentil soup was excluded) |
| nhlbi/chicken-chile-stew | green-chile-chicken-stew: Green Chile Chicken Stew | chicken soup/stew |
| nhlbi/rainbow-fruit-salad | rainbow-fruit-salad: Rainbow Fruit Salad | dessert/side; the library had no fruit salad |
| nhlbi/fresh-lumpia-lumpiang-sariwa | fresh-lumpia: Fresh Lumpia (Lumpiang Sariwa) | appetizer |

Black beans, ground beef with broccoli or spinach, rice with spinach and spinach with bell pepper: nothing left in
either pool uses them. The only black-bean, spinach or broccoli pages left are excluded, duplicates or the two I
used.

Dish type left empty because none honestly fits: Lemon Granita, French Crêpes, Asparagus with Lemon Sauce and
Fresh Lumpia. Everything else has at least one.

## Deferred extra: Easy Beef Pho (`extra-easy-beef-pho.ts.txt`)

Based Cooking `pho-soup` (Jon Burga), fully edited. I took it out of my worktree for the same reason o-pork-seafood
took out their Pad Thai. A `rice noodles` catalog item breaks `tests/import.test.ts` › "a word match is only ever a
suggestion", which uses `'rice noodles'` as its example of an unreviewed name, and tests aren't mine to change. To
add it:
1. In that test, swap `'rice noodles'` for `'wild rice'` (o-pork-seafood's suggestion) in the call and in `key`.
2. Add `'rice noodles': { add: 'grain' }` and `'rice sticks': '=rice noodles'` to the map (the same lines
   o-pork-seafood proposed). `'beef bones'` is already in my map entries, and `'star anise'` was already pre-reviewed.
3. `npm run import:catalog -- "rice noodles" "beef bones" "star anise"`, then append the recipe to
   `basedCooking.ts`.

I checked this in a scratch copy of my worktree: `npm run check` passes with 220 recipes, 281 ingredients and 387
tests, and the file stays Prettier-clean. Provenance: created by its author in PR #455 (2021-03-23). The only links
in its history are to the author's own site. A web search of its spice list and wording found only based.cooking
mirrors.

## Edits worth knowing (for the culinary reviewer)

Based Cooking:
- **Hoisin Pork Belly:** the source lists sesame oil but never uses it, so it's stirred in off the heat at the end.
  The green onion is now an optional garnish and the rice an optional serve-with. Pan size and timings are mine.
- **Pasta al Fumè:** scaled from 2 to 4 servings. Pestanzul's "tomato sauce" is read as Italian passata
  (`tomato_puree`). The amounts of oil, onion and paprika are mine. Parsley is an optional garnish.
- **Apricot Jam Crostata:** the crostata page's crust is a link to the same author's `shortcrust-pastry` page, so
  that recipe is written in, as bc5 did with chimichanga's taco meat. Origin stays `crostata`. "Jam or marmalade"
  became apricot jam (`apricot jam`, a flavor-specific key like o-baking's `raspberry jam`). The 11-inch (28 cm)
  pan, the 1/3-inch (8 mm) thickness and the chilling are mine. 180 °C became 350°F (180°C). The source's dough is
  generous, so the crust is thick and crumbly, as the author intends.
- **Lemon Granita:** the wording is tightened, and the freezing time (15 hours) is counted in prep.
- **French Crêpes:** I chose butter from the source's "butter or 3 tbsp oil". The pan size, 1/4 cup of batter per
  crêpe and the cooking times are mine. It serves 5, from 15 crêpes.
- **Quick Apple Strudel:** the source gives quantities only for the jam. The pastry (one sheet), cinnamon and
  crumbs are mine. I chose breadcrumbs from "breadcrumbs / crushed cookies". The optional butter is now required,
  because it bakes inside. 180°C (360°F) became 350°F (180°C). Powdered sugar is an optional garnish.
- **Potato Gnocchi with Sage Butter:** the source has no quantities, so all of them are mine. I dropped the "smashed
  tomato" and "oregano or thyme" options. The steps say "dumplings" and "cooking water", never "gnocchi" or
  "pasta water". o-vegetarian registered a `gnocchi` catalog item (store-bought), and the step checker would read
  "gnocchi" in a step as an unlisted ingredient once that merges.
- **Kalderetang Manok:** the source gives no amounts for the tomato sauce, bell pepper, peas, liver spread, fish
  sauce or cheese, so those are mine. "Dried peas" is read as frozen green peas (it's added a minute before
  serving). "Grated cheese" became cheddar, the usual Filipino choice, and it is required, which fills chicken +
  cheddar. The source's "2 tablespoons of salt" became 1/2 tsp (the fish sauce is salty). The optional tomato is
  now required, because it cooks in the base. 1 lb of chicken became 1 1/2 lb of boneless thighs for 5, and the
  water went from 3 cups to 2 so the sauce thickens. Liver spread (the canned Filipino kind, e.g. 3-oz cans) is a
  new catalog item. It's sold in Asian groceries and online. Drop the recipe if you think that's too hard to find.
- **Schinkenfleckerl:** halved (1 kg ham → 1 lb; 1 kg cooked noodles → 8 oz dry pasta) and served to 6. The
  source's 2 hours at 160°C became 40 minutes at 350°F (175°C), plus 10 minutes under cheese. The cheese topping was
  optional, but the dish is "überbacken" (gratinated), so mozzarella is required. Parmesan and chili flakes are
  serve-withs.
- **Ragù Napoletano:** scaled from 10–12 to 8 servings (3 cans of San Marzanos). I dropped the fresh-tomato and
  food-mill path. Its **pork tenderloin became pork shoulder**, because tenderloin turns dry and stringy over 4
  hours. The meatballs use 1 lb beef plus 1/2 lb pork (the source: "1–2 lb beef, veal and pork"). "Red pepper" is
  read as Italian-American crushed red pepper. I set amounts inside the source's ranges.
- **Swiss Cheese Fondue:** the source lists kirsch but never adds it, so it's stirred in at the end. The cheese is
  tossed with the cornstarch ("starch flour"), and the wine is warmed first so the cheese can go in gradually; the
  source melted everything together. "Swiss cheese (Gruyère and Emmentaler)" became two lines: `gruyere` and
  `swiss_cheese` (o-soups-salads' key) shown as "Emmentaler or other Swiss cheese".
- **Whipped Butternut Squash with Blue Cheese:** the source gives no roasting temperature, so it's 400°F (200°C).
  The 4 oz of blue cheese is my amount. "St. Augur" (a brand) became "creamy blue cheese, such as St Agur". Chives
  are an optional garnish.
- **Merchant's Buckwheat with Pork:** doubled to 4 servings. The source's 6–8 tbsp of tomato paste per 2 servings
  became 1/4 cup for 4. "Pork meat" became pork shoulder, cut into 1/2-inch pieces so it's tender in the simmer
  time. I dropped the optional chili powder. The amounts of flour, turmeric and parsley are mine.
- **Okonomiyaki:** doubled to 2 servings. For the meat I chose bacon, one of the source's own options. I dropped
  the dashi powder, katsuobushi and nori. Tonkatsu sauce and mayonnaise are required, since they make the dish, and
  sriracha is optional. The source's 2–3 minutes per side became 4–5 at medium so the thick center cooks.
- **Baba's Feta Pasta:** the vague amounts are converted ("3/4 bowl" fusilli → 8 oz; "1/2 block" feta → 4 oz; "3/4
  mug" of water → 3/4 cup; "1/3 mug" of milk → 1/3 cup). I dropped the optional sugar and parsley. Mixed spice
  stays, because it's the author's signature. It's a new catalog item (the British sweet spice blend), which US
  cooks may have to buy online or mix themselves.
- **Baked Potato Soup:** the source has no amounts ("10+ potatoes, a stick or two of butter, half a gallon of
  milk"), so all of them are mine, for 6 servings. The optional cheese is now required sharp cheddar, because it
  melts into the soup. The garlic is softened in the butter first. 450° became 450°F (230°C).
- **Bitoque:** all amounts are mine. Doneness is 145°F (63°C). Margarine is dropped. Rice is an optional
  serve-with.

NHLBI (the lower-sodium choices are kept: low-sodium broth, reduced-sodium soy sauce, reduced-fat mayonnaise,
small amounts of salt):
- **Asparagus:** 1/16 tsp salt became "1 small pinch". The step names "dried parsley", because "parsley" alone
  reads as the fresh herb.
- **Roasted Beets:** the optional anise seeds are now a sprinkle on top (a garnish), not stirred into the juice.
- **Cornflake-Crusted Baked Fish:** "fish fillets" became cod or other firm white fish (`cod`), the same choice
  bc6 made. **I dropped the 2 drops of hot sauce**: a `hot_sauce` catalog item breaks the Chicken Paprikash
  step check in this worktree (nhlbi2's note). If the merged catalog has `hot_sauce` and that step has been
  reworded, you can restore `r('hot_sauce', 'hot sauce', '2 drops')`. The bake is now 15–20 minutes to 145°F
  (63°C). 475 °F became 475°F (245°C).
- **Lentil and Vegetable Soup:** 11 one-cup servings became 8. I added 1/2 tsp salt; the source has none.
- **Green Chile Chicken Stew:** 10 half-cup servings of 3 lb chicken became 6. "Green chilies, roasted, peeled"
  became Anaheim or New Mexico chiles (a new `anaheim_pepper`; the catalog's `green_chili` is the slim Thai or
  serrano kind), with a broil-and-peel step. I added 1/2 tsp salt. Cooking spray became "vegetable oil or cooking
  spray".
- **Rainbow Fruit Salad:** the bananas go in last so they don't brown. Unsweetened orange juice became fresh juice
  (`orange`, like nhlbi2's mapping).
- **Fresh Lumpia:** the source strains 1 cup of broth for the sauce from a filling that only got 1/2 cup, so the
  broth is now 1 1/2 cups, divided. "Ground chicken breast or lean pork" became ground pork. "Vietnamese
  spring-roll wrappers or lumpia wrappers" became rice paper wrappers. Pork doneness is 160°F (71°C).

## Provenance

### Based Cooking: every imported page, plus the inlined shortcrust page
For each page I ran three checks: a grep of the snapshot (the brief's pattern), a grep of its full history in
`research/based-luke` (`log --all -p -- '*/<key>.md'`), and a web search of one or two distinctive sentences. The
web searches found only based.cooking mirrors (git.pikami.org, git.blob42.xyz, clearleaf.flounder.online,
git.rogs.me) or unrelated recipes. **None of these pages came in through `97e5806`.**
- **hoisin-pork-belly:** a 2021 user submission (`0390ac4`). The history is clean.
- **fume-sauce, crostata, shortcrust-pastry, granita:** these came in through `0694559`, and their history in
  `pdr-codeberg` is pestanzul's own commits ("Add fumé sauce", "Add crostata", "Add shortcrust pastry", "Add
  granita", plus tidy-ups). No credits. Pestanzul is the author of the already-imported tiramisu.
- **french-crepes:** Aeredren created it (`771c217`). Its only link is to the author's GitHub.
- **apple-strudel:** Lorenzo Iuri created it (`15f2e2e`). `0694559` touched it. The `pdr-codeberg` history shows
  only the same based.cooking commits plus an image cleanup.
- **gnocchi:** Luke Smith wrote it himself (`a80dd95`). The only links are to his own site, plus a Wikipedia link
  in a commit message about naming Parmigiano.
- **kalderetang-manok:** Jess Calape created it (`bcc7eb7`). Its only link is to the author's Twitter. Other
  kaldereta recipes on the web use different wording.
- **schinkenfleckerl-gratinated:** Martin Stohanzl created it (`e19b5f4`). Its only links are to his own website
  and YouTube channel.
- **ragu-napoletano:** added by mfed3 in a multi-recipe PR (`9dab713`) as "my family's version". `0694559`
  touched it, and its `pdr-codeberg` history is clean. I found no web match. (mfed3's mapo tofu and ravioli are
  separate pages and not used.)
- **fondue:** sekthor created it (`31e8579`). Its only links are to the author's own GitHub and contact page. The
  method is the standard Swiss one, and I found no wording match.
- **savory-squash:** Joe Powerhouse (`aa9ce68`). The history is clean.
- **merchants-buckwheat:** in "A bunch of recipes from my personal site" (`c7e32cb`), Yaroslav de la Peña Smirnov
  wrote "Originally published at yaroslavps.com". That is **the contributor's own site**, the same case as
  refried-beans in bc8. PDR later removed links to personal websites. Nothing else is credited.
- **okonomiyaki:** no author (PR #554). The history is clean, and the web search found no match.
- **babas-feta-pasta:** peepopoggers' credit section says "Original recipe." HelloFresh's "Greek Diner Spaghetti
  with Feta" turned up for the topic, but it's a different dish (spinach, lemon and dill, with no broccoli,
  olives or mushrooms) and none of the wording matches.
- **potato-soup:** Matthew (PR #767, 2022). It came in through `0694559`, and its `pdr-codeberg` history is clean.
- **portuguese-steak-with-beer-sauce:** Artur Mancha (`1ec22a9`). Its only links are to the author's own Pleroma
  account and based.cooking's rice page.

### NHLBI
Every imported page's Recipe Source is an NHLBI publication: Deliciously Healthy Dinners (asparagus, beets),
Heart Healthy Home Cooking African American Style (baked fish), Delicious Heart Healthy Latino Recipes (lentil
soup), Honoring the Gift of Heart Health (chile stew), Stay Young At Heart (fruit salad) and Healthy Heart,
Healthy Family (lumpia). I scanned each page's full text for adapted, copyright, ©, courtesy, reprint, permission,
inspired, original, restaurant, chef, magazine and cookbook and found no hits. No NHLBI exclusions. The taglines
are new and don't say "heart-healthy".

### Exclusions (`excludes.txt`)
- **no-knead-pizza-dough** and **pan-pizza** (brox): the dough is Serious Eats' "Foolproof Pan Pizza" (Kenji
  López-Alt) halved: 200 g flour, 5 g salt, 2 g instant yeast, about 5 g oil and 140 g water, against 400/10/4/8/275.
  It has the same 8–24-hour room-temperature rise, and the pan page follows the same cast-iron method. The
  wording differs, but the formula and method are the published recipe's. This was the best pizza candidate in the
  pool, so the library still has no plain pizza.
- **shakshouka:** its headnote is the opening sentence of Wikipedia's Shakshouka article (CC BY-SA), copied without
  credit. The page is also near Menemen and has no quantities.

### Doubtful, not confirmed (skipped, not listed as exclusions)
- **salsa-verde:** the method and wording ("until tomatillos turn pale green, about 10 minutes", "hot but not
  smoking", 6–8 minutes) track Pati Jinich's cooked salsa verde, but the quantities differ and the wording isn't
  identical.
- **beef-wellington:** its structure follows Gordon Ramsay's widely published method (food-processor duxelles,
  ham laid on plastic wrap, rolled and chilled, then brushed with mustard). It also has a wrong oven temperature
  (302°F labeled "105°C"). I didn't search it further.

## Skipped, and why (pool triage)

Based Cooking (225 pages):
- **Drinks:** assam-tea, ayran, bloody-mary-mix, blueberry-smoothie, coconut-oil-coffee, gluehwein, indian-tea,
  irish-coffee, italian-mulled-wine, kombucha, kvass, limoncello, manhattan, milus-fast-kvass, oat-milk,
  orange-glorious, original-gatorade, party-mimosa, sunday-milkshake, tanzania-tea-with-milk and strawberry-compote.
- **Components, sauces, doughs, breads and basics:** brown-sauce, burger-dressing, classic-bechamel-sauce,
  curry-sauce, demi-glace, easy-pizza-sauce, fajita-seasoning, pasta-sauce, pizza-sauce, simple-sauce,
  simple-pasta-cream-sauce, mushroom-sauce, garam-masala, zaatar,
  ketchup, mayonnaise-or-aioli, spicy-mayo, russian-1000-islands-sauce, pepper-sauce, lemon-juice-salad-dressing,
  pickled-onions, sauerkraut, soleier, jam, orange-jam, belgian-pear-syrup, dulce-de-leche, dried-tomato-plum-spread,
  peanut-butter, cheese, cream-cheese, greek-yogurt, ricotta, ricotta-lasagna-filling, yogurt, eggs, rice, pasta,
  oats, cooked-chickpeas, corn-polenta, croutons, chicken-stock-bone-broth, puff-pastry, pizza-dough,
  wholemeal-wheat-flour-pizza-dough, wholemeal-pizza, bread, italian-bread, no-knead-bread, challah-bread,
  sourdough-*, zopf, pretzels (they need lye), naan-bread (the method is broken), bolo-do-caco (a 3-day ferment with 3
  tbsp of yeast), damper, cuca-italiana, coconut-flour-bread, butter-based-biscuit, butter-biscuits,
  shortcrust-pastry-biscuits, tahini-short-bread and country-crisp-cereals.
- **Duplicates of the library or a dish on ORIGINALS.md:** aglio-e-olio, chocolate-chip-cookies, lasagna, caesar-salad,
  basic-waffles, chicken-wings, rice-pudding, garlic-toast, schnitzel (Pork Schnitzel), baby-back-ribs (Oven-Baked
  BBQ Ribs), bolognese-sauce, baked-mostaccioli (Baked Ziti), chicken-soup, chili-con-carne,
  pork-based-chili-con-carne, carbonade, guacamole, hamburger-patties, overnight-oats, popcorn, potato-pure,
  quesadilla, tuna-salad, seafood-pasta, beijinho, onion-raitha (Tzatziki), oatmeal-pancakes, oaty-pancakes,
  pancake, two-ingredient-pancakes, and **butter-cake** (it's next to Pound Cake and Victoria Sponge on
  o-baking's list, and its history starts in a PDR maintainer batch with nothing to trace).
- **Food safety:** beef-jerky (dried at 145–150°F without first heating the meat to 160°F), roasted-chicken-breast
  (it pulls the chicken at 155°F and links a Reddit thread about cooking chicken below 165°F), steak-tartare (raw
  beef) and ceviche (raw seafood, no quantities).
- **Hard to find, special equipment or niche:** mapo-tofu, paneer-tikka-masala (many vague amounts, plus
  skewers), cochinita-pibil (achiote paste and banana leaves; a good reserve), bebek-mropol, honey-vanilla-ice-cream,
  smoked-turkey, collard-greens-with-smoked-duck, pulpo-gallega, lobster-bisque, pulled-rabbit, rabbit-onions,
  broiled-venison-steaks, broiled-trevally, fried-anglerfish-fillet, grilled-mackerel, beef-kidney, liverpate,
  korv-stroganoff, francesinha, almeirim-stone-soup, aljotta, dou-sha-bao, greek-easter-cookies,
  quarkbaellchen, matcha-cookies, sugar-free cookies, gooseberry-pudding, plum-pudding (suet), spiced-cantaloupe,
  casio-in-pastelletto and fritatem-pomeranciis (medieval), okroshka (kvass), instant-tom-yam (instant noodles) and
  japanese-noodle-soup ("inspired by other recipes").
- **Too thin or broken:** apple-chicken, hellfire-steak, tortellini, quickbreakfastspaghetti, hangover-eggs,
  long-cooked-chuck-steak, oven-asado, pozharskiye-cutlets, pan-seared-chicken, baked-salmon (also close to two
  library salmon recipes), baked-trout (thin, and added in a PDR maintainer batch with no traceable origin),
  fried-potatoes, lenten-lentil-curry (no fat or aromatics), hearty-breakfast-oatmeal (protein powder), castagnole
  (no flour or yeast amounts), lavacake, omelet (a tapioca soufflé), sausage-rolls (thin; by the contributor bc5
  flagged), torta-frita-criolla and grostoli (cachaça).
- **Good reserves for a later round** (clean, just lower priority): galinha-caipira (very bare: chicken, onion,
  chives, lard and water), cinque-pi (a cream-and-tomato pasta close to o-vegetarian's Penne alla Vodka), red-sauce
  (an all-day beef and salt-pork sauce, close to my ragù), spaghetti-sauce (a big-batch garlic marinara),
  breton-crepes (galettes; it needs buckwheat flour), spiced-apple-pancakes, swedish-pancakes, danish-pancake,
  beef-liver-and-onions (thin, but a classic), zarangollo and lemon-pudding (Miss Leslie, 1832).

NHLBI (25 pages). I agree with nhlbi2's reasons for the rest:
- **Near-duplicates:** wiki-fast-rice, new-orleans-red-beans, pinto-beans, tuscan-beans-tomatoes-and-oregano,
  garden-potato-salad and flavorful-green-beans.
- **Drinks or too thin:** mango-shake, summer-breeze-smoothie, grapesicles and alaska-salmon-salad.
- **vietnamese-fresh-spring-rolls:** vegetables only, with no dipping sauce. I took the lumpia, which has a sauce.
- **creamy-squash-soup-shredded-apples:** Butternut Squash Soup is on o-soups-salads' list, and this one uses
  frozen purée.
- **autumn-salad:** bottled raspberry vinaigrette. **tropical-fruit-compote:** the fruit salad covers it.
  **zucchini-medley:** microwave only.
- **oven-fried-yucca:** yucca.
- **Reserves:** caribbean-pink-beans (plantains and dried pink beans; 16 servings) and homemade-turkey-soup (it
  needs a holiday turkey carcass).

## For the integrator
- **Catalog keys shared with other workers** (same key and category; merge as one entry): `grapes`, `blue cheese`,
  `swiss cheese` and `kalamata olives` (o-soups-salads); `buttermilk` (o-breakfast-sides); `peanuts` (o-chicken);
  `puff pastry` (o-beef). The last three are pre-reviewed keys already in the base map.
- **My new keys** (`catalog-keys.txt` lists all 24): asparagus, cornflakes, anaheim pepper, mango, nectarine, kiwi,
  jicama, rice paper, leaf lettuce, scotch bonnet, apricot jam, liver spread, buckwheat, kirsch, mixed spice, tonkatsu
  sauce, plus pork belly (pre-reviewed). Aliases the tool made: asparagus spears, corn flakes, anaheim peppers,
  anaheim chiles, mangos, mangoes, seedless grapes, nectarines, kiwi, rice paper, red leaf lettuce, scotch bonnet,
  buckwheat, dry roasted peanuts. `searchAudit` passes with all of them.
- **`beef bones`** is in my map, but not in my catalog: only the deferred pho uses it.
- **NHLBI cookbooks overlap.** The nhlbi-books worker imports from the same books (Deliciously Healthy Dinners has
  the asparagus and beets), and its brief only checks against `library-titles.txt`, which doesn't include my
  recipes. Dedupe their book recipes against my 7 by dish.
- **`hot_sauce`:** see Baked Fish above. The original's 2 drops can go back once the paprikash step allows it.
- **Optional `GRAMS_PER_CUP` values.** Metric mode shows these in ml today; the units test passes without them.
  cornflakes about 30 (whole flakes), grapes about 150, peanuts about 145, jicama about 130 (strips).
- **Not mine to change, but worth a look:** `tests/import.test.ts` uses `'rice noodles'` as its unreviewed example.
  That blocks both my pho and o-pork-seafood's Pad Thai.

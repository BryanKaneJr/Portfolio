# bc5 handoff: slice 1 (aglio-e-olio … collard-greens-with-smoked-duck-and-parnips)

`npm run check` passes in my worktree: tsc, validation (138 recipes, 212 ingredients) and jest (302 tests; the
count rises from 288 because some tests are per recipe). `basedCooking.ts` is append-only (423 added lines, 0
removed). `ingredients.ts` changed only through `import:draft` / `import:catalog`.

## Imported (14), in file order

| Source key | id | Title | Gap it fills |
|---|---|---|---|
| arroz-chaufa | arroz-chaufa | Arroz Chaufa (Peruvian Chicken Fried Rice) | **rice**: chicken+rice, rice+bell pepper, rice+eggs; bowl |
| ardei-umpluti | ardei-umpluti | Ardei Umpluți (Romanian Stuffed Peppers) | **rice**: ground beef+rice, rice+bell pepper; bell pepper main |
| chicken-tomato-spinach-curry | chicken-tomato-spinach-curry | Chicken, Tomato and Spinach Curry | **spinach main**: chicken+spinach, spinach+tomato |
| baked-pasta-with-broccoli | baked-pasta-with-broccoli-eggs-and-scamorza | Baked Pasta with Broccoli, Eggs and Scamorza | **broccoli main**: broccoli+eggs, broccoli+pasta |
| chicken-tacos | slow-cooker-chicken-tacos | Slow-Cooker Chicken Tacos | **sandwiches and wraps** |
| chimichanga | beef-chimichangas | Beef Chimichangas | **wraps**; ground beef + bell pepper + cheddar + tomato |
| brigadeiro | brigadeiros | Brigadeiros (Brazilian Fudge Balls) | **dessert** (no dish type fits) |
| banana-muffins-with-chocolate | banana-chocolate-chunk-muffins | Banana Chocolate Chunk Muffins | **dessert**, breakfast, baked goods |
| bread-pudding | old-fashioned-bread-pudding | Old-Fashioned Bread Pudding | **dessert**, bake |
| chocolate_cake | chocolate-cake | Chocolate Cake | **dessert**, baked goods |
| bolinhos-de-coco | bolinhos-de-coco | Bolinhos de Coco (Coconut Cakes) | **dessert**, snack, baked goods |
| beef-stew | irish-beef-stew | Irish Beef Stew | beef+potato one-pot dinner |
| chipolata-in-balsamic-vinegar | chipolata-sausages-in-balsamic-vinegar | Chipolata Sausages in Balsamic Vinegar | sausage+tomato traybake (bake) |
| chicken-satay | chicken-satay-with-peanut-sauce | Chicken Satay with Peanut Sauce | **appetizer** (no dish type fits) |

My slice has **no black-bean page**. The only bean pages are chili-con-carne, a near-duplicate of Beef & Bean
Chili with no quantities, and chorizo-and-chickpea-soup, which is excluded.

## Edits worth knowing about
- **ardei-umpluti: rice added.** The page says "Farcies peppers with rice", but its list has no rice. Traditional
  ardei umpluți are filled with meat and rice, so I treated it as a missing ingredient (1 1/2 cups cooked rice).
  Caveat: the first version of that sentence read "Farcies tomates with rice". It was likely pasted from the same
  author's tomatoes page and changed to "peppers" in commit 0694559. I also replaced the source's timings
  (1 h 30 covered, then 45 min more) with 15 min to soften the peppers plus 30–35 min stuffed. Garlic, used in a step,
  is now listed. The optional béchamel is gone; sour cream remains as a serve-with.
- **chimichanga:** the source's filling is a link to `/taco-meat`. I inlined the seasoning from the library's own
  Taco Meat (same page). Cheese was "optional" in the source; it goes inside the wrap, so it is now a required
  cheddar. I chose Greek yogurt over sour cream and made skillet frying the main method, with the air fryer as an
  alternative.
- **chicken-satay:** the source's peanut sauce (3 tbsp peanut butter for 2 lb chicken) is too little to dip, so I
  doubled it. Massaman curry paste is jarred and sold in UK supermarkets, US Asian markets and online. Drop this
  recipe if you think that's too hard to find.
- **beef-stew:** I chose beef chuck over lamb shoulder and beef broth over chicken stock. I dropped the optional
  stout, because optional is for garnishes only, and used the source's potato method to thicken.
- **chocolate_cake:** the source's cup conversions were wrong. I fixed them: 150 g butter is 2/3 cup, 300 g sugar is
  1 1/2 cups, 100 g cocoa is about 1 cup. I also added the pan size.
- **bolinhos-de-coco:** the source gives no oven temperature, so I added 350°F (180°C) and 12–15 min.
- **banana-muffins:** dropped the optional vanilla sugar. **bread-pudding:** dropped the optional rosewater and added
  a temperature, a time and a doneness test. **chicken-tacos:** cheese, tomato and cilantro are optional toppings;
  lettuce is dropped.

## Provenance
I checked every imported page three ways: a grep of the snapshot, a grep of its full `git log --follow -p` history in
the clone (patches and commit messages), and a web search of one or two distinctive sentences. Every match was a
based.cooking mirror (git.pikami.org, git.blob42.xyz, clearleaf.flounder.online).
- **bread-pudding** is "Miss Leslie", from Eliza Leslie's 1832 book. That text is public domain by age, and
  `docs/recipe-sources.md` already says so. A web search turned up only mirrors.
- **Commit 0694559 (2026-08-28, "add publicdomainrecipes.com recipes")** added these slice pages wholesale:
  baked-rice, baked-trout, basic-waffles, batter-pudding, bebek-mropol, beef-liver-and-onions, bread-pudding,
  broiled-venison-steaks, butter-biscuits, butter-cake, casio-in-pastelletto, castagnole, cinnamon-waffles,
  cocoanut-pudding. Their earlier history lives in the publicdomainrecipes repo, so the based.cooking clone can't
  show removed credits for them. Of those I imported only bread-pudding, which the 1832 source covers anyway.
  That same commit dropped beef-goulash's "Originally published at" line.
- Exclusions with reasons are in `excludes.txt`: cheesy-potatoe-bake (taste.com.au), chorizo-and-chickpea-soup
  (BBC Good Food), basic-meatballs (blogs plus The Food Lab), butter-chicken-masala (Food.com wording),
  beef-goulash (dropped self-credit, doubtful) and cinnamon-waffles ("Pennsylvania Dutch Cooking" author, as with
  sand-tarts).
- challah-bread is by siggines, the contributor whose chorizo page credited BBC Good Food. I did not import it or
  web-check it.

## Promising pages I skipped
- **cinque-pi**: clean history and a nice quick cream-and-tomato pasta, but pasta isn't a gap. Good for a later batch.
- **apple-strudel**: clean history. It needs puff pastry plus apricot jam, which would be a new catalog entry.
- **butter-cake**: reads well, but it arrived through the publicdomainrecipes commit, so I couldn't check its history.
- **baked-rice** (Valencian arroz al horno): a rice dish, but it relies on morcilla blood sausage and bomba rice,
  which are hard to find. Same commit caveat as above.
- **beijinho**: too close to brigadeiro. **carbonade**: duplicates Flemish Beef and Beer Stew. **chicken-soup**:
  near-duplicate of Chicken Noodle Soup. **aglio-e-olio**: duplicate.
- **caesar-salad**: bottled dressing and croutons, too thin. **babas-feta-pasta**: vague amounts ("3/4 bowls")
  and British mixed spice. **apple-chicken**: vague. **chicken-wings**: brand products and an oven bag.
  **baby-back-ribs**: needs a smoker. **collard-greens…**: needs smoked duck breast. **cochinita-pibil**: needs
  achiote. **aljotta**: no amounts and a from-scratch fish stock.

## For the integrator
- New catalog entries (keys in `catalog-keys.txt`): scamorza (dairy), adobo seasoning (spice), condensed milk,
  dark chocolate, milk chocolate, oyster sauce, massaman curry paste, shredded coconut, chocolate sprinkles (all
  pantry), cinnamon sticks (spice). Condensed milk, dark chocolate, oyster sauce and cinnamon sticks were already
  reviewed `{ add }` keys. searchAudit passes with all of them.
- Map notes: 'red chilies' / 'ground tumeric' point straight at the existing IDs instead of using '=key', so no
  alias drifts from the catalog. Six new `null` entries: sprinkles, coconut, bechamel, taco meat, and three "X or Y"
  lines.
- `GRAMS_PER_CUP` (optional, nothing fails without them): chocolate_sprinkles about 190 g/cup (opt line now shows
  "120 ml"), shredded_coconut about 85 g/cup (my line gives its own metric).
- Library recipes my imports also use, already in the base catalog: chuck_roast, beef_broth, rosemary, bay_leaf,
  red_chili, tomato_sauce, brewed_coffee, cocoa_powder, nutmeg, turmeric, sage, powdered_sugar.

# bc6 handoff: slice 2 (cooked-chickpeas … lemon-juice-salad-dressing)

`npm run check` passes in the worktree: 139 recipes, 221 ingredients, 9 suites, 303 tests. That is the base 124 recipes
and 202 ingredients plus my 15 recipes and 19 catalog entries.

## Imported (source key → id: title, and the gap it fills)

| Source key | id | Title | Gap filled |
|---|---|---|---|
| lamb-biriyani | lamb-biryani | Lamb Biryani | **Rice** (required: basmati cooked in the pot); one_pot |
| frijol-con-puerco | frijol-con-puerco | Frijol con Puerco (Black Beans with Pork) | **Black beans**, beans with pork, avocado, lime; one_pot |
| full-english-breakfast | full-english-breakfast | Full English Breakfast | Beans with eggs, tomato, sausage, bacon, mushrooms (uses canned baked beans, a new ID, not black_beans) |
| fennel-beans-and-kale-soup | fennel-white-bean-and-kale-soup | Fennel, White Bean and Kale Soup | Beans in a **soup** (cannellini) |
| herbs-pizza | spinach-and-ricotta-pie | Spinach and Ricotta Pie | **Spinach** in a main; bake |
| frittata | bell-pepper-and-cheddar-frittata | Bell Pepper and Cheddar Frittata | **Bell pepper with cheddar** (cheddar is required; the source said "cheese of choice") |
| dominican-spaghetti | dominican-spaghetti | Dominican Spaghetti | Bell pepper with tomato sauce; pasta |
| fish-curry | coconut-fish-curry-with-green-beans | Coconut Fish Curry with Green Beans | Fish main with green beans and tomato; one_pot |
| coriander-chicken | coriander-chicken | Coriander Chicken | Chicken main (cilantro, yogurt); skillet |
| guobaorou | guobaorou | Guobaorou (Crispy Sweet-and-Sour Pork) | Pork main with carrot; skillet |
| ginataang-kalabasa | ginataang-kalabasa | Ginataang Kalabasa (Squash in Coconut Milk) | Vegetarian main or side; one_pot |
| creme-brulee | creme-brulee | Crème Brûlée | **Dessert**; bake |
| homemade-ice-cream | no-churn-blueberry-ice-cream | No-Churn Blueberry Ice Cream | **Dessert** (no dish type fits, so `dishTypes: []`) |
| grands-peres | grands-peres | Grands-Pères (Maple Syrup Dumplings) | **Dessert**; one_pot |
| granola | maple-cardamom-granola | Maple Cardamom Granola | Breakfast or snack; bake |

Every new recipe except the ice cream has a dish type.

**Rice is still thin.** Only the biryani *requires* rice. Seven other pages in my slice say "serve with rice"
(coriander chicken, fish curry, guobaorou, ginataang kalabasa, korv stroganoff, hoisin pork belly, kalderetang manok).
Following the existing imports, rice is `opt(...)` in those, so it doesn't count toward the gap.

## Provenance checks
Each of the 15 imports was checked three ways:
- the snapshot page, with the brief's grep;
- the full history in based-luke (`log --all -p -- '*/<key>.md'`, because pages from before the 2022 Hugo move lived at
  `src/<key>.md`; `--follow` on `content/` misses them);
- one or two distinctive sentences or quantity sets searched on the web.

The five pages that commit 0694559 touched (creme-brulee, herbs-pizza, guobaorou, granola, fennel-beans-and-kale-soup)
were also grepped through their full history in the pdr-codeberg clone. Nothing turned up there: no credits, links or
removed lines. A few things to know:
- **creme-brulee** entered PDR in a batch commit by its maintainer ("Ronald L: Added 3 recipes", Dec 2023), crediting
  "jan-kremer" with a 2023-04-11 date. Its history can't be traced further back. The web searches (English and German
  quantities, and the "grease pan" sentence) found no match.
- **fennel-beans-and-kale-soup**: the ingredient list looks scaled up (every amount is even: 4 cans, 4 cups,
  4 tsp, 10 cloves, 6 tbsp), so I searched halved and full quantity sets and the key sentences. I found no source other
  than mirrors. It's kept, but it's the import I'm least sure of. Drop it if you want zero doubt.
- **frijol-con-puerco** reads like a translation ("Put out the fire"). Spanish searches turned up no matching quantities
  (Saveur and Campeche versions differ).
- **lamb-biriyani**: "adapted to a more western audience" refers to the author's own toning-down. The only links are the
  author's GitHub and based.cooking.
- **japanese-noodle-soup** (not imported) says "my own spin inspired by other recipes that I found". No specific original
  is named, but I skipped it anyway (see below).

Excluded, with reasons in `excludes.txt`: lebanese-lentil-soup (Blue Zones), kropsua (published Kropsu recipe),
kaiserschmarrn (suspected gutekueche.at translation).

## Edits worth knowing
- **fish-curry**: the source lists "1 red pepper" and later adds the "pepper (whole)". The author is Dutch, and *rode peper*
  means red chili, so it's `red_chili` (whole, pierced), not a bell pepper. The green beans now simmer in the curry
  instead of in a separate pot. "White fish" became `cod` ("cod or other firm white fish fillets").
- **frijol-con-puerco**: the recipe is halved (500 g beans and 1 kg pork in 3 L water, serves 6). The source's "lemons" are
  Mexican *limones*, so they became limes. Epazote is mentioned in a step as an alternative to the cilantro bundle. Pork:
  the source said "loin or ribs", so it's `pork_loin` with a note that ribs work.
- **lamb-biriyani**: the source's 3 tbsp salt was far too much for liquid that the rice absorbs, so it's now
  2 1/2 tsp, divided. The water is made up to 800 ml before the rice goes in, as the source's 1:2 rule says. "Chilli powder or
  Hungarian smoked paprika" became paprika (smoked paprika is a `paprika` alias).
- **herbs-pizza**: the source's "15 g brewer's yeast" is Italian *lievito di birra* (fresh baker's yeast), converted to
  2 tsp active dry. "Boiled herbs (spinach, chicory…)" became 2 lb fresh spinach, blanched. I mapped "brewer's yeast" by hand
  rather than in the map, because in English it usually means the nutritional supplement.
- **full-english-breakfast**: the source's oven was 480°F for 30 minutes. It's now 400°F (200°C) with 160°F (71°C)
  doneness. Mushrooms and tomato now cook before the eggs, so the eggs don't sit in the pan and overcook.
- **dominican-spaghetti**: the source had 1 tbsp sazón plus 1 tbsp bouillon. That's now 2 tsp sazón and 1 cube, since the
  original would be very salty.

## Promising pages skipped (not for provenance)
- hoisin-pork-belly, kalderetang-manok, galinha-caipira: fine dishes, but less of a gap than the ones I picked.
  kalderetang-manok also needs Filipino liver spread (hard to find) and has six lines with no quantity. Good reserves:
  hoisin-pork-belly and galinha-caipira are clean on history and web.
- korv-stroganoff: needs Swedish falukorv (hard to find outside Sweden; any other sausage would be a substitution).
- japanese-noodle-soup: vague quantities. It says "inspired by other recipes".
- lavacake: unworkable as written (mix cold chocolate, butter, egg and flour; no sugar).
- french-crepes, danish-pancake: thin pancakes. They're possible, but lower priority than the gaps.
- fondue (needs kirsch and a fondue set), honey-vanilla-ice-cream (ice cream maker), dou-sha-bao (steamer, azuki),
  greek-easter-cookies (baker's ammonia), fried-anglerfish-fillet (whole anglerfish), grilled-mackerel (sake, miso),
  francesinha (linguiça, port, vague).
- Bare components or too thin: cooked-chickpeas, corn-polenta, curry-sauce, demi-glace, easy-pizza-sauce,
  fajita-seasoning, fume-sauce, garam-masala, ketchup, lemon-juice-salad-dressing, cream-cheese, greek-yogurt, eggs,
  jam, crostata (needs a separate pastry page), fried-potatoes, gnocchi, garlic-toast, hellfire-steak, hangover-eggs.
- Drinks: gluehwein, indian-tea, irish-coffee, italian-mulled-wine, kombucha, kvass.
- guacamole (duplicate of Simple Guacamole); hamburger-patties is already imported.

## For the integrator
- **Frying-oil temperatures render as oven temperatures.** `displayStep` in `src/logic/units.ts` treats any °F ≥ 250 as
  an oven unless the sentence says "air fryer", so "heat the oil to 350°F (175°C)" would show "175°C (155°C fan,
  gas 4)". For that reason, Guobaorou gives a visual cue ("until a drop of batter sizzles at once and floats up")
  instead of a number. It's worth a units.ts fix (skip fan/gas when the sentence mentions oil or frying). After that,
  the step could say 350°F (175°C).
- **`GRAMS_PER_CUP`**: nothing is required, because I gave metric in parentheses wherever a solid is measured in cups.
  If you want cup conversions for the new IDs: ricotta 250, almonds 140 (whole or chopped), dried_cranberries 120–140,
  cornstarch 125–128, baked_beans 260.
- **Catalog keys other workers may also add**: green chili, pork loin, kale, fennel, baked beans, corn tortillas,
  almonds, cod, butternut squash, chicken bouillon. My map lines are in `map-entries.ts.txt`. Variants I added:
  green chilli/chilies/chillies, fennel bulb(s), corn tortilla, boneless lamb shoulder, boneless pork loin, fish broth,
  turmeric powder, the misspelling tumeric powder, and fat free yogurt/yoghurt. If another worker reviewed the same key
  with a different category or name, prefer one entry. I chose `baked beans` → pantry (canned goods) and
  `corn tortillas` → grain.
- `'ground cardamom'` is a separate `{ add: 'spice' }` from `cardamom` (pods), matching the whole/ground cloves split.
- No test was edited. searchAudit passes with all 19 new catalog entries.

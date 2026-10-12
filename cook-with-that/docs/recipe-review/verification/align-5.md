# al5: 13 recipes moved onto the published amounts

All 13 now score 5. Checks: typecheck, validator and jest (`-w 2`) pass, 874 tests. `npm run audit:recipes`
added no new flags for these recipes. The only change in the audit is a number in the existing
`jamaican-rice-and-peas` liquid flag: it went from 0.75 to 1, because the audit can't read the coconut-milk can or the bean liquid.
`docs/recipe-audit.md` was restored. None of these recipes had a `rework` entry. Full sources and medians are in `verdicts.json`.

## worldKitchen.ts
- **bobotie**: The bake is now 50–55 min instead of 30–35 (cookMinutes 65 → 85). The published versions also cook the mince first and
  still bake about an hour at 350°F (median about 55 min). Everything else was already typical. Our 1/2 cup raisins stay.
- **chicken-biryani**: Chicken goes from 2 1/2 lb to 2 lb, which is about 1/3 lb per serving with 2 cups basmati. Rice-boiling water goes from 3 qt to 2 qt
  (about 4 cups per cup of rice), with 1 1/4 tbsp salt in it (total 2 → 1 3/4 tbsp). The parboil, sauce cook and 25-min sealed
  steam were already typical.
- **feijoada**: Pork shoulder goes from 1 1/2 lb to 1 lb (browned in one batch) and kielbasa from 12 oz to 1 lb, the typical amounts per lb of beans. Water goes from 7 to 8
  cups. The first simmer goes from 1 1/2 h to 2 h, for 2 1/2–2 3/4 h in total (published 2 h 20 to 3 h+). cookMinutes 165 → 190.
- **gyudon**: Water goes from 1 cup to 1 1/4 cups, standing in for both dashi and sake, which the catalog doesn't have (water is the usual published
  stand-in). Sugar goes from 1 to 1 1/2 tbsp, and the onions from 2 medium to 1 large (the onion simmer is now 5–6 min). Soy, mirin and the beef time were already typical.
- **jamaican-rice-and-peas**: Total liquid goes from 3 3/4 to 4 1/4 cups for 2 cups rice (about 2.1 per cup, the typical value), with water at about 2
  cups. Salt goes from 1 1/4 to 1 1/2 tsp.
- **kuku-sabzi**: Baking powder goes from 1/2 to 1 tsp, and the oven from 350°F to 375°F (190°C), the value most sources use. The eggs-to-herbs ratio, salt, flour and
  bake time were already in range or typical and are kept.
- **pad-kra-pao**: Soy goes from 1 to 3 tbsp, oyster sauce from 3 to 2 tbsp, and water from 3 tbsp to 1/3 cup (the reduction is now 2–3 min). Fish sauce and sugar
  were already typical. Total seasoning is now the six-source median, about 4 1/3 tbsp per lb.

## world.ts
- **arroz-con-pollo**: Broth goes from 2 1/2 to 3 cups, so the liquid with the tomato sauce is 2 to 1, the typical value for long-grain rice on the stovetop
  (Goya, VICE). Cook time, rest, chicken and seasoning were already typical.
- **chicken-pad-see-ew**: Chicken goes from 12 to 8 oz and oyster sauce from 2 to 1 tbsp (the typical amounts per 8 oz dried noodles). The marinade soy goes from 2 to 1 tsp.
  Our dark soy (2 tbsp) and sugar (1 tbsp) are kept.
- **jollof-rice**: Broth goes from 3 to 2 1/2 cups and oil from 1/3 to 1/4 cup, and the covered cook from 30 to 35 min (cookMinutes 75 → 80). Published stock is about 1.0 per cup of rice,
  or about 2.0–2.2 per cup counting the tomato base. 2 1/2 cups is about 2.1 by the second measure. It is the lowest amount that stays inside the audit's 1.2 minimum
  for rice.

## soupsSaladsSandwiches.ts
- **broccoli-salad-bacon-cheddar**: Sugar goes from 1 to 2 tbsp. That is the typical amount for 3/4 cup mayo, and published salads keep it even with dried fruit. The dressing now
  equals ATK's three numbers. The salad itself differs from ATK's in broccoli weight, raw broccoli, fruit and seeds.
- **cream-of-mushroom-soup**: Mushrooms go from 1 1/2 lb to 1 lb for 4 servings, flour from 1/4 cup to 3 tbsp (about 0.8 tbsp per cup of liquid), and salt from 1 1/4
  to 1 tsp. Browning is now 10–12 min. Once Upon a Chef also purées the soup and stirs reserved mushrooms back in, so the method is published.
- **cuban-sandwich**: Ham goes from 8 oz to 1 lb, mustard from 3 tbsp to 1/4 cup, and butter from 3 to 4 tbsp (about 4 oz ham, 1 tbsp mustard and 1 tbsp butter per
  sandwich). The juice goes from 1 orange to 2. The marinade now runs at least 2 h, up to overnight, instead of 30 min to 4 h (prepMinutes 45 → 135). The 425°F roast to 145°F and the 3–4 min per side
  stay. Our 2 pickles and 1 tsp salt are kept.

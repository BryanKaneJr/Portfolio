# rv5-world: paper review of `src/data/originals/worldKitchen.ts`

## Summary
- **Read:** all 20 recipes. I checked ratios, every "divided" and "remaining" amount against the list, pan and pot
  sizes for the quantities, oil depth against oil volume, doneness temperatures, salt (decision 14), optional
  lines, IDs, tags and taglines, and step times against prep and cook minutes. I also checked the four audit flags.
- **Fixed:** 6 recipes, all small changes. No ids, titles, tags or taglines changed, and nothing in the catalog.
- **For the owner:** 4 points. None blocks the release.
- **Result:** the recipes are sound. Every split amount adds up, every temperature is safe, and each deep or shallow
  fry gives a heavy pot or skillet, a thermometer and a heat-off cue. Nothing needs dropping.
- `npm run check` passes: 668 recipes, 399 ingredients, 874 tests. `prettier --check` on the file is clean.
  The edited lines read correctly in metric mode ("1.9–2.8 litres", "2.8–3.8-litre saucepan", "165°C (145°C fan, gas 3)").

## Fixed
- `jamaican-rice-and-peas`: **There wasn't enough liquid to cook the rice** (audit ratio flag, and the writer's
  first cook-test item). The recipe used 3 1/4 cups of liquid for 2 cups of rinsed long-grain rice. About half a cup
  of the 13.5-oz can of coconut milk is fat and solids, so the rice got only about 2 3/4 cups of water, roughly
  1.4 to 1. The rice would likely stay hard on top. → I raised the total to **3 3/4 cups**, which changes the water
  line from "about 1 cup" to "about 1 1/2 cups" and step 1 to match. That gives about 1.6 to 1 in water, the usual
  ratio for rinsed long-grain rice and in line with standard coconut rice. The step also said only "medium
  saucepan". About 7 cups go in (liquid, rice and beans) and coconut milk foams, so a 2-quart pan could boil over.
  → It now says **"heavy 3- to 4-quart saucepan"**.
- `general-tsos-chicken`: **The step and the list disagreed on oil.** The step says "Pour 2 inches of oil into a
  large, heavy pot", but the list gave 6–8 cups. In a standard 5–6 qt Dutch oven, that is only about 1–1.4 inches,
  and a 2-inch depth takes about 11 cups. A cook who bought what the list said would run short. → Changed to
  **"2–3 quarts"**, the amount the library's other 2-inch Dutch-oven fries list (grillFry.ts). The halfway rule and
  the thermometer were already in the step.
- `chicken-biryani`: **The oven option had no preheat step.** The final steaming step offered "bake it covered in a
  325°F (165°C) oven for 30 minutes instead". A cook who chose that option at that point would find the oven cold. →
  Step 5 (steeping the saffron, while the chicken simmers) now adds: "If your pot has a thin bottom that might scorch,
  heat the oven to 325°F (165°C) now." Step 8 ends: "If you heated the oven, bake the covered pot for 30 minutes
  instead." The audit ratio flag (1/4 cup water to 2 cups rice) was a false positive: the rice is parboiled in
  3 quarts of water.
- `patatas-bravas`: **The cook time was about 12 minutes short.** It didn't count bringing 2 lb of potatoes in
  water to a boil (about 12 minutes). It also didn't count the 10-minute steam-dry, heating the oil, or two 8–10
  minute frying batches. The steps add up to about 50–55 minutes. → cookMinutes 40 → **50**.
- `saag-aloo`: **The cook time was about 10 minutes short.** The steps add up to about 45–48 minutes: the parboil
  including the time to boil (about 18), crisping (10–12), onion (5–6), spices and tomato (about 4), spinach added
  in handfuls (about 6) and the final toss (2–3). → cookMinutes 35 → **45**.
- `arroz-caldo`: **The cook time was about 10 minutes short.** The steps add up to about 70 minutes: fried garlic
  (5), onion (5), chicken (4), rice (2), bringing 8 cups to a boil (about 10), a 35–40 minute simmer, and cooling
  and shredding the chicken. → cookMinutes 60 → **70**.

## For the owner
1. **`bobotie` custard is thin (leave it).** 3 eggs and 1 cup of milk over a 9-by-13-inch dish gives a layer about
   3/16 inch thick. That is thinner than the usual 1/4 inch but enough to cover the pressed meat. The writer chose
   9-by-13 because 2 lb of beef in a 9-inch square dish would come close to the rim. The doneness cue ("until the
   custard is set and golden at the edges") is right even if it sets before 30 minutes. **Recommendation: leave it.**
   If the owner wants a thicker top, the smallest change is 4 eggs and 1 1/3 cups of milk in the custard, with the
   egg and milk lines updated to match.
2. **The `beef-bulgogi` and `gyudon` "no doneness temperature" flags need no change.** Both are thin-sliced beef
   cooked "until no pink remains", which is well past 145°F. Decision 13's 130°F plus the USDA sentence is for steaks
   and chops served medium-rare, and doesn't apply here. **Recommendation: no change.**
3. **The writer asked about near-duplicates; keep all three titles.**
   - Chicken Biryani (layered, chicken) is a different dish from Lamb Biryani (one-pot, lamb). **Keep the plain title.**
   - The round-5 breakfast file has no Chicken Congee, so Arroz Caldo overlaps nothing.
   - General Tso's (deep-fried, dried chilies, hoisin and vinegar) differs enough from Crispy Chicken with Sticky
     Sauce.
4. **Re-read first if the riskiest list is updated.** Pupusas: the dough hydration, 3 cups of masa harina to
   2 1/4 cups of water, is the standard ratio, and the step has a crack test and adds water a tablespoon at a time.
   Biryani: the stovetop dum step, which now has a proper oven alternative. Jamaican rice and peas: the new
   3 3/4 cups of liquid. None of the three needs more changes on paper.

## Checked, no change
`beef-bulgogi`, `kimchi-fried-rice-with-fried-eggs`, `bean-and-cheese-pupusas-with-curtido`, `chicken-maafe`,
`oyakodon`, `gyudon`, `kuku-sabzi`, `pad-kra-pao`, `shrimp-nasi-goreng`, `gado-gado`, `chiles-rellenos`, `bobotie`,
`cuban-beef-picadillo-with-potatoes`, `feijoada`.

Notes from the read:
- Every "divided" ingredient adds up. That covers the salt in pupusas, patatas, gado-gado, saag, biryani (2 tbsp =
  1 1/2 tsp + 1 1/2 tbsp), chiles rellenos, bobotie, picadillo and feijoada. It also covers the oil in bulgogi, nasi
  goreng, pad kra pao and bobotie, the water in pupusas and feijoada, and the milk and eggs in bobotie.
- Shallow-fry depths match the listed oil: about 3 cups gives 1/2 inch in a 12-inch skillet.
- Pupusa dough and filling volumes match 12 rounds of 4 1/2 inches.
- Kuku sabzi has 8 eggs and about 6 cups of herbs in a 10-inch skillet, which is fine.
- The bulgogi marinade is thrown away, and the biryani marinade cooks with the chicken.
- Raw yolks on gyudon and runny yolks elsewhere carry no warning (decision 12).
- Every savory dish is seasoned by salt or by soy, fish sauce, bacon or cheese (decision 14).

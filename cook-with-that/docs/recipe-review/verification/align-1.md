# al1: aligning 12 recipes to published amounts

Each number below was moved to the median of 3–7 published versions, scaled to our batch. Full figures and URLs are in `verdicts.json`, and the edits are in `patch.diff`. All 12 now score **5**.

| Recipe | What moved | Why |
|---|---|---|
| beer-battered-fish-and-chips | First chip fry 325 → 300°F (6–7 min). Fish oil 375 → 365°F. Chips are now crisped at 375°F after the fish. cookMinutes 45 → 50 | The median for fish oil is about 365°F (350–375 across 6 versions) and for the first chip fry about 300°F (275–325). The batter (1:1 beer to flour, 1 tsp baking powder per cup) and the 5–7 min fish time were already typical. |
| cajun-shrimp-and-rice-skillet | Broth 1 1/2 → 2 cups per cup of rice (tomatoes still undrained) | The median is 2 cups (Hormel 2.5, Craving Home Cooked 2, USA Rice 2, ATK 2.06). The 18 min simmer was already at the median. |
| lamb-gyros-with-tzatziki | Bake 40–45 → 45–50 min. cookMinutes 60 → 65 | 2 lb loaves take about 55–60 min at 350°F; scaled to our 1 1/2 lb that is 45–50. The temperature and pan already matched. |
| pork-carnitas-tacos | Water 2 → 4 cups (just covering the meat), partly covered. Boil-off 25–35 → 30–40 min. cookMinutes 140 → 150 | Stovetop versions use water to cover with a lid partly on or off. Keeping no added fat (3 of 4 versions use none) keeps it distinct from Food Network. |
| pork-schnitzel | Oil 1 1/2 → 2 1/2 cups, about 1/4 → 1/2 inch deep. cookMinutes 15 → 20 | Published depths run 1/8, 1/4, 1/2, about 1 inch and floating, so the median is 1/2 inch. 350°F and 2–3 min per side were already typical. |
| rosemary-garlic-lamb-chops | Basting after the flip 3–5 → 4–6 min | After the flip, versions take 5–7 (ATK, same thickness), 8–9, 3–4 and 2+ min, so the median is about 4–6. 130°F and the USDA sentence are kept (house rule 13). |
| sausage-and-white-bean-casserole | Broth 1 → 1 1/2 cups. Uncovered 10–15 → 15–20 min. cookMinutes 60 → 70 | UK versions use 200–425 ml (median about 340), so 1 1/2 cups fits. The oven at 180°C/350°F was already typical. |
| sausage-potato-and-green-bean-sheet-pan | No number moved. The pan is named as 18×13, and the step adds a thermometer fallback | Raw-sausage sheet pans take 30–45 min at 425°F (median 35–40), which is ours already. The 4 came from ovens varying. |
| shrimp-pad-thai | Noodles 1/4 → 1/8 inch wide. Soak 20–30 → 15–20 min | Hot-water soaks have a median of 15–20 min for 1/8-inch or 2–3 mm noodles. Fish sauce, sugar and tamarind (about 3 tbsp each per 8 oz) were already at the median. Not ATK: our tamarind use, sugar type, oil and the absence of vinegar differ. |
| tuna-pasta-bake | Flour 3 → 6 tbsp (2 per cup of milk). Cheddar 2 → 1 1/2 cups (1 in the sauce, 1/2 on top). Bake 20–25 → 15–20 min | Flour per cup of milk has a median of 2 (range 1–3), and full-fat versions use about 0.5 cup cheese per cup of milk. Butter, milk to pasta and 375°F were already typical. |
| chicken-mulligatawny-soup | Red lentils 1/2 → 1 cup | Lentils per cup of liquid run 0.10–0.19 (median 0.15), and ours was below all of them. Rice, broth and curry powder were already typical. |
| hot-and-sour-soup | Slurry cornstarch 3 tbsp → 1/4 cup. Rice vinegar 1/3 → 1/4 cup. Tofu 14 → 7 oz | The medians per 6 cups of broth are 1/4 cup cornstarch, 1/4 cup vinegar and about 5 oz tofu. The 1 tsp sugar is kept as our own non-critical number (range 0–1 tsp), so the soup does not match ATK. |

**Check:** `npm run check` passes (typecheck, validate, 11 suites and 874 tests). One fix was needed along the way: the tofu line first read "7 oz (half a 14-oz block)", which the metric converter can't read, so it is now "1/2 block (7 oz)". `npm run audit:recipes` gives output identical to before the edits, so no new flags; the only existing flag on these recipes is the old gyros/souvlaki near-duplicate. `docs/recipe-audit.md` was checked out again afterwards.

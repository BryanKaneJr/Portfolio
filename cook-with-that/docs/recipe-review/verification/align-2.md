# al2: alignment of 12 recipes onto the published amounts

Each number is the median of 4–6 published versions, scaled to our batch. Full figures and sources are in `verdicts.json`. All 12 now score 5.

| Recipe | What moved (old → new) | Why |
|---|---|---|
| Beef and Black Bean Enchiladas | Sauce oil, flour and chili powder 3 tbsp → 1/4 cup each (chili powder written "4 tbsp plus 1 tsp"); broth 3 → 2 1/2 cups | Median roux is 1 1/2 tbsp each per cup of broth (ours was 1). Pans of 12 enchiladas use about 2 1/2 cups of sauce. |
| Beef Empanadas | Butter 8 → 10 tbsp; dough salt 3/4 → 1 1/4 tsp | Baked doughs use about 3.3 tbsp butter and 0.4 tsp salt per cup of flour. Liquid, egg and 400°F for 20–25 minutes were already typical. |
| Beef Kofta with Yogurt Sauce | Broil 9–10 → 8–9 minutes; logs now "1 inch thick"; temperature check in the thickest log | 2-oz kofta broil for 7–10 minutes (Milk Street 7–9). Salt and spices were already typical. |
| Cheesy Ground Beef, Potato and Broccoli Skillet | Potatoes 1 1/2 → 1 lb; cheddar 6 → 4 oz; oil 2 → 1 tbsp; salt 1 1/4 → 1 tsp; tagline "topped with melted cheddar" | Per lb of beef, sources use about 1 lb potatoes and 1 cup cheddar. Less potato also browns more evenly in a 12-inch pan. |
| Corned Beef and Cabbage | Potatoes and carrots 10 → 15 minutes, cabbage 12–15 → about 15 (about 30 in all); cookMinutes 215 | Vegetables cook about 30 minutes in all after the beef, with about 15 for the cabbage. |
| Ground Beef and Broccoli Stir-Fry | Brown sugar 1 → 2 tbsp; cornstarch 2 tsp → 1 tbsp | Sauces for ground beef and broccoli use about 2 1/2 tbsp sweetener per lb of beef and about 4 tsp cornstarch per cup of sauce. |
| Ground Beef, Spinach and Rice Skillet | No amount changed. Tomato juices are kept; heat is "lowest that keeps a gentle simmer"; about 20 minutes | Sources use 1 1/2 cups broth plus an undrained can of tomatoes, about 2–2 1/4 cups of free liquid per cup of rice. Our 1 3/4 cups plus two fresh tomatoes and their juices give the same. The 4 came from burner heat and how much juice the tomatoes give, so the cues are now clearer. |
| Mongolian Beef | Water 1/3 → 3/4 cup; cornstarch coating 1/4 cup → 6 tbsp; sauce simmer 4–5 minutes | Per lb of flank, sources use about 1/2 cup water and 1/4 cup cornstarch coating. Soy (1/2 cup) and brown sugar (1/3 cup) were already at the per-lb medians. |
| Salisbury Steak with Mushroom Gravy | Covered simmer 10–12 → about 15 minutes; cookMinutes 35 | The flour, 1 tbsp per cup of broth, is already at the median of six sources (1–1.2), so it stays. The median time in the gravy is 15 minutes. |
| Chicken and Spinach Pasta in Garlic Broth | Broth 3/4 → 1 cup | No-cream versions use about 1 cup of liquid per 12 oz pasta. Parmesan, garlic and oil were already typical. |
| Creamy Garlic Chicken Pasta | Cream 1 → 1 1/2 cups; butter 1 → 2 tbsp; simmer 3–4 minutes | Creamy chicken and spinach pastas use about 1 1/2 cups cream and about 2 tbsp butter per 12 oz. Parmesan (3/4 cup) was already the value in all four sources. |
| Easy Tomato Soup | Simmer 15 → 30 minutes; butter 3 → 4 tbsp; broth 2 → 1 1/2 cups; cookMinutes 45 | For two 28-oz cans, the median is 30 minutes, 4 tbsp butter and 1 1/2 cups broth. |

No result copies one source's whole formula. Each note names the nearest source and the quantity where ours differs. None of the 12 had a `rework` entry.

Checks: `npm run typecheck`, `npm run validate` and `npx jest -w 2` pass (874 tests). The full `npm run check` lost a jest worker to memory, as before any change. `npm run audit:recipes` shows no new flags for these recipes. One number changed in an existing flag: Mongolian beef's "water per cup of rice" went from 0.22 to 0.5, because the water is for the sauce. An early draft raised a metric-ml-solid flag for chili powder written as "1/4 cup"; it is now written in tbsp. `docs/recipe-audit.md` was restored.

import { join } from 'path';
import type { Snapshot } from '../snapshot';
import type { RawRecipe } from '../types';
import { readBasedCooking } from './basedCooking';
import { readNhlbi } from './nhlbi';
import { duplicatesInSnapshots, readNhlbiBooks } from './nhlbiBooks';
import { readVa } from './va';

const NHLBI_WEB_SNAPSHOT = 'content/import/nhlbi/recipes.json';
const NHLBI_BOOKS_SNAPSHOT = 'content/import/nhlbi-books/recipes.json';

export type SourceDef = {
  /** Key in RECIPE_COLLECTIONS (src/data/collections.ts). */
  collection: string;
  /** Exported array name and file in src/data/imported/. */
  exportName: string;
  file: string;
  /**
   * 'reuse': the license lets us keep the source's wording (public domain, CC0, Unlicense).
   * 'rewrite': ideas and ingredient lists only; drafts get placeholder steps to write fresh.
   */
  textPolicy: 'reuse' | 'rewrite';
  /** Entries we won't import, with the reason (e.g. the page credits a third-party original). */
  exclude: Record<string, string>;
  /** Contributors whose pages we won't import at all, by credited name, with the reason. */
  excludeAuthors?: Record<string, string>;
  /** Pinned snapshot, so a report or draft can always be reproduced: a git commit or a committed file. */
  snapshot: Snapshot;
  /** Read the snapshot: a checkout directory for `git`, the file's absolute path for `file`. */
  read(location: string): RawRecipe[];
};

export const SOURCES: Record<string, SourceDef> = {
  'based-cooking': {
    collection: 'based-cooking',
    exportName: 'BASED_COOKING_RECIPES',
    file: 'basedCooking.ts',
    textPolicy: 'reuse',
    // These pages credit an outside original, so the public-domain waiver may not be the contributor's to give.
    exclude: {
      couscous: 'credits an original recipe on 196flavors.com',
      'kettle-chips': 'links an original recipe on ethanchlebowski.com',
      'yorkshire-puddings': 'says "originally published on Good Food" (BBC)',
      'tuscan-style-pork-roast': 'adapted from Binging With Babish',
      'beef-tips': 'derived from a YouTube video',
      'gumbo-shrimp-and-sausage': 'derived from a YouTube video',
      'shrimp-and-grits': 'derived from a YouTube video',
      'perfect-potato-salad':
        'copied from Dairy Farmers of Canada\'s "Perfect Potato Salad" (2017 Milk Calendar); the steps match its text word for word',
      'one-pot-chicken-tetrazzini':
        'copied from Dairy Farmers of Canada\'s "One-Pot Chicken Tetrazzini" (2017 Milk Calendar), Boursin and all',
      'panang-style-beef-curry':
        'copied from a HelloFresh recipe card (Panang-Style Beef Curry, hellofresh.ca); "mild curry paste, red curry base" steps match',
      'red-lentil-dahl':
        'doubtful; steps closely track a published "Red Lentil Dhal" (SparkPeople) and the same contributor copied the three pages above',
      'newfoundland-cod-chowder':
        'doubtful; reads like published magazine copy ("Drain off all but 1 tbsp. fat from saucepan"), not found online, same contributor as the copied pages above',
      'chicken-tikka-masala':
        'copied from Taste of Home\'s slow-cooker "Chicken Tikka Masala" (same ingredient list; "combine the first 13 ingredients" wording)',
      'chicken-biscuit-potpie':
        'Taste of Home\'s "Chicken Biscuit Potpie" (credited there to Dorothy Smith); same ingredients and directions',
      'cheddar-crusted-chicken':
        'HelloFresh Canada meal-kit card "Cheddar-Crusted Chicken" (Smoked Paprika-Garlic Blend, same mayo-and-panko method wording)',
      'colcannon-bake':
        'directions match published copy word for word ("Drain and allow to steam dry for a minute or two"), e.g. Celiac Disease Foundation\'s "Colcannon Bake"',
      'bean-salad':
        'same ingredient list and method as the SparkPeople "Three Bean Salad" posted by another user (CARLEY053106)',
      'chicken-in-red-wine-vinegar-sauce':
        'Food52 recipe by ChefJune (1 whole chicken cut into 10 pieces, 4 shallots, 1 cup red wine vinegar, 1 cup crème fraîche, serves 6)',
      coleslaw:
        'says it\'s "a coleslaw recipe that I got from a chili restaurant in my neighborhood", so it credits an outside original',
      'easy-chicken-and-rice-casserole': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'egyptian-lentils': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'exotic-ginger-cumin-chicken': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      fajitas: 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'fall-vegetable-and-chickpea-curry':
        'contributor joel-maxuel: several pages copied from commercial recipe sites (this one is the Dairy Farmers of Canada / Alberta Milk recipe)',
      'greek-salad':
        'contributor joel-maxuel: several pages copied from commercial recipe sites (ingredient wording matches a published Greek salad verbatim: "pitted black olives (preferably brine-cured), coarsely chopped")',
      'gypsy-soup':
        "contributor joel-maxuel: several pages copied from commercial recipe sites (this one is Mollie Katzen's Gypsy Soup, Moosewood Cookbook)",
      'hakka-style-meatballs':
        'contributor joel-maxuel: several pages copied from commercial recipe sites (this one is a HelloFresh Canada recipe card)',
      'honey-sriracha-chicken-thighs':
        "close paraphrase of Crunch Time Kitchen's Honey Sriracha Chicken Thighs (Nick Evans, 2019): same ingredients, cold-skillet method and wording",
      'hoisin-tofu-and-broccoli':
        "derived from Omnivore's Cookbook's Tofu and Broccoli (Maggie Zhu, 2020): same quantities, zip-top-bag marinade and sauce, uncredited",
      'lemon-and-oregano-chicken-traybake':
        'copy of BBC Good Food\'s Lemon & oregano chicken traybake (same ingredients, timings and "220C/200C fan/gas 7")',
      erwtensoep:
        "intro copied from Wikipedia's Erwtensoep article (CC BY-SA); method closely tracks published Dutch pea soup recipes (e.g. Cooksister)",
      'diannes-southwest-salad':
        'suspected, not confirmed: named for another cook and written in packaged-mix magazine style; a 2005 Southern Living layered cornbread salad has a near-identical Southwest variation',
      'shrimp-and-chicken-jambalaya': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'smoked-salmon-pasta-primavera': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'smoked-salmon-quiche': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'spicy-kung-pao-style-chicken': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'spinach-rice-casserole': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      tabouleh: 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'tofu-and-cashew-chow-mein': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'turkish-red-lentil-soup': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'turkish-style-spiced-chicken': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'turmeric-flatbread': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'winter-risotto': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'zaatar-chicken-bulgur-bowls': 'contributor joel-maxuel: several pages copied from commercial recipe sites',
      'simple-chicken-curry':
        'the page\'s original version (based.cooking commit 3c5ac9f) said "adapted from" Cooking Classy\'s chicken curry; the credit was later dropped, the copy stayed',
      tuhu: "the page's original version credits Tasting History with Max Miller (YouTube video) as the recipe's source",
      'spicy-sausage-pasta':
        'the contributor says "I found it in a newspaper"; wording reads like the published original',
      tajine: "intro sentence and recipe match diversivore.com's Tajine Maadnous (a sponsored post), word for word",
      'ukrainian-borscht':
        "method copied from Natasha's Kitchen's classic borscht (mirrors label it adapted from there); intro is Wikipedia text",
      'spaghetti-alla-puttanesca':
        'same quantities as a published Italian recipe (Dissapore: 320 g spaghetti, 800 g pelati, 25 g anchovies, 10 g capers, 100 g Gaeta olives); blurb reads as translated magazine copy',
      'sand-tarts': 'author is credited as "Pennsylvania Dutch Cooking", a published cookbook',
      'yibin-burning-noodles':
        'chili oil and noodle recipe closely follows the Chinese Cooking Demystified video (also credited as the source by themalamarket.com); not confirmed word for word',
      'cheesy-potatoe-bake':
        'the page\'s original version (based.cooking commit f9815cd, 2021) said "Originally published at" taste.com.au\'s Cheesy Potato Bake; the credit was dropped in commit ab251b0 (2022), the recipe stayed',
      'chorizo-and-chickpea-soup':
        'the page\'s original version (commit 845adc4, 2021) said "Recipe modified from original published at" BBC Good Food\'s chorizo-chickpea-stew; the credit was dropped in commit ab251b0 (2022)',
      'basic-meatballs':
        "the contributor's commit (ce02d10) says it is \"modified from some others I found on blogs and in J Kenji Lopez Alt's 'Food Lab'\" (a published cookbook)",
      'butter-chicken-masala':
        'steps track Food.com\'s "Butter Chicken" (recipe 237702) wording: "roast the marinated chicken in a tandoor or an oven for about 5-10 minutes till it is three fourth done"; "add the prepared chicken, white butter, fresh cream, sliced green chillies and crushed fenugreek leaves" (the page even adds green chilies its own ingredient list never mentions)',
      'beef-goulash':
        'doubtful; a later edit (commit 0694559, 2026) dropped "Originally published at yaroslavps.com/food/beef-goulash"; probably the contributor\'s own blog, but the original lives on another site',
      'cinnamon-waffles':
        'author is credited as "Pennsylvania Dutch Cooking", a published cookbook (the same credit as the already-excluded sand-tarts)',
      'lebanese-lentil-soup':
        "copied from Blue Zones' \"Lebanese-Style Lentil Soup\" (the page's subtitle is that title word for word; same 3 cups red lentils, 12 cups water, Yukon golds, zucchini, 4 cups chard, cilantro, 1/4 cup lemon juice, 1 tsp cumin and same method, reproduced on BYU's Blue Zone Diet Cookbook page)",
      kropsua:
        'derived from a published "Kropsu: Finnish Baked Pancake" (The Culinary Cellar; also hultgren.org): identical 1/2 cup (1 stick) butter, 2 eggs, 2 tbsp sugar, 1/2 tsp salt, 2 cups whole milk, 1 cup flour, 400°F 9x13 pan, 40 min, and the same "Using heavy oven mitts, remove pan from oven and pour batter" step',
      kaiserschmarrn:
        'suspected translation of a published German/Austrian recipe (likely gutekueche.at): a German-language Kaiserschmarrn handout linking gutekueche.at has the identical 200 g flour, 30 g sugar, 4 eggs, 300 ml milk, 40 g butter, 30 g raisins for 3 portions and the same yolk/stiff-white/180°C-oven method',
      'nashville-chicken':
        'earlier versions credited "BBQ-Nation" and linked grillnationbbq.com (wprm_print/1538) as the source; the credit was later dropped, and the intro still reads as that blog\'s copy',
      'medieval-beef-soup':
        'earlier versions said "Adapted from this video" (a YouTube video), later "Adapted from a recipe from Anonimo Toscano\'s Manuscript"; both credits were dropped in a later edit',
      'pork-carnitas':
        "Skinnytaste's slow-cooker carnitas (Gina Homolka): same ingredient list (2 1/2 lb boneless pork shoulder, 6 garlic cloves in slivers, 1 1/2 tsp cumin, 1/2 tsp sazon, 1/4 tsp dry adobo, 1/4 tsp oregano, 3/4 cup reduced-sodium chicken broth, 2-3 chipotles in adobo, 2 bay leaves) and the same steps (garlic slivers pushed into the meat, 8 hours on low, shred, 15-30 minutes more)",
      'peat-carrot-salad': "titled and credited as Ray Peat's carrot salad, another named person's recipe",
      'shrimp-creole':
        '"adaptation from my grandmother\'s recipe" of a published Junior League recipe: same unusual list (green pepper, celery with leaves, oil, chili sauce, golden raisins, slivered almonds, curry powder, "1 tsp each" thyme/salt/pepper, parsley, canned tomatoes, shrimp, served over rice) and the same four-line method as "Shrimp Pentagon" (RSVP, Junior League of Portland, reprinted by tsbvi.edu) and Viking Range\'s "Curried Shrimp Creole" (adapted from a Junior League of Augusta cookbook); quantities differ, wording doesn\'t match word for word',
      'tarta-de-santiago':
        'copied from El Mundo Eats\' "Spanish Almond Cake (Tarta de Santiago)" (elmundoeats.com): identical ingredient list (3 eggs, 3/4 cup/150 g sugar, 1 1/2 cups/150 g almond meal, 1/2 tsp cinnamon, 1/4 tsp salt, zest of 1 lemon and 1 clementine), 7-inch springform, 360°F/180°C for 40 minutes, same steps and blog-style intro',
      'ukrainian-vareniki':
        'same quantities and Allrecipes-style wording as "Vareniki with Potatoes and Mushrooms" credited to Flora S. (reprinted on stratfordlibrary.org): 18 oz potatoes, 3 cups flour, 1/4 cup sour cream, 1/2 tsp baking soda, 3 1/2 cups finely chopped button mushrooms, "Place potatoes into a large pot and cover with salted water"',
      'spatchcock-chicken':
        'suspected, not confirmed: reads like magazine copy ("2 (3 1/2) pound whole chickens, wingtips removed", "Line a large rimmed baking sheet with foil", "Let stand 5 minutes before cutting each chicken into 8 pieces"); no match found online',
      'scandinavian-coffee-cake':
        'suspected, not confirmed: no author credited, and the wording reads like a mid-century published cookbook ("3 cup sifted enriched Flour", "(See a recipe for white bread)", "set oven for moderate 375°F"); no match found online',
      'no-knead-pizza-dough':
        'Serious Eats\' "Foolproof Pan Pizza" dough (J. Kenji López-Alt) halved: 400 g bread flour, 10 g salt, 4 g instant yeast, 8 g oil, 275 g water becomes 200 g flour, 5 g salt, 2 g yeast, 5 g oil, 140 g water, with the same 8–24 hour room-temperature rise for a cast-iron pan pizza',
      'pan-pizza':
        'same contributor\'s companion page to the dough above; its method (oil the cast-iron skillet, shape a ball, rest, press out to the edges, bake at max heat) follows the same Serious Eats "Foolproof Pan Pizza" recipe',
      shakshouka:
        'the headnote is the opening sentence of Wikipedia\'s "Shakshouka" article (CC BY-SA), copied without credit; the page is also too close to the library\'s Menemen and gives no quantities',
    },
    // Several of this contributor's pages turned out to be copies of commercial recipes (Food.com, Dairy
    // Farmers of Canada, HelloFresh, SparkPeople), so none of their pages can rely on the waiver.
    excludeAuthors: {
      'Joel Maxuel':
        'pages copied from commercial recipe sites (Food.com, Dairy Farmers of Canada, HelloFresh, SparkPeople)',
    },
    snapshot: {
      kind: 'git',
      url: 'https://github.com/LukeSmithxyz/based.cooking.git',
      commit: '9d4a31a040eedd61e4fb608cb0c114ff9a7c4dd2',
    },
    read: readBasedCooking,
  },
  nhlbi: {
    collection: 'nhlbi',
    exportName: 'NHLBI_RECIPES',
    file: 'nhlbi.ts',
    // US government work, released as public domain (content/import/nhlbi/README.md).
    textPolicy: 'reuse',
    // Every page fetched on 2026-10-09 credits an NHLBI publication and carries no outside credit or copyright
    // notice. A page that does (now or after a refetch) goes here.
    exclude: {},
    // Written by `npm run import:fetch-nhlbi`; the site has no repository to pin.
    snapshot: { kind: 'file', path: NHLBI_WEB_SNAPSHOT },
    read: readNhlbi,
  },
  // NHLBI's recipe books (PDFs): the same collection, credit and license as the web pages, and
  // drafts land in the same file. Keys carry the book ("book-dinners/…"), so they never collide
  // with a web page's key.
  'nhlbi-books': {
    collection: 'nhlbi',
    exportName: 'NHLBI_RECIPES',
    file: 'nhlbi.ts',
    // US government publications, released as public domain (content/import/nhlbi-books/README.md).
    textPolicy: 'reuse',
    exclude: {
      // The books reprint each other and the web pages; the web page (or the first book) is the one to import.
      ...duplicatesInSnapshots(join(__dirname, '..', '..', '..'), NHLBI_BOOKS_SNAPSHOT, NHLBI_WEB_SNAPSHOT),
      'book-latino/oven-fried-yuca':
        'same recipe as nhlbi/oven-fried-yucca (the web page spells it "yucca"); import that one',
      'book-african-american/mouth-watering-oven-fried-fish':
        'same recipe as nhlbi/baked-fish (the web page renames it); import that one',
      'book-african-american/scrumptious-meatloaf':
        'the 2021 edition misprints its amounts (4 cups each of onion, green and red pepper, 8 teaspoons nutmeg and 4 cups breadcrumbs for 1 lb of beef); the printed page says the same, so the parse is right but the recipe is not',
    },
    // Written by `npm run import:fetch-nhlbi-books` from the PDFs, which aren't kept.
    snapshot: { kind: 'file', path: NHLBI_BOOKS_SNAPSHOT },
    read: readNhlbiBooks,
  },
  va: {
    collection: 'va',
    exportName: 'VA_RECIPES',
    file: 'va.ts',
    // US government work, not copyright protected (content/import/va/README.md).
    textPolicy: 'reuse',
    // Recipes whose PDF, or another upload of the same recipe, credits an outside original ("Adapted from" a
    // website, magazine, cookbook or organization), then uncredited recipes traced to a published original by a
    // web search (last six). A missing credit is not proof of VA authorship: search each pick before importing
    // it. "Submitted by" or "Inspired by a recipe submitted by" a VA dietitian is fine on its own.
    // content/import/va/README.md lists the same pages.
    exclude: {
      'asian-salmon-and-vegetable-packets': 'adapted from www.foodnetwork.com',
      'barbecue-pork-sheet-pan-dinner': 'adapted from www.stockpilingmoms.com',
      'bean-and-vegetable-tacos': 'adapted from HealthySeasonalRecipes.com',
      'braised-chicken-and-vegetable-skillet': 'adapted from www.lyndasrecipebox.com',
      'bread-stuffing-with-apples-and-celery': 'adapted from Delicious on a Dime',
      'broccoli-salad': 'adapted from TheKitchn.com',
      'brussels-sprout-and-apple-salad': 'adapted from Onceuponachef.com',
      'cauliflower-quinoa-meatballs': 'adapted from pinchofyum.com',
      'chickpea-shakshuka': 'adapted from minimalistbaker.com',
      'chocolate-peanut-butter-smoothie': 'adapted from minimalistbaker.com',
      'creamy-tomato-chicken-skillet': 'adapted from diethood.com',
      'crispy-garlic-ginger-tofu': 'adapted from tablefortwo',
      'crispy-lemon-fish': 'adapted from themediterraneandish.com',
      'crunchy-thai-chicken-salad': 'adapted from The Lean Green Bean Blog',
      'fall-quinoa-salad': 'adapted from EmilieEats.com',
      'fish-and-vegetable-foil-packets': 'adapted from the Low-Fat Soul Cookbook',
      'flourless-almond-butter-cookies': 'adapted from Live Well Bake Often',
      'foil-packet-fish':
        '"Adapted from" another VA dietitian\'s recipe, which names no source of its own; left out to be safe',
      'fruit-salad-with-honey-yogurt-dressing': 'adapted from TheLemonBowl.com',
      'ground-turkey-sweet-potato-skillet': 'adapted from Cooking Light',
      'hearty-red-lentil-soup':
        'an older upload says adapted from Diabetes.org; the newer one dropped the credit, not the recipe',
      'indian-spinach-with-tofu': 'adapted from connoisseurusveg.com',
      'italian-pasta-skillet': 'adapted from accenthealth.com',
      'kale-chips':
        'an older upload says adapted from Ohsheglows.com; the newer one dropped the credit, not the recipe',
      'lemon-bars': 'adapted from Sparkpeople.com',
      'lemon-chicken-stir-fry': 'adapted from www.eatingwell.com',
      'mediterranean-chicken-and-bulgur-skillet': 'adapted from Cooking Light',
      'mediterranean-lamb-kabobs-with-tzatziki': 'adapted from Recipes.SparkPeople.com',
      'mediterranean-salmon-salad': 'adapted from eatingwell.com',
      'mexican-stuffed-sweet-potatoes': 'adapted from delish.com',
      'pasta-with-chickpeas': 'adapted from dinnerwithjulie.com',
      'peanut-slaw-with-noodles': 'adapted from Cookie and Kate Blog',
      'plant-powered-chocolate-muffins': 'adapted from Sarahremmer.com',
      'pork-and-rice-skillet': 'adapted from www.iwashyoudry.com',
      'pork-and-vegetable-fried-rice': 'adapted from www.smittenkitchen.com',
      'pork-egg-roll-in-a-bowl': 'adapted from nomnompaleo.com',
      'pork-tenderloin-kebabs': 'adapted from America’s Test Kitchen',
      'pressure-cooker-braised-chicken-thighs': 'adapted from America’s Test Kitchen',
      'quinoa-and-black-bean-burrito-bowls': 'adapted from toriavey.com',
      'quinoa-tabbouleh': 'adapted from Thekitchn.com',
      'rosemary-chicken-salad-sandwiches': 'adapted from MyRecipes',
      'rosemary-tuna-salad-sandwiches': 'adapted from www.myrecipes.com',
      'sheet-pan-tilapia-and-vegetable-medley': 'adapted from www.tasteofhome.com',
      'skillet-shepherd-s-pie': 'adapted from Cullyskitchen.com',
      'slow-cooker-roasted-chicken': 'adapted from FamilyFreshMeals.com',
      'slow-cooker-stuffed-peppers': 'adapted from www.pinchofyum.com',
      'southwest-chicken-soup': 'adapted from eatingwell.com',
      'spinach-artichoke-dip': 'adapted from House of Nash Eats Blog',
      'stovetop-chicken-divan': 'adapted from www.eatingwell.com',
      'summer-fruit-salad-with-lime-yogurt-sauce':
        '"Adapted from" another VA dietitian\'s recipe, which names no source of its own; left out to be safe',
      'sweet-and-tangy-kale-salad': 'adapted from CookieAndKate.com',
      'sweet-potato-swirl-pie-bars': 'adapted from Eating Well',
      'sweet-vanilla-acorn-squash': 'adapted from Dessert for Two',
      'tomato-and-sausage-bean-stew': 'adapted from www.budgetbytes.com',
      'tropical-tex-mex-shrimp-fajitas': 'adapted from www.smittenkitchen.com',
      'tuna-sushi-bowl': 'adapted from EatingWell.com',
      'unstuffed-cabbage-roll-soup': 'adapted from the Wholesome Dish',
      'zucchini-muffins': 'adapted from Cookie and Kate',
      'walnut-chili-mac':
        'uncredited, but the California Walnut Commission\'s "Walnut Chili Mac" (walnuts.org): 1/2 lb lean ground beef, 3/4 cup chopped walnuts, 1/2 cup onion, 1 tbsp oil and salsa, with beans and macaroni',
      'black-bean-covered-sweet-potato':
        'uncredited, but the "Black-Bean Smothered Sweet Potatoes" posted on SparkPeople: 2 medium sweet potatoes, a 15-oz can of black beans, 1 medium tomato, 1/2 tsp each cumin and coriander, microwaved',
      'flourless-black-bean-brownies':
        'uncredited, but the widely published flourless black bean brownie (Prevention RD, Skinnytaste): 1 tsp balsamic and 1/2 tsp coffee, beans pulsed before the eggs, chips stirred in and the batter "spread to the edges"',
      'tuscan-bean-soup':
        'uncredited, but the American Heart Association\'s "Tuscan Bean Soup" step for step: onion, celery and garlic; oregano, thyme and red pepper flakes; white beans, diced tomatoes and broth; spinach; about 1/3 cup Parmesan',
      'creamy-roasted-cauliflower-soup':
        'uncredited, but Cookie and Kate\'s "Creamy Roasted Cauliflower Soup": 2 lb cauliflower roasted at 425°F, 4 cups vegetable broth, butter, lemon juice and nutmeg, garnished with parsley, chives or scallion',
      'braised-cod-and-green-beans-with-pesto':
        'uncredited, but the widely syndicated "Poached Cod & Green Beans with Pesto" (Orlando Health, Just A Pinch): green beans and 3/4 cup shallot, cod poached in 1 1/2 cups broth, broth "reduced to about 1/2 cup", pesto stirred in',
      'apple-pork-tenderloin':
        '"Submitted by" a VA dietitian, but it is 12 Tomatoes\' "Slow Cooker Hasselback Pork Loin" (reposted on Just A Pinch): tenderloin slit and filled with apple slices over baby carrots and potatoes, glazed with honey, 2 tbsp soy sauce, 1 tbsp each Dijon and balsamic, cinnamon and 3 garlic cloves',
      'braised-mustard-greens-with-red-beans':
        'uncredited, but Food & Nutrition Magazine\'s "Sautéed Mustard Greens" (Marcy Gaston, 2018) with kidney beans added: 1/4 cup peanuts toasted first, 1 tbsp olive oil, 1 cup finely diced onion, garlic and curry powder, a 14.5-oz can of diced tomatoes, 1 tsp pepper, scallions and the nuts stirred in at the end, 8 servings',
      'confetti-couscous':
        'uncredited, but Vegetarian Times\' "Confetti Couscous": 1 cup couscous in 1 1/2 cups water with 1/2 tsp cumin, a 15-oz can of black beans, 1 cup corn, onion, bell pepper and cilantro, dressed with 2 tbsp olive oil and 3 tbsp lime juice ("about 2 limes"), 6 servings',
      'cream-of-celery-soup':
        'uncredited, but a lightened America\'s Test Kitchen "Cream of Celery Soup": celery, a peeled russet potato, onion, dried sage, salt and pepper sweated covered about 15 minutes, simmered uncovered in broth until the potato is tender, blended in batches and returned to the pot (the flour, sugar and cream dropped, lemon added)',
      'egg-drop-cabbage-soup':
        'uncredited, but Gimme Some Oven\'s "Cabbage Egg Drop Soup" at half size: onion and garlic softened in olive oil, stock, Napa cabbage, ground ginger and pepper simmered until tender, eggs drizzled in while the soup is stirred in a circle, toasted sesame oil and green onions',
      'garden-fresh-gazpacho':
        'uncredited, but Alton Brown\'s "Gazpacho" step for step: tomatoes blanched, peeled and seeded through a strainer with tomato juice added to make 1 cup, cucumber, red bell pepper, onion, jalapeño, garlic, lime juice, balsamic vinegar, cumin, olive oil and basil, 1 1/2 cups blended and stirred back in, chilled 2 hours (soy sauce here in place of Worcestershire)',
      'lamb-vegetable-kabobs-with-tzatziki':
        'the same recipe as mediterranean-lamb-kabobs-with-tzatziki (adapted from Recipes.SparkPeople.com) under a new title, with the credit dropped',
      'lemon-thyme-orzo-primavera':
        'uncredited, but the widely posted "Lemon Orzo Primavera" (Food.com, Allrecipes): orzo toasted in 1 tbsp olive oil about 2 minutes, zucchini, carrot and garlic for 2 minutes, a 14-oz can of broth, the zest of 1 lemon, 1 tbsp fresh thyme, about 10 minutes\' simmer, 1/4 cup Parmesan',
      'one-pot-chicken-barley-stew':
        'uncredited, but MyRecipes\' "Chicken and Barley Stew" (reposted on Just A Pinch): 1 cup quick-cooking barley, 1 tbsp olive oil, 1 3/4 cups onion, a 10-oz package of frozen mixed vegetables, cooked chicken and 1/4 tsp each salt, dried thyme and pepper in about 5 cups of broth',
      'winter-vegetable-soup':
        'uncredited, but Cooking Light\'s "Winter Vegetable Soup" (reposted on Food.com) step for step: 1 tsp olive oil and 2 oz pancetta (here bacon), acorn squash, red potatoes, 1/2 cup each celery and carrot, 1 tsp basil, 1/4 tsp each cinnamon and thyme, a 28-oz can of tomatoes, broth, 4 cups kale and a can of white beans',
    },
    // Written by `npm run import:fetch-va` from the PDFs; the site has no repository to pin.
    snapshot: { kind: 'file', path: 'content/import/va/recipes.json' },
    read: readVa,
  },
};

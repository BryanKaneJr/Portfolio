import type { Snapshot } from '../snapshot';
import type { RawRecipe } from '../types';
import { readBasedCooking } from './basedCooking';
import { readNhlbi } from './nhlbi';

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
    snapshot: { kind: 'file', path: 'content/import/nhlbi/recipes.json' },
    read: readNhlbi,
  },
};

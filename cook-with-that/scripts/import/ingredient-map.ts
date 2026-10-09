import type { IngredientCategory } from '../../src/data/types';

/**
 * Reviewed mappings from imported ingredient names to catalog IDs (scripts/import only).
 *
 * Keys are normalized names (lowercase, no punctuation; see normalizeText). Values:
 *  - a catalog ID, or several when one source line names two things ("salt and pepper");
 *  - `{ add: category }`: a real ingredient the catalog doesn't have yet. Owner rule (2026-10-09):
 *    when a recipe we import needs one, the catalog gains it, so `import:draft` writes the entry
 *    to src/data/ingredients.ts (id from the key, `name` if the key isn't the display name);
 *  - `'=other key'`: a spelling variant of another key. It becomes an alias of that entry;
 *  - `null`: too vague to index ("cheese", "vinegar"). The recipe stays blocked until the editor
 *    names the specific food in the draft;
 *  - `false`: not an ingredient at all (equipment listed under Ingredients); the line is dropped.
 *
 * Same rules as the catalog (docs/ingredient-mappings.md): same food in another form or
 * name only. Never map a substitution (bouillon is not broth, cayenne is not chili powder,
 * tomato sauce is not tomatoes). A food that differs gets its own `{ add }` entry instead.
 */
export type MapTarget = string | string[] | null | false | { add: IngredientCategory; name?: string };

export const INGREDIENT_MAP: Record<string, MapTarget> = {
  // ── Two catalog items on one line ──
  'salt and pepper': ['salt', 'black_pepper'],
  'salt and black pepper': ['salt', 'black_pepper'],
  'salt pepper': ['salt', 'black_pepper'],

  // ── Same food, other wording ──
  'all purpose flour': 'flour',
  'ap flour': 'flour',
  'white flour': 'flour',
  'unsalted butter': 'butter',
  'salted butter': 'butter',
  'extra virgin olive oil': 'olive_oil',
  evoo: 'olive_oil',
  oil: 'vegetable_oil',
  'cooking oil': 'vegetable_oil',
  'sunflower oil': 'vegetable_oil',
  'rapeseed oil': 'vegetable_oil',
  'egg yolk': 'eggs',
  'egg yolks': 'eggs',
  'egg white': 'eggs',
  'egg whites': 'eggs',
  'yellow onions': 'onion',
  'red onions': 'onion',
  'white onions': 'onion',
  'clove garlic': 'garlic',
  'cloves garlic': 'garlic',
  'cloves of garlic': 'garlic',
  'clove of garlic': 'garlic',
  'garlic minced': 'garlic',
  'lemon juice': 'lemon',
  'juice of 1 lemon': 'lemon',
  'lemon zest': 'lemon',
  'lime juice': 'lime',
  'lime zest': 'lime',
  'ground black pepper': 'black_pepper',
  'sea salt': 'salt',
  'table salt': 'salt',
  'fine salt': 'salt',
  'caster sugar': 'sugar',
  'light brown sugar': 'brown_sugar',
  'dark brown sugar': 'brown_sugar',
  'chicken stock': 'chicken_broth',
  'vegetable stock': 'vegetable_broth',
  'grated parmesan': 'parmesan',
  'parmigiano reggiano': 'parmesan',
  'sharp cheddar': 'cheddar',
  'shredded cheddar': 'cheddar',
  'cooked rice': 'rice',
  'long grain rice': 'rice',
  'basmati rice': 'rice',
  'beef mince': 'ground_beef',
  'minced meat': null, // beef, pork or a mix: the recipe must say which
  'whipping cream': 'heavy_cream',
  'heavy whipping cream': 'heavy_cream',
  'pure vanilla extract': 'vanilla',
  'vanilla essence': 'vanilla',
  'old fashioned rolled oats': 'oats',
  'spring onion': 'green_onion',
  'wheat flour': 'flour', // European usage: plain flour. Whole wheat is separate.
  'plain flour': 'flour',
  'basil leaves': 'basil',
  'fresh basil leaves': 'basil',
  'jalapeno pepper': 'jalapeno',
  'jalapeno peppers': 'jalapeno',
  'green bell pepper': 'bell_pepper',
  'red bell pepper': 'bell_pepper',
  'yellow bell pepper': 'bell_pepper',
  'ground beef meat': 'ground_beef',
  'lean ground beef': 'ground_beef',
  'light soy sauce': 'soy_sauce',
  'low sodium soy sauce': 'soy_sauce',
  'warm water': 'water',
  'lukewarm water': 'water',
  'hot water': 'water',
  'cold water': 'water',
  'boiling water': 'water',
  'ice water': 'water',
  'coarse salt': 'salt',
  'fine sea salt': 'salt',
  'dry oregano': 'oregano',
  'cinnamon powder': 'cinnamon',
  'paprika powder': 'paprika',
  'sweet paprika': 'paprika',
  'cooked chickpeas': 'chickpeas',
  'canned chickpeas': 'chickpeas',
  'butter or margarine': 'butter',
  'lard or butter': 'butter',
  'butter or lard': 'butter',
  'bacon strips': 'bacon',
  'rashers of bacon': 'bacon',
  'bacon rashers': 'bacon',
  'sweet butter': 'butter', // old name for unsalted butter
  oranges: '=orange',
  orange: { add: 'produce' },
  'maple syrup': { add: 'pantry' },
  thermos: false,
  'whole milk': 'milk',
  'cold whole milk': 'milk',
  'frozen spinach': { add: 'produce' }, // cooks differently from fresh baby spinach
  'cooking spray': 'vegetable_oil', // oil in a spray can
  'chilli flakes': 'red_pepper_flakes',
  'mashed bananas': 'banana',
  'golden delicious apples': 'apple', // the recipe names the variety
  'granny smith apples': 'apple',
  'whipped cream': 'heavy_cream', // whipped in the recipe
  broth: null, // chicken, beef or vegetable? The recipe must say
  grease: null, // which fat?

  // ── Reviewed ingredients the catalog gains when a recipe needs them, with their spelling variants ──
  'bay leaves': '=bay leaf',
  bayleaf: '=bay leaf',
  'bay leaf': { add: 'spice' },
  'ground nutmeg': '=nutmeg',
  nutmeg: { add: 'spice' },
  cayenne: '=cayenne pepper',
  'powdered sugar': { add: 'pantry' },
  'icing sugar': '=powdered sugar',
  'confectioners sugar': '=powdered sugar',
  'powdered white sugar': '=powdered sugar',
  cornstarch: { add: 'pantry' },
  cornflour: '=cornstarch', // UK name for cornstarch
  'corn starch': '=cornstarch',
  yeast: { add: 'pantry' }, // active dry or instant; the recipe names which
  'active dry yeast': '=yeast',
  'dry yeast': '=yeast',
  'instant yeast': '=yeast',
  yogurt: { add: 'dairy', name: 'Plain yogurt' }, // Greek yogurt stays separate
  'plain yogurt': '=yogurt',
  'natural yogurt': '=yogurt',
  leek: { add: 'produce' },
  leeks: '=leek',
  coriander: null, // leaves (cilantro) or seed: the recipe must say
  'ground coriander': { add: 'spice' },
  'dill weed': '=dried dill',
  'dried dill': { add: 'spice' },
  dill: { add: 'produce', name: 'Fresh dill' },
  'panko breadcrumbs': '=bread crumbs',
  panko: '=bread crumbs',
  chilli: '=chili pepper',
  'chilli pepper': '=chili pepper',
  'chili pepper': null, // which chili? The recipe must say
  cheese: null, // which cheese? The editor names it or the recipe stays out
  ham: { add: 'protein' },
  'smoked ham': '=ham',
  corn: { add: 'produce' }, // kernels, fresh or frozen
  'frozen corn': '=corn',
  'corn kernels': '=corn',
  'sweet corn': '=corn',
  'pecorino romano': { add: 'dairy', name: 'Pecorino Romano' },
  pecorino: '=pecorino romano',
  lentils: { add: 'protein' }, // brown or green, dried
  'brown lentils': '=lentils',
  'green lentils': '=lentils',
  'red lentils': { add: 'protein' }, // cook to a purée, so not interchangeable with brown or green
  'dried red lentils': '=red lentils',
  walnuts: { add: 'pantry' },
  'seasoned salt': { add: 'spice' },
  'season salt': '=seasoned salt',
  'seasoning salt': '=seasoned salt',
  rosemary: { add: 'spice' }, // fresh or dried, like thyme
  'dried rosemary': '=rosemary',
  'rosemary leaves': '=rosemary',
  'white vinegar': { add: 'pantry' },
  'distilled white vinegar': '=white vinegar',
  'marinara sauce': { add: 'pantry' },
  marinara: '=marinara sauce',
  'pasta sauce': '=marinara sauce',
  'ground ginger': { add: 'spice' }, // the catalog's ginger is fresh root

  // ── Not ingredients ──
  thermometer: false,
  cheesecloth: false,
  'cheese recipient': false,
  'kitchen twine': false,
  'parchment paper': false,
  'baking paper': false,
  toothpicks: false,
  skewers: false,

  // ── Look alike, different food: each gets its own entry, never an existing ID ──
  'rice vinegar': { add: 'pantry' },
  'tomato sauce': { add: 'pantry' },
  'chicken bouillon': { add: 'pantry' },
  'bouillon cube': null, // which flavor?
  'cayenne pepper': { add: 'spice' },
  'pepper jack': { add: 'dairy', name: 'Pepper Jack' },
  'bread crumbs': { add: 'grain' },
  breadcrumbs: '=bread crumbs',
  peanuts: { add: 'pantry' },
  'butternut squash': { add: 'produce' },
  peppercorns: { add: 'spice' }, // whole, not ground pepper
  'black peppercorns': '=peppercorns',
  'cumin seeds': { add: 'spice' }, // whole, not ground cumin
  'cinnamon sticks': { add: 'spice' },
  'dried basil': { add: 'spice' }, // the catalog's basil is fresh
  'dark soy sauce': { add: 'pantry' },
  'condensed milk': { add: 'pantry', name: 'Sweetened condensed milk' },
  'sweetened condensed milk': '=condensed milk',
  'evaporated milk': { add: 'pantry' },
  'tomato puree': { add: 'pantry' },
  'bomba rice': { add: 'grain', name: 'Paella rice' },
  'whole wheat flour': { add: 'grain' },
  'bread flour': { add: 'grain' },
  beef: null, // which cut?
  vinegar: null, // which vinegar?
  buttermilk: { add: 'dairy' },
  'coconut cream': { add: 'pantry' },
  'cream of tartar': { add: 'pantry' },
  'onion powder': { add: 'spice' },
  'garlic salt': { add: 'spice' },
  'brown rice': { add: 'grain' },
  'arborio rice': { add: 'grain' }, // risotto needs it; plain long-grain won't work
  'sweet potato noodles': { add: 'grain' },
  'lemon pepper': { add: 'spice', name: 'Lemon pepper seasoning' },
};

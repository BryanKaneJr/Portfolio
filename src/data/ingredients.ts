import type { Ingredient } from './types';

/**
 * Canonical ingredient catalog.
 *
 * Rules (see build plan §6 "Ingredient dictionary"):
 * - IDs are stable; never rename one that has shipped (favorites don't depend on
 *   these, but recipes do).
 * - Aliases are ordinary synonyms or plural/spelling variants ONLY.
 *   Never alias a substitution (milk ≠ almond milk, garlic ≠ garlic powder).
 * - A broad ID (e.g. `chicken`) may cover several cuts; each recipe still names
 *   the exact cut in `displayName`. Mappings are documented in ingredient-mappings.md.
 */
export const INGREDIENTS: Ingredient[] = [
  // ── Produce ────────────────────────────────────────────────
  { id: 'onion', name: 'Onion', category: 'produce', aliases: ['onions', 'yellow onion', 'red onion', 'white onion'] },
  { id: 'garlic', name: 'Garlic', category: 'produce', aliases: ['garlic clove', 'garlic cloves'] },
  { id: 'spinach', name: 'Spinach', category: 'produce', aliases: ['baby spinach'] },
  {
    id: 'tomato',
    name: 'Tomato',
    category: 'produce',
    aliases: ['tomatoes', 'cherry tomatoes', 'grape tomatoes', 'fresh tomato'],
  },
  { id: 'potato', name: 'Potato', category: 'produce', aliases: ['potatoes', 'russet potato', 'yukon gold'] },
  { id: 'sweet_potato', name: 'Sweet potato', category: 'produce', aliases: ['sweet potatoes', 'yam'] },
  { id: 'carrot', name: 'Carrot', category: 'produce', aliases: ['carrots'] },
  { id: 'celery', name: 'Celery', category: 'produce', aliases: [] },
  {
    id: 'bell_pepper',
    name: 'Bell pepper',
    category: 'produce',
    aliases: ['bell peppers', 'sweet pepper', 'capsicum', 'red pepper', 'green pepper'],
  },
  { id: 'broccoli', name: 'Broccoli', category: 'produce', aliases: [] },
  { id: 'zucchini', name: 'Zucchini', category: 'produce', aliases: ['courgette'] },
  { id: 'mushroom', name: 'Mushrooms', category: 'produce', aliases: ['mushroom', 'cremini', 'button mushrooms'] },
  {
    id: 'green_onion',
    name: 'Green onion',
    category: 'produce',
    aliases: ['green onions', 'scallion', 'scallions', 'spring onion', 'spring onions'],
  },
  { id: 'lemon', name: 'Lemon', category: 'produce', aliases: ['lemons'] },
  { id: 'lime', name: 'Lime', category: 'produce', aliases: ['limes'] },
  { id: 'avocado', name: 'Avocado', category: 'produce', aliases: ['avocados'] },
  { id: 'cucumber', name: 'Cucumber', category: 'produce', aliases: ['cucumbers'] },
  { id: 'green_beans', name: 'Green beans', category: 'produce', aliases: ['string beans'] },
  { id: 'peas', name: 'Peas', category: 'produce', aliases: ['frozen peas', 'green peas'] },
  { id: 'banana', name: 'Banana', category: 'produce', aliases: ['bananas'] },
  { id: 'apple', name: 'Apple', category: 'produce', aliases: ['apples'] },
  { id: 'berries', name: 'Berries', category: 'produce', aliases: ['blueberries', 'strawberries', 'raspberries'] },
  { id: 'cilantro', name: 'Cilantro', category: 'produce', aliases: ['coriander leaves'] },
  { id: 'parsley', name: 'Parsley', category: 'produce', aliases: [] },
  { id: 'basil', name: 'Basil', category: 'produce', aliases: ['fresh basil'] },
  { id: 'jalapeno', name: 'Jalapeño', category: 'produce', aliases: ['jalapeno', 'jalapenos', 'jalapeños'] },
  { id: 'ginger', name: 'Ginger', category: 'produce', aliases: ['fresh ginger', 'ginger root'] },

  // ── Proteins ───────────────────────────────────────────────
  {
    id: 'chicken',
    name: 'Chicken',
    category: 'protein',
    aliases: ['chicken breast', 'chicken thigh', 'chicken thighs', 'chicken breasts'],
  },
  { id: 'ground_beef', name: 'Ground beef', category: 'protein', aliases: ['minced beef', 'hamburger meat'] },
  { id: 'ground_turkey', name: 'Ground turkey', category: 'protein', aliases: ['minced turkey'] },
  { id: 'sausage', name: 'Sausage', category: 'protein', aliases: ['italian sausage', 'sausages'] },
  { id: 'bacon', name: 'Bacon', category: 'protein', aliases: [] },
  { id: 'shrimp', name: 'Shrimp', category: 'protein', aliases: ['prawns'] },
  { id: 'salmon', name: 'Salmon', category: 'protein', aliases: ['salmon fillet', 'salmon fillets'] },
  { id: 'canned_tuna', name: 'Canned tuna', category: 'protein', aliases: ['tuna'] },
  { id: 'eggs', name: 'Eggs', category: 'protein', aliases: ['egg'] },
  { id: 'tofu', name: 'Tofu', category: 'protein', aliases: [] },
  { id: 'black_beans', name: 'Black beans', category: 'protein', aliases: ['black bean'] },
  { id: 'kidney_beans', name: 'Kidney beans', category: 'protein', aliases: ['red kidney beans'] },
  { id: 'chickpeas', name: 'Chickpeas', category: 'protein', aliases: ['garbanzo beans', 'chickpea'] },

  // ── Dairy & eggs ───────────────────────────────────────────
  { id: 'butter', name: 'Butter', category: 'dairy', aliases: [] },
  { id: 'milk', name: 'Milk', category: 'dairy', aliases: ['whole milk'] },
  { id: 'heavy_cream', name: 'Cream', category: 'dairy', aliases: ['heavy cream', 'whipping cream', 'double cream'] },
  { id: 'sour_cream', name: 'Sour cream', category: 'dairy', aliases: [] },
  { id: 'cheddar', name: 'Cheddar', category: 'dairy', aliases: ['cheddar cheese'] },
  { id: 'mozzarella', name: 'Mozzarella', category: 'dairy', aliases: ['mozzarella cheese', 'fresh mozzarella'] },
  { id: 'parmesan', name: 'Parmesan', category: 'dairy', aliases: ['parmesan cheese', 'parmigiano'] },
  { id: 'feta', name: 'Feta', category: 'dairy', aliases: ['feta cheese'] },
  { id: 'cream_cheese', name: 'Cream cheese', category: 'dairy', aliases: [] },
  { id: 'greek_yogurt', name: 'Greek yogurt', category: 'dairy', aliases: ['plain greek yogurt'] },

  // ── Grains & pasta ─────────────────────────────────────────
  { id: 'pasta', name: 'Pasta', category: 'grain', aliases: ['spaghetti', 'penne', 'linguine', 'rigatoni', 'ziti'] },
  { id: 'rice', name: 'Rice', category: 'grain', aliases: ['white rice', 'jasmine rice', 'long-grain rice'] },
  { id: 'egg_noodles', name: 'Egg noodles', category: 'grain', aliases: [] },
  { id: 'bread', name: 'Bread', category: 'grain', aliases: ['sandwich bread', 'sourdough', 'toast'] },
  { id: 'tortillas', name: 'Tortillas', category: 'grain', aliases: ['tortilla', 'flour tortillas'] },
  { id: 'flour', name: 'Flour', category: 'grain', aliases: ['all-purpose flour', 'plain flour'] },
  { id: 'oats', name: 'Oats', category: 'grain', aliases: ['rolled oats', 'oatmeal', 'old-fashioned oats'] },

  // ── Canned & pantry ────────────────────────────────────────
  { id: 'olive_oil', name: 'Olive oil', category: 'pantry', aliases: [] },
  { id: 'vegetable_oil', name: 'Vegetable oil', category: 'pantry', aliases: ['neutral oil', 'canola oil'] },
  { id: 'water', name: 'Water', category: 'pantry', aliases: [] },
  { id: 'chicken_broth', name: 'Chicken broth', category: 'pantry', aliases: ['chicken stock'] },
  { id: 'vegetable_broth', name: 'Vegetable broth', category: 'pantry', aliases: ['vegetable stock', 'veggie broth'] },
  {
    id: 'canned_tomatoes',
    name: 'Canned tomatoes',
    category: 'pantry',
    aliases: ['diced tomatoes', 'crushed tomatoes', 'tinned tomatoes'],
  },
  { id: 'tomato_paste', name: 'Tomato paste', category: 'pantry', aliases: [] },
  { id: 'coconut_milk', name: 'Coconut milk', category: 'pantry', aliases: ['canned coconut milk'] },
  { id: 'soy_sauce', name: 'Soy sauce', category: 'pantry', aliases: [] },
  { id: 'sesame_oil', name: 'Sesame oil', category: 'pantry', aliases: ['toasted sesame oil'] },
  { id: 'honey', name: 'Honey', category: 'pantry', aliases: [] },
  { id: 'sugar', name: 'Sugar', category: 'pantry', aliases: ['granulated sugar', 'white sugar'] },
  { id: 'brown_sugar', name: 'Brown sugar', category: 'pantry', aliases: [] },
  { id: 'peanut_butter', name: 'Peanut butter', category: 'pantry', aliases: [] },
  { id: 'red_wine_vinegar', name: 'Red wine vinegar', category: 'pantry', aliases: [] },
  { id: 'balsamic_vinegar', name: 'Balsamic vinegar', category: 'pantry', aliases: ['balsamic'] },
  { id: 'salsa', name: 'Salsa', category: 'pantry', aliases: [] },
  { id: 'baking_powder', name: 'Baking powder', category: 'pantry', aliases: [] },
  { id: 'baking_soda', name: 'Baking soda', category: 'pantry', aliases: ['bicarbonate of soda'] },
  { id: 'vanilla', name: 'Vanilla extract', category: 'pantry', aliases: ['vanilla'] },
  { id: 'chocolate_chips', name: 'Chocolate chips', category: 'pantry', aliases: ['semisweet chocolate chips'] },

  // ── Spices & condiments ────────────────────────────────────
  { id: 'salt', name: 'Salt', category: 'spice', aliases: ['kosher salt'] },
  { id: 'black_pepper', name: 'Black pepper', category: 'spice', aliases: ['pepper', 'ground pepper'] },
  { id: 'garlic_powder', name: 'Garlic powder', category: 'spice', aliases: [] },
  { id: 'chili_powder', name: 'Chili powder', category: 'spice', aliases: [] },
  { id: 'cumin', name: 'Cumin', category: 'spice', aliases: ['ground cumin'] },
  { id: 'paprika', name: 'Paprika', category: 'spice', aliases: ['smoked paprika'] },
  { id: 'oregano', name: 'Oregano', category: 'spice', aliases: ['dried oregano'] },
  { id: 'thyme', name: 'Thyme', category: 'spice', aliases: ['dried thyme'] },
  { id: 'cinnamon', name: 'Cinnamon', category: 'spice', aliases: ['ground cinnamon'] },
  { id: 'curry_powder', name: 'Curry powder', category: 'spice', aliases: [] },
  {
    id: 'red_pepper_flakes',
    name: 'Red pepper flakes',
    category: 'spice',
    aliases: ['chili flakes', 'crushed red pepper'],
  },
];

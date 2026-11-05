# Round 5 (2026-10-11): six writers, 120 original recipes

Read `BRIEF.md` first. Each writer owns one empty theme file in `src/data/originals/` and writes **20** recipes from
its list, best first. Skip anything that duplicates the library (`library-titles.txt`) or another list here, and swap
in a dish of your own that fits your theme and isn't on any list.

Why these themes: the library is thin on breakfast (62 recipes), grilled (17) and fried (10) dishes, dips (9), salads
(29) and bowls (33). Many common three-ingredient picks still have no exact match, such as pasta + cheddar + broccoli,
chicken + pasta + tomato, eggs + rice + ground beef, potato + spinach + cheddar and potato + tomato + ground beef. The
dishes in parentheses below fill one of those gaps; keep those ingredients required.

## r5-comfort → `src/data/originals/comfort.ts` (`COMFORT_RECIPES`)
American comfort food and family dinners.
Broccoli Cheddar Mac and Cheese (pasta + cheddar + broccoli) · Cheeseburger Macaroni Skillet (pasta + cheddar + ground
beef) · Southern Baked Macaroni and Tomatoes (pasta + tomato + cheddar) · Chili Mac · Stuffed Shells with Spinach and
Ricotta · Twice-Baked Potatoes with Spinach and Cheddar (potato + spinach + cheddar) · Sheet-Pan Chicken, Potatoes and
Broccoli (chicken + potato + broccoli) · Roast Chicken Thighs with Buttered Potatoes (chicken + potato + butter) ·
Chicken and Tomato Penne (chicken + pasta + tomato) · Hamburger Vegetable Soup (potato + tomato + ground beef) · Cheesy
Beef and Spinach Pasta Bake (spinach + cheddar + ground beef) · Spinach and Cheddar Stuffed Chicken Breasts (chicken +
spinach + cheddar) · Chicken Divan · Tuna Noodle Casserole · Swiss Steak · Beef Tips and Gravy over Rice · Chicken
Tetrazzini · Porcupine Meatballs · Skillet Pork Chops with Potatoes and Green Beans · Ground Beef and Potato Skillet ·
Patty Melts · Baked Potato Bar with Chili and Cheddar

## r5-breakfast → `src/data/originals/breakfast.ts` (`BREAKFAST_RECIPES`)
Breakfasts and brunches.
Shakshuka · Loco Moco (eggs + rice + ground beef) · Arroz a la Cubana (eggs + rice + tomato) · Broccoli Egg Fried Rice
(eggs + rice + broccoli) · Omurice (Japanese Chicken Omelet Rice) · Migas · Biscuits and Sausage Gravy · Corned Beef
Hash with Fried Eggs · Potato and Egg Breakfast Tacos · Cheesy Grits with Fried Eggs · Croque Madame · Kedgeree ·
Chicken Congee · Broccoli and Cheddar Frittata (eggs + potato + broccoli if you add potato) · Potato, Spinach and
Cheddar Frittata · Ham and Cheese Breakfast Strata · Dutch Baby Pancake · Home Fries with Peppers and Onions · Steak and
Eggs with Crispy Potatoes · Savory Oatmeal with Spinach and a Fried Egg · Cinnamon French Toast Bake · Tomato, Egg and
Cheddar Breakfast Quesadillas (eggs + tomato + cheddar) · Black Bean and Egg Breakfast Bowls with Rice (eggs + rice +
black beans)

## r5-grill-fry → `src/data/originals/grillFry.ts` (`GRILL_FRY_RECIPES`)
Grilled and fried dishes. Every grill recipe also gives a broiler or grill-pan method; deep frying uses a heavy pot and
a thermometer, with oil temperatures in the steps.
Southern Fried Chicken · Chicken-Fried Steak with Cream Gravy · Beer-Battered Onion Rings · Hush Puppies · Tostones
(Twice-Fried Green Plantains) · Vegetable Tempura · Korean Fried Chicken · Fried Green Tomatoes · Vegetable Pakoras ·
Coconut Shrimp · Shrimp Po' Boys · Carne Asada · Garlic-Lemon Grilled Shrimp Skewers · Classic Grilled Cheeseburgers ·
Lemon-Herb Grilled Chicken Thighs · Grilled Salmon with Herb Butter · Grilled Vegetable Platter with Balsamic · Grilled
Pork Chops with Peach Salsa · Bratwurst with Peppers and Onions · Chicken Shish Tawook · Grilled BBQ Chicken Drumsticks
· Crispy Fried Catfish

## r5-soups-salads-dips → `src/data/originals/soupsSaladsDips.ts` (`SOUPS_SALADS_DIPS_RECIPES`)
Soups, salads, bowls and dips.
Chef Salad · Niçoise Salad · Wedge Salad with Blue Cheese Dressing · Asian Chicken Salad with Sesame Dressing · Black
Bean, Corn and Quinoa Salad · Broccoli Pasta Salad with Cheddar (pasta + cheddar + broccoli, cold) · Panzanella ·
Caprese Salad · Tom Kha Gai · Hot and Sour Soup · Mulligatawny Soup · Creamy Potato and Spinach Soup (potato + spinach
+ butter) · Queso Dip · French Onion Dip · Buffalo Chicken Dip · White Bean and Rosemary Dip · Tomatillo Salsa Verde ·
Muhammara · Black Bean Dip · Mediterranean Chickpea Buddha Bowls · Greek Chicken Bowls with Lemon Rice · Black Bean,
Broccoli and Rice Bowls with Lime Crema (rice + black beans + broccoli)

## r5-world → `src/data/originals/worldKitchen.ts` (`WORLD_KITCHEN_RECIPES`)
More dinners from around the world. Use ingredients a US supermarket stocks; say in `notes.md` when one needs an
international aisle.
Beef Bulgogi · Kimchi Fried Rice with Fried Eggs · General Tso's Chicken · Pupusas with Curtido · West African Peanut
Stew (Maafe) · Jamaican Rice and Peas · Oyakodon (Chicken and Egg Rice Bowl) · Gyudon (Beef and Onion Rice Bowl) ·
Arroz Caldo · Patatas Bravas · Kuku Sabzi (Persian Herb Frittata) · Pad Kra Pao (Thai Basil Chicken with a Fried Egg)
· Nasi Goreng · Gado-Gado (eggs + potato + vegetables) · Saag Aloo (potato + spinach) · Chicken Biryani · Chiles
Rellenos · Moroccan Chickpea and Vegetable Stew · Bobotie · Cuban Beef Picadillo with Potatoes (potato + tomato +
ground beef; the library has a chicken picadillo, so make the beef-and-potato version clearly different) · Feijoada
(Brazilian Black Bean and Pork Stew)

## r5-desserts-snacks → `src/data/originals/dessertsSnacks.ts` (`DESSERTS_SNACKS_RECIPES`)
Desserts, sweets, breads and snacks. Baking ratios matter: check that every formula (flour, fat, sugar, eggs,
leavening, liquid) adds up and that pan sizes fit the batter.
Pineapple Upside-Down Cake · Lemon Meringue Pie · Blondies · Coconut Macaroons · Peanut Butter Blossoms · Magic Cookie
Bars · Monkey Bread · Chocolate Lava Cakes · Molasses Crinkle Cookies · Flan · Arroz con Leche · Mango Sticky Rice ·
Fresh Strawberry Pie · Baked Apple Dumplings · Cinnamon Sugar Baked Donuts · Soft Pretzels · Garlic Knots · Popovers ·
Cheddar Chive Scones · Chewy Granola Bars · Caramel Popcorn · Chocolate Peanut Butter Energy Bites · Chocolate
Truffles

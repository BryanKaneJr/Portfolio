import { INGREDIENT_CATEGORIES, type IngredientCategory, type Recipe } from '../data/types';

/**
 * The meal plan: recipe IDs by day ("2026-10-12") and slot. Days are local calendar dates, never UTC, so a plan made
 * late in the evening lands on the day the cook sees.
 */
export const PLAN_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type PlanSlot = (typeof PLAN_SLOTS)[number];
export type DayPlan = Partial<Record<PlanSlot, string[]>>;
export type MealPlan = Record<string, DayPlan>;

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Noon local time, so adding days never trips over a daylight-saving change. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
/** The Monday that starts the week containing this day. */
export function weekStart(key: string): string {
  const day = parseDateKey(key).getDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** The slot a recipe most likely belongs in: its first of breakfast, lunch, dinner; dinner otherwise. */
export function suggestSlot(recipe: Recipe): PlanSlot {
  return PLAN_SLOTS.find(s => recipe.meals.includes(s)) ?? 'dinner';
}

export function addToPlan(plan: MealPlan, day: string, slot: PlanSlot, recipeId: string): MealPlan {
  const list = plan[day]?.[slot] ?? [];
  if (list.includes(recipeId)) return plan;
  return { ...plan, [day]: { ...plan[day], [slot]: [...list, recipeId] } };
}

export function removeFromPlan(plan: MealPlan, day: string, slot: PlanSlot, recipeId: string): MealPlan {
  const list = (plan[day]?.[slot] ?? []).filter(id => id !== recipeId);
  const dayPlan: DayPlan = { ...plan[day], [slot]: list };
  if (!list.length) delete dayPlan[slot];
  const next = { ...plan, [day]: dayPlan };
  if (!Object.keys(dayPlan).length) delete next[day];
  return next;
}

/** Drop a recipe from every day (it was deleted). */
export function removeRecipeFromPlan(plan: MealPlan, recipeId: string): MealPlan {
  let next = plan;
  for (const [day, dayPlan] of Object.entries(plan))
    for (const slot of PLAN_SLOTS)
      if (dayPlan[slot]?.includes(recipeId)) next = removeFromPlan(next, day, slot, recipeId);
  return next;
}

/** Rebuild a plan read back from storage: valid days and slots, recipes that still exist. */
export function sanitizePlan(raw: unknown, knownRecipeIds: ReadonlySet<string>): MealPlan {
  const plan: MealPlan = {};
  if (!raw || typeof raw !== 'object') return plan;
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || typeof value !== 'object') continue;
    const dayPlan: DayPlan = {};
    for (const slot of PLAN_SLOTS) {
      const ids = (value as Record<string, unknown>)[slot];
      if (!Array.isArray(ids)) continue;
      const kept = [...new Set(ids.filter((x): x is string => typeof x === 'string' && knownRecipeIds.has(x)))];
      if (kept.length) dayPlan[slot] = kept;
    }
    if (Object.keys(dayPlan).length) plan[day] = dayPlan;
  }
  return plan;
}

/** Every planned recipe on these days, once per time it's planned. */
export function plannedRecipeIds(plan: MealPlan, days: string[]): string[] {
  return days.flatMap(day => PLAN_SLOTS.flatMap(slot => plan[day]?.[slot] ?? []));
}

export type ShoppingUse = { recipeId: string; recipeTitle: string; quantityText: string; displayName: string };
export type ShoppingItem = { ingredientId: string; name: string; uses: ShoppingUse[] };
export type ShoppingGroup = { category: IngredientCategory | 'other'; items: ShoppingItem[] };

/**
 * What to buy for these days: each required ingredient of each planned recipe, minus what's on hand. Amounts aren't
 * added up (a cup and a can don't sum), so each item lists what each recipe asks for.
 */
export function shoppingList(
  plan: MealPlan,
  days: string[],
  recipeById: (id: string) => Recipe | undefined,
  onHand: ReadonlySet<string>,
  info: (ingredientId: string) => { name: string; category: IngredientCategory | 'other' },
): ShoppingGroup[] {
  const items = new Map<string, ShoppingItem & { category: IngredientCategory | 'other' }>();
  for (const recipeId of plannedRecipeIds(plan, days)) {
    const recipe = recipeById(recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      if (ing.optional || onHand.has(ing.ingredientId)) continue;
      const { name, category } = info(ing.ingredientId);
      const item = items.get(ing.ingredientId) ?? { ingredientId: ing.ingredientId, name, category, uses: [] };
      item.uses.push({
        recipeId,
        recipeTitle: recipe.title,
        quantityText: ing.quantityText,
        displayName: ing.displayName,
      });
      items.set(ing.ingredientId, item);
    }
  }
  const order = [...INGREDIENT_CATEGORIES, 'other' as const];
  return order
    .map(category => ({
      category,
      items: [...items.values()]
        .filter(i => i.category === category)
        .map(({ category: _c, ...item }) => item)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(g => g.items.length);
}

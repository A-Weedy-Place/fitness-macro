import type { AssistantIngredient, FoodItem, FoodPortion } from '../../mobile/src/types';
import { assistantFoodPortion } from '../../mobile/src/logic/assistantExecution';
import { gramsForQuantity } from '../../mobile/src/logic/portions';
import { calculateRecipe } from '../../mobile/src/logic/recipes';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
const records = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => Boolean(item)) : [];
const lower = (value: unknown) => typeof value === 'string' ? value.toLowerCase() : '';
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
function foodRecord(value: JsonRecord): value is JsonRecord & FoodItem {
  const serving = record(value.serving); const nutrition = record(value.nutrition);
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof serving?.unit === 'string' && positive(serving.gramsPerUnit) && Boolean(nutrition) && ['calories', 'protein', 'carbs', 'fat'].every((key) => typeof nutrition![key] === 'number' && Number.isFinite(nutrition![key]) && Number(nutrition![key]) >= 0);
}

export function supportsExactPortions(request: Request): boolean {
  return request.headers.get('x-weed-fitness-protocol') === '2';
}

function defaultServingPortion(food: FoodItem, portion: FoodPortion): FoodPortion {
  const grams = gramsForQuantity(food, portion.quantity, portion.unit);
  const quantity = grams / food.serving.gramsPerUnit;
  if (!positive(quantity)) throw new Error('groq_invalid_plan');
  return { foodId: food.id, quantity, unit: food.serving.unit };
}

/** APK 0.2.2 ignores quick-log item.unit; make quantity safe even if ignored. */
export function legacyFoodResolution(resolution: JsonRecord): JsonRecord {
  const foods = records(resolution.candidates).filter(foodRecord);
  const byId = new Map(foods.map((food) => [food.id, food]));
  const convert = (item: JsonRecord): JsonRecord => {
    const food = byId.get(String(item.foodId));
    if (!food || !positive(item.quantity) || typeof item.unit !== 'string') throw new Error('groq_invalid_plan');
    return { ...item, ...defaultServingPortion(food, { foodId: food.id, quantity: item.quantity, unit: item.unit }) };
  };
  const plan = record(resolution.plan);
  return { ...resolution, suggestions: records(resolution.suggestions).map(convert), plan: plan ? { ...plan, items: records(plan.items).map(convert) } : resolution.plan };
}

/**
 * APK 0.2.2 also ignores ingredient.unit when logging a reused food. Use all
 * client-supplied foods (not only the model's compact subset), stage new foods,
 * and express every known ingredient in its authoritative saved serving unit.
 * Recipe totals stay equivalent because both quantity and unit are converted.
 */
export function legacyAssistantPlan(plan: JsonRecord, context: unknown): JsonRecord {
  const foods: FoodItem[] = records(record(context)?.userFoods).filter(foodRecord);
  const actions = records(plan.actions).map((action) => {
    const portions: FoodPortion[] = [];
    const ingredients = records(action.ingredients).map((input) => {
      const ingredient = input as unknown as AssistantIngredient;
      let food = foods.find((item) => lower(item.name) === lower(ingredient.name) && lower(item.brand) === lower(ingredient.brand));
      if (!food) {
        food = { id: `legacy_food_${foods.length}`, name: ingredient.name, brand: ingredient.brand || undefined, serving: { unit: ingredient.unit, amount: 1, gramsPerUnit: ingredient.gramsPerUnit }, nutrition: { calories: ingredient.caloriesPer100g, protein: ingredient.proteinPer100g, carbs: ingredient.carbsPer100g, fat: ingredient.fatPer100g }, source: { source: 'llm', confidence: ingredient.confidence }, createdAt: '', updatedAt: '' };
        foods.push(food);
      }
      const portion = defaultServingPortion(food, assistantFoodPortion(food, ingredient));
      portions.push(portion);
      return { ...input, name: food.name, brand: food.brand || null, quantity: portion.quantity, unit: portion.unit, gramsPerUnit: food.serving.gramsPerUnit, caloriesPer100g: food.nutrition.calories, proteinPer100g: food.nutrition.protein, carbsPer100g: food.nutrition.carbs, fatPer100g: food.nutrition.fat };
    });
    if (['create_recipe', 'create_recipe_and_log'].includes(String(action.type))) {
      const calculated = calculateRecipe(portions, foods);
      const servings = Math.max(Number(action.servings) || 1, 1);
      if (!positive(calculated.finalGrams)) throw new Error('groq_invalid_plan');
      foods.push({ id: `legacy_recipe_${foods.length}`, name: String(action.name), serving: { unit: 'serving', amount: 1, gramsPerUnit: calculated.finalGrams / servings }, nutrition: calculated.per100g, source: { source: 'llm' }, createdAt: '', updatedAt: '' });
    }
    return { ...action, ingredients };
  });
  return { ...plan, actions };
}

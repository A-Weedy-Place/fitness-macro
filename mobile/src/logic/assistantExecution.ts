import type { AssistantIngredient, FoodItem, FoodPortion } from '../types';

const UNIT_ALIASES: Record<string, string> = {
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  cups: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', teaspoon: 'tsp', teaspoons: 'tsp', pieces: 'piece', slices: 'slice',
  bowls: 'bowl', plates: 'plate', servings: 'serving', litre: 'l', litres: 'l', liter: 'l', liters: 'l'
};
export function canonicalAssistantUnit(unit: string): string {
  const value = unit.trim().toLowerCase();
  return UNIT_ALIASES[value] || value;
}

/** The entry and its amount must travel together; never relabel 150 ml as 150 cups. */
export function assistantFoodPortion(food: FoodItem, ingredient: Pick<AssistantIngredient, 'quantity' | 'unit' | 'gramsPerUnit'>): FoodPortion {
  const unit = canonicalAssistantUnit(ingredient.unit);
  const storedUnit = canonicalAssistantUnit(food.serving.unit);
  if (![ingredient.quantity, ingredient.gramsPerUnit].every((value) => Number.isFinite(value) && value > 0)) throw new Error('invalid_food_portion');
  if (unit === storedUnit) return { foodId: food.id, quantity: ingredient.quantity, unit: food.serving.unit };
  if (unit === 'g' || unit === 'kg' || (unit === 'ml' && Math.abs(ingredient.gramsPerUnit - 1) < 0.0001)) return { foodId: food.id, quantity: ingredient.quantity, unit };
  // Non-default bowls/pieces and liquid densities are not represented by the
  // generic unit table. Store supplied mass rather than using a generic guess.
  return { foodId: food.id, quantity: ingredient.quantity * ingredient.gramsPerUnit, unit: 'g' };
}

const FOOD_ALIASES: Record<string, string[]> = {
  dal: ['daal', 'dhal', 'lentil', 'lentils'], daal: ['dal', 'dhal', 'lentil', 'lentils'], dhal: ['dal', 'daal', 'lentil', 'lentils'],
  mash: ['urad'], urad: ['mash'], roti: ['chapati', 'chapatti'], chapati: ['roti', 'chapatti'], chapatti: ['roti', 'chapati'],
  aloo: ['potato'], keema: ['mince', 'minced'], chai: ['tea'], bhindi: ['okra'], chana: ['chickpea', 'chickpeas'],
  palak: ['spinach'], baingan: ['eggplant', 'aubergine'], dahi: ['yogurt', 'yoghurt']
};
const STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'ate', 'for', 'from', 'had', 'i', 'in', 'it', 'log', 'me', 'my', 'of', 'on', 'one', 'please', 'some', 'the', 'this', 'to', 'today', 'two', 'was', 'with', 'ki', 'ka', 'ke', 'kiya', 'plate', 'dish', 'cooked']);
export function foodQueryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ')
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
    .flatMap((term) => [term, ...(FOOD_ALIASES[term] || [])]))];
}

import type { FoodItem } from '../types';
import { canonicalAssistantUnit } from './assistantExecution';
import { gramsPerDisplayUnit } from './portions';

/** Quick-log plates store quantities in the saved food's own serving unit. */
export function resolvedServingQuantity(food: FoodItem, quantity: number, unit: string): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(food.serving.gramsPerUnit) || food.serving.gramsPerUnit <= 0) throw new Error('The proposed food amount is invalid.');
  const requested = canonicalAssistantUnit(unit);
  const stored = canonicalAssistantUnit(food.serving.unit);
  if (requested === stored) return quantity;
  if (!['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'bowl', 'plate', 'serving'].includes(requested)) throw new Error('The proposed food unit is unsupported.');
  const grams = requested === 'l' ? 1000 : gramsPerDisplayUnit(food, requested);
  const result = quantity * grams / food.serving.gramsPerUnit;
  if (!Number.isFinite(result) || result <= 0) throw new Error('The proposed food portion cannot be converted.');
  return result;
}

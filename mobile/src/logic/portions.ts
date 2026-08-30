import { FoodItem } from '../types';

export const PORTION_UNITS = ['g', 'kg', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'bowl', 'plate', 'serving'] as const;
export type PortionUnit = (typeof PORTION_UNITS)[number] | string;

const estimatedGrams: Record<string, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  piece: 100,
  slice: 30,
  bowl: 240,
  plate: 350,
  serving: 100
};

function normalized(unit: string) {
  const value = unit.trim().toLowerCase();
  if (value === 'grams' || value === 'gram') return 'g';
  if (value === 'kilograms' || value === 'kilogram') return 'kg';
  if (value === 'milliliters' || value === 'milliliter') return 'ml';
  if (value === 'tablespoon' || value === 'tablespoons') return 'tbsp';
  if (value === 'teaspoon' || value === 'teaspoons') return 'tsp';
  return value;
}

export function unitOptions(food: FoodItem): string[] {
  return [...new Set([normalized(food.serving.unit), ...PORTION_UNITS])];
}

export function gramsPerDisplayUnit(food: FoodItem, unit: string): number {
  const value = normalized(unit);
  if (value === normalized(food.serving.unit)) return food.serving.gramsPerUnit;
  return estimatedGrams[value] || food.serving.gramsPerUnit;
}

export function gramsForQuantity(food: FoodItem, quantity: number, unit: string): number {
  return Math.max(0, quantity) * gramsPerDisplayUnit(food, unit);
}

export function servingQuantityForDisplay(food: FoodItem, quantity: number, unit: string): number {
  return gramsForQuantity(food, quantity, unit) / Math.max(food.serving.gramsPerUnit, 0.0001);
}

export function unitUsesEstimate(food: FoodItem, unit: string): boolean {
  const value = normalized(unit);
  return value !== normalized(food.serving.unit) && value !== 'g' && value !== 'kg';
}


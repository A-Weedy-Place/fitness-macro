import { FoodEntry, FoodItem } from '../types';
import { gramsForQuantity } from './portions';

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function nutritionForEntry(entry: FoodEntry, food: FoodItem): NutritionTotals {
  if (entry.nutritionSnapshot) {
    const { calories, protein, carbs, fat } = entry.nutritionSnapshot;
    return { calories, protein, carbs, fat };
  }
  // A diary item keeps the display unit selected by the owner. Never treat a
  // value entered as millilitres as if it were the food's default cup/serving.
  const grams = gramsForQuantity(food, entry.portion.quantity, entry.portion.unit);
  const scale = grams / 100;
  return {
    calories: food.nutrition.calories * scale,
    protein: food.nutrition.protein * scale,
    carbs: food.nutrition.carbs * scale,
    fat: food.nutrition.fat * scale
  };
}

export function sumNutrition(entries: FoodEntry[], foods: FoodItem[]): NutritionTotals {
  return entries.reduce<NutritionTotals>((total, entry) => {
    const food = foods.find((candidate) => candidate.id === entry.foodId);
    if (!food) return total;
    const value = nutritionForEntry(entry, food);
    return {
      calories: total.calories + value.calories,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

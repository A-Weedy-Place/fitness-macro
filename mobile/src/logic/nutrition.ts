import { FoodEntry, FoodItem } from '../types';

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function nutritionForEntry(entry: FoodEntry, food: FoodItem): NutritionTotals {
  const grams = entry.portion.quantity * food.serving.gramsPerUnit;
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

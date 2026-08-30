import { FoodItem, RecipeIngredient } from '../types';
import { gramsForQuantity } from './portions';

export function calculateRecipe(ingredients: RecipeIngredient[], foods: FoodItem[], finalWeightGrams?: number) {
  const totals = ingredients.reduce((result, item) => {
    const food = foods.find((candidate) => candidate.id === item.foodId);
    if (!food) return result;
    const grams = gramsForQuantity(food, item.quantity, item.unit);
    const scale = grams / 100;
    return {
      grams: result.grams + grams,
      calories: result.calories + food.nutrition.calories * scale,
      protein: result.protein + food.nutrition.protein * scale,
      carbs: result.carbs + food.nutrition.carbs * scale,
      fat: result.fat + food.nutrition.fat * scale
    };
  }, { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  const finalGrams = finalWeightGrams && finalWeightGrams > 0 ? finalWeightGrams : totals.grams;
  const scale = finalGrams > 0 ? 100 / finalGrams : 0;
  return {
    ...totals,
    finalGrams,
    per100g: { calories: totals.calories * scale, protein: totals.protein * scale, carbs: totals.carbs * scale, fat: totals.fat * scale }
  };
}

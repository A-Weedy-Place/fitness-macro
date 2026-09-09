import { assistantIngredientIssue } from './assistantActions';

export interface ManualFoodValues { name: string; brand?: string; servingGrams: number; calories: number; protein: number; carbs: number; fat: number }

/** The label is per serving; shared nutrition checks operate per 100 grams. */
export function manualFoodIssue(values: ManualFoodValues): string | null {
  if (![values.servingGrams, values.calories, values.protein, values.carbs, values.fat].every(Number.isFinite)) return 'Enter finite serving and nutrition values.';
  if (values.servingGrams < 0.1 || values.servingGrams > 10_000) return 'Serving weight must be between 0.1 and 10,000 grams.';
  if ([values.calories, values.protein, values.carbs, values.fat].some((value) => value < 0)) return 'Calories and macros cannot be negative.';
  const scale = 100 / values.servingGrams;
  return assistantIngredientIssue({ name: values.name, unit: 'serving', quantity: 1, gramsPerUnit: values.servingGrams, caloriesPer100g: values.calories * scale, proteinPer100g: values.protein * scale, carbsPer100g: values.carbs * scale, fatPer100g: values.fat * scale, confidence: 1 });
}

export function safeRecipeSourceUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

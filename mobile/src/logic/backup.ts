import { AppState, FoodItem, UserProfile } from '../types';
import { STARTER_FOODS } from '../data/starterFoods';

function normalize(input: Partial<AppState>): AppState {
  const foods = new Map(STARTER_FOODS.map((food) => [food.id, food]));
  if (Array.isArray(input.foods)) for (const food of input.foods) foods.set(food.id, food);
  const fallbackTime: Record<string, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00', other: '12:00' };
  return {
    version: 7,
    profile: input.profile ? { ...input.profile, onboardingComplete: input.profile.onboardingComplete ?? true } : undefined,
    foods: [...foods.values()],
    entries: Array.isArray(input.entries) ? input.entries.map((entry) => ({ ...entry, eatenAt: entry.eatenAt || fallbackTime[entry.mealType] })) : [],
    weights: Array.isArray(input.weights) ? input.weights : [],
    activities: Array.isArray(input.activities) ? input.activities : [],
    goals: Array.isArray(input.goals) ? input.goals : [],
    plans: Array.isArray(input.plans) ? input.plans.map((plan) => ({ ...plan, items: plan.items.map((item) => ({ ...item, eatenAt: item.eatenAt || fallbackTime[item.mealType] })) })) : [],
    recipes: Array.isArray(input.recipes) ? input.recipes : [],
    nutritionProgram: input.nutritionProgram
  };
}

export function createPortableBackup(state: AppState): string {
  return JSON.stringify({ format: 'fitness-macro-backup', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function restorePortableBackup(text: string): AppState {
  const parsed = JSON.parse(text) as { state?: Partial<AppState>; foodItems?: FoodItem[]; userProfile?: UserProfile } & Partial<AppState>;
  if (parsed.state) return normalize(parsed.state);
  if (parsed.foodItems) return normalize({ profile: parsed.userProfile, foods: parsed.foodItems, entries: parsed.entries, weights: parsed.weights, activities: parsed.activities, goals: parsed.goals, plans: parsed.plans });
  return normalize(parsed);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityEntry, AppState, BodyMetricLog, DailyGoal, FoodEntry, FoodItem, MealPlan, MealPlanItem, Recipe, RecipeIngredient, UserProfile } from '../types';
import { STARTER_FOODS } from '../data/starterFoods';

const KEY = 'fitness-app-state-v7';
const LEGACY_KEYS = ['fitness-app-state-v6', 'fitness-app-state-v5', 'fitness-app-state-v4', 'fitness-app-state-v3', 'fitness-app-state-v2'];
const RECOVERY_KEY = 'fitness-app-state-startup-recovery-v1';

export const EMPTY_STATE: AppState = {
  version: 7,
  foods: [...STARTER_FOODS],
  entries: [],
  weights: [],
  activities: [],
  goals: [],
  plans: [],
  recipes: []
};

const FALLBACK_TIME: Record<string, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00', other: '12:00' };

function records<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => Boolean(item) && typeof item === 'object') : [];
}

function validFood(value: FoodItem): boolean {
  return typeof value.id === 'string' && Boolean(value.id) && typeof value.name === 'string' && Boolean(value.name)
    && Boolean(value.serving) && typeof value.serving === 'object'
    && Boolean(value.nutrition) && typeof value.nutrition === 'object';
}

function normalizeEntry(value: FoodEntry): FoodEntry | null {
  if (typeof value.id !== 'string' || typeof value.date !== 'string' || typeof value.foodId !== 'string') return null;
  const mealType = value.mealType === 'breakfast' || value.mealType === 'lunch' || value.mealType === 'dinner' || value.mealType === 'snack' || value.mealType === 'other' ? value.mealType : 'other';
  const portion = value.portion && typeof value.portion === 'object' ? value.portion : { foodId: value.foodId, quantity: 1, unit: 'serving' };
  return { ...value, mealType, portion: { foodId: typeof portion.foodId === 'string' ? portion.foodId : value.foodId, quantity: Number.isFinite(Number(portion.quantity)) ? Number(portion.quantity) : 1, unit: typeof portion.unit === 'string' ? portion.unit : 'serving' }, eatenAt: typeof value.eatenAt === 'string' && value.eatenAt ? value.eatenAt : FALLBACK_TIME[mealType], enteredAt: typeof value.enteredAt === 'string' ? value.enteredAt : '' };
}

function normalizePlanItem(value: MealPlanItem): MealPlanItem | null {
  if (typeof value.id !== 'string' || typeof value.foodId !== 'string') return null;
  const mealType = value.mealType === 'breakfast' || value.mealType === 'lunch' || value.mealType === 'dinner' || value.mealType === 'snack' || value.mealType === 'other' ? value.mealType : 'other';
  const portion = value.portion && typeof value.portion === 'object' ? value.portion : { foodId: value.foodId, quantity: 1, unit: 'serving' };
  return { ...value, mealType, portion: { foodId: typeof portion.foodId === 'string' ? portion.foodId : value.foodId, quantity: Number.isFinite(Number(portion.quantity)) ? Number(portion.quantity) : 1, unit: typeof portion.unit === 'string' ? portion.unit : 'serving' }, eatenAt: typeof value.eatenAt === 'string' && value.eatenAt ? value.eatenAt : FALLBACK_TIME[mealType] };
}

function normalizePlan(value: MealPlan): MealPlan | null {
  if (typeof value.id !== 'string') return null;
  return { ...value, name: typeof value.name === 'string' && value.name ? value.name : 'Recovered plan', items: records<MealPlanItem>(value.items).map(normalizePlanItem).filter((item): item is MealPlanItem => Boolean(item)), createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '' };
}

function normalizeRecipe(value: Recipe): Recipe | null {
  if (typeof value.id !== 'string' || typeof value.foodId !== 'string') return null;
  const ingredients = records<RecipeIngredient>(value.ingredients).filter((item) => typeof item.foodId === 'string' && Number.isFinite(Number(item.quantity)) && typeof item.unit === 'string').map((item) => ({ ...item, quantity: Number(item.quantity) }));
  return { ...value, name: typeof value.name === 'string' && value.name ? value.name : 'Recovered recipe', ingredients, servings: Number.isFinite(Number(value.servings)) ? Number(value.servings) : 1, finalWeightGrams: Number.isFinite(Number(value.finalWeightGrams)) ? Number(value.finalWeightGrams) : 0, createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '' };
}

/** Normalize every collection defensively so one stale or partial legacy row
 * can never terminate the app during an upgrade. Valid owner data is retained. */
export function migrateState(value: unknown): AppState {
  const input = value && typeof value === 'object' ? value as Partial<AppState> & { version?: number } : {};
  const foods = new Map(STARTER_FOODS.map((food) => [food.id, food]));
  for (const food of records<FoodItem>(input.foods)) if (validFood(food)) foods.set(food.id, food);
  const weightsByDate = new Map<string, BodyMetricLog>();
  for (const weight of records<BodyMetricLog>(input.weights)) {
    if (typeof weight.id === 'string' && typeof weight.date === 'string' && Number.isFinite(Number(weight.weightKg))) {
      const normalized = { ...weight, weightKg: Number(weight.weightKg), enteredAt: typeof weight.enteredAt === 'string' ? weight.enteredAt : '' };
      const current = weightsByDate.get(weight.date);
      if (!current || normalized.enteredAt >= current.enteredAt) weightsByDate.set(weight.date, normalized);
    }
  }
  return {
    version: 7,
    profile: input.profile ? { ...input.profile, onboardingComplete: input.profile.onboardingComplete ?? true } : undefined,
    foods: [...foods.values()],
    entries: records<FoodEntry>(input.entries).map(normalizeEntry).filter((entry): entry is FoodEntry => Boolean(entry)),
    weights: [...weightsByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    activities: records<ActivityEntry>(input.activities).filter((item) => typeof item.id === 'string' && typeof item.date === 'string'),
    goals: records<DailyGoal>(input.goals).filter((item) => typeof item.date === 'string'),
    plans: records<MealPlan>(input.plans).map(normalizePlan).filter((plan): plan is MealPlan => Boolean(plan)),
    recipes: records<Recipe>(input.recipes).map(normalizeRecipe).filter((recipe): recipe is Recipe => Boolean(recipe)),
    nutritionProgram: input.nutritionProgram
  };
}

export async function loadState(): Promise<AppState> {
  const current = await AsyncStorage.getItem(KEY);
  const candidates: Array<{ key: string; raw: string }> = [];
  if (current) candidates.push({ key: KEY, raw: current });
  for (const key of LEGACY_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) candidates.push({ key, raw });
  }
  let preservedInvalidState = false;
  for (const candidate of candidates) {
    try {
      const state = migrateState(JSON.parse(candidate.raw));
      await saveState(state);
      return state;
    } catch (error) {
      // AsyncStorage writes are atomic, but retain any unreadable historical
      // value before allowing the owner back into the app with another copy.
      try {
        if (preservedInvalidState) continue;
        await AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify({ capturedAt: new Date().toISOString(), sourceKey: candidate.key, raw: candidate.raw, error: error instanceof Error ? error.message : String(error) }));
        preservedInvalidState = true;
      } catch {
        // Never replace an unreadable current value unless its raw bytes were
        // first preserved for a later recovery tool.
      }
    }
  }
  if (!current || preservedInvalidState) await saveState(EMPTY_STATE);
  return EMPTY_STATE;
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const next = [...items];
  const index = next.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) next[index] = item;
  else next.push(item);
  return next;
}

export function upsertFood(state: AppState, food: FoodItem): AppState {
  return { ...state, foods: upsertById(state.foods, food) };
}

export function upsertEntry(state: AppState, entry: FoodEntry): AppState {
  return { ...state, entries: upsertById(state.entries, entry) };
}

export function upsertWeight(state: AppState, weight: BodyMetricLog): AppState {
  const withoutSameDay = state.weights.filter((candidate) => candidate.date !== weight.date || candidate.id === weight.id);
  return { ...state, weights: upsertById(withoutSameDay, weight).sort((a, b) => a.date.localeCompare(b.date)) };
}

export function upsertActivity(state: AppState, activity: ActivityEntry): AppState {
  return { ...state, activities: upsertById(state.activities, activity) };
}

export function upsertGoal(state: AppState, goal: DailyGoal): AppState {
  const goals = state.goals.filter((candidate) => candidate.date !== goal.date);
  return { ...state, goals: [...goals, goal] };
}

export function upsertPlan(state: AppState, plan: MealPlan): AppState {
  return { ...state, plans: upsertById(state.plans, plan) };
}

export function upsertRecipe(state: AppState, recipe: Recipe): AppState {
  return { ...state, recipes: upsertById(state.recipes, recipe) };
}

export function removeEntry(state: AppState, id: string): AppState {
  return { ...state, entries: state.entries.filter((entry) => entry.id !== id) };
}

export function removeWeight(state: AppState, id: string): AppState {
  return { ...state, weights: state.weights.filter((weight) => weight.id !== id) };
}

export function removeActivity(state: AppState, id: string): AppState {
  return { ...state, activities: state.activities.filter((activity) => activity.id !== id) };
}

export function removePlan(state: AppState, id: string): AppState {
  return { ...state, plans: state.plans.filter((plan) => plan.id !== id) };
}

export function setProfile(state: AppState, profile: UserProfile): AppState {
  return { ...state, profile };
}

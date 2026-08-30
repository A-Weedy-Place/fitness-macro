import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityEntry, AppState, BodyMetricLog, DailyGoal, FoodEntry, FoodItem, MealPlan, PendingOperation, Recipe, UserProfile } from '../types';
import { STARTER_FOODS } from '../data/starterFoods';

const KEY = 'fitness-app-state-v5';
const LEGACY_KEYS = ['fitness-app-state-v4', 'fitness-app-state-v3', 'fitness-app-state-v2'];

export const EMPTY_STATE: AppState = {
  version: 5,
  foods: [...STARTER_FOODS],
  entries: [],
  weights: [],
  activities: [],
  goals: [],
  plans: [],
  recipes: [],
  pendingOperations: []
};

function migrate(input: Partial<AppState> & { version?: number }): AppState {
  const foods = new Map(STARTER_FOODS.map((food) => [food.id, food]));
  if (Array.isArray(input.foods)) for (const food of input.foods) foods.set(food.id, food);
  const fallbackTime: Record<string, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00', other: '12:00' };
  return {
    version: 5,
    profile: input.profile ? { ...input.profile, onboardingComplete: input.profile.onboardingComplete ?? true } : undefined,
    foods: [...foods.values()],
    entries: Array.isArray(input.entries) ? input.entries.map((entry) => ({ ...entry, eatenAt: entry.eatenAt || fallbackTime[entry.mealType] })) : [],
    weights: Array.isArray(input.weights) ? input.weights : [],
    activities: Array.isArray(input.activities) ? input.activities : [],
    goals: Array.isArray(input.goals) ? input.goals : [],
    plans: Array.isArray(input.plans) ? input.plans.map((plan) => ({ ...plan, items: plan.items.map((item) => ({ ...item, eatenAt: item.eatenAt || fallbackTime[item.mealType] })) })) : [],
    recipes: Array.isArray(input.recipes) ? input.recipes : [],
    pendingOperations: Array.isArray(input.pendingOperations) ? input.pendingOperations : [],
    lastSyncedAt: input.lastSyncedAt
  };
}

export async function loadState(): Promise<AppState> {
  const current = await AsyncStorage.getItem(KEY);
  let legacy: string | null = null;
  if (!current) {
    for (const key of LEGACY_KEYS) {
      legacy = await AsyncStorage.getItem(key);
      if (legacy) break;
    }
  }
  const state = current || legacy ? migrate(JSON.parse(current || legacy || '{}')) : EMPTY_STATE;
  await saveState(state);
  return state;
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
  return { ...state, weights: upsertById(state.weights, weight) };
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

export function enqueueOperation(state: AppState, operation: PendingOperation): AppState {
  if (state.pendingOperations.some((candidate) => candidate.id === operation.id)) return state;
  return { ...state, pendingOperations: [...state.pendingOperations, operation] };
}

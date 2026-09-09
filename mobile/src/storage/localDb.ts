import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityEntry, AppState, BodyMetricLog, DailyGoal, FoodEntry, FoodItem, MealPlan, MealPlanItem, Recipe, RecipeIngredient, UserProfile } from '../types';
import { STARTER_FOODS } from '../data/starterFoods';
import { gramsForQuantity } from '../logic/portions';
import { createDurableWriter } from './serialStore';

const KEY = 'fitness-app-state-v8';
const LEGACY_KEYS = ['fitness-app-state-v7', 'fitness-app-state-v6', 'fitness-app-state-v5', 'fitness-app-state-v4', 'fitness-app-state-v3', 'fitness-app-state-v2'];
const RECOVERY_KEY = 'fitness-app-state-startup-recovery-v1';
const RESTORE_RECOVERY_KEY = 'fitness-app-state-pre-restore-v1';
const writer = createDurableWriter(AsyncStorage);

export const EMPTY_STATE: AppState = {
  version: 8,
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
    && Boolean(value.nutrition) && typeof value.nutrition === 'object'
    && Number.isFinite(value.serving.gramsPerUnit) && value.serving.gramsPerUnit > 0
    && typeof value.serving.unit === 'string'
    && ['calories', 'protein', 'carbs', 'fat'].every((key) => Number.isFinite(value.nutrition[key as keyof typeof value.nutrition]) && Number(value.nutrition[key as keyof typeof value.nutrition]) >= 0);
}

function validSnapshot(value: FoodEntry['nutritionSnapshot']): boolean {
  return Boolean(value) && ['grams', 'calories', 'protein', 'carbs', 'fat'].every((key) => Number.isFinite(value![key as keyof NonNullable<typeof value>]) && value![key as keyof NonNullable<typeof value>] >= 0);
}

/** Freeze the nutrition that was actually logged. Existing valid snapshots are
 * preserved during upgrades and metadata edits; portion edits recapture below. */
export function snapshotEntry(entry: FoodEntry, food?: FoodItem): FoodEntry {
  if (validSnapshot(entry.nutritionSnapshot)) return entry;
  if (!food || !validFood(food)) return { ...entry, nutritionSnapshot: undefined };
  const grams = gramsForQuantity(food, entry.portion.quantity, entry.portion.unit);
  return { ...entry, nutritionSnapshot: { grams, calories: food.nutrition.calories * grams / 100, protein: food.nutrition.protein * grams / 100, carbs: food.nutrition.carbs * grams / 100, fat: food.nutrition.fat * grams / 100 } };
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
  for (const food of records<FoodItem>(input.foods)) if (validFood(food)) foods.set(food.id, { ...food, source: food.source && typeof food.source === 'object' ? food.source : { source: 'manual' } });
  const weightsByDate = new Map<string, BodyMetricLog>();
  for (const weight of records<BodyMetricLog>(input.weights)) {
    if (typeof weight.id === 'string' && typeof weight.date === 'string' && Number.isFinite(Number(weight.weightKg))) {
      const source: BodyMetricLog['source'] = weight.source === 'manual' || weight.source === 'health_connect' ? weight.source : weight.id.startsWith('health_weight_') && typeof weight.notes === 'string' && weight.notes.startsWith('Imported from Health Connect') ? 'health_connect' : 'manual';
      const normalized = { ...weight, source, weightKg: Number(weight.weightKg), enteredAt: typeof weight.enteredAt === 'string' ? weight.enteredAt : '' };
      const current = weightsByDate.get(weight.date);
      if (!current || normalized.enteredAt >= current.enteredAt) weightsByDate.set(weight.date, normalized);
    }
  }
  return {
    version: 8,
    profile: input.profile ? { ...input.profile, onboardingComplete: input.profile.onboardingComplete ?? true } : undefined,
    foods: [...foods.values()],
    entries: records<FoodEntry>(input.entries).map(normalizeEntry).filter((entry): entry is FoodEntry => Boolean(entry)).map((entry) => snapshotEntry(entry, foods.get(entry.foodId))),
    weights: [...weightsByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    activities: records<ActivityEntry>(input.activities).filter((item) => typeof item.id === 'string' && typeof item.date === 'string'),
    goals: records<DailyGoal>(input.goals).filter((item) => typeof item.date === 'string'),
    plans: records<MealPlan>(input.plans).map(normalizePlan).filter((plan): plan is MealPlan => Boolean(plan)),
    recipes: records<Recipe>(input.recipes).map(normalizeRecipe).filter((recipe): recipe is Recipe => Boolean(recipe)),
    nutritionProgram: input.nutritionProgram,
    completedFoodDays: Array.isArray(input.completedFoodDays) ? input.completedFoodDays.filter((day) => typeof day === 'string') : [],
    goalHistory: Array.isArray(input.goalHistory) ? input.goalHistory : [],
    assistantMessages: Array.isArray(input.assistantMessages) ? input.assistantMessages.filter((message) => message && typeof message.text === 'string' && (message.role === 'user' || message.role === 'assistant')) : [],
    assistantPlan: input.assistantPlan && Array.isArray(input.assistantPlan.actions) ? input.assistantPlan : null
  };
}

/** Row migration applies only to a recognized stored account. Unrelated valid
 * JSON must not be mistaken for an intentionally empty diary. */
export function decodeStoredState(raw: string): AppState {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray((value as Partial<AppState>).foods) || !Array.isArray((value as Partial<AppState>).entries)) {
    throw new Error('The stored diary is incomplete and needs recovery.');
  }
  return migrateState(value);
}

export async function loadState(): Promise<AppState> {
  let hadCandidate = false;
  let preservedInvalidState = false;
  // Do not read old keys unless needed. A damaged/oversized legacy row cannot
  // prevent a healthy current account from opening.
  for (const key of [KEY, ...LEGACY_KEYS]) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    hadCandidate = true;
    let state: AppState;
    try {
      state = decodeStoredState(raw);
    } catch (error) {
      // AsyncStorage writes are atomic, but retain any unreadable historical
      // value before allowing the owner back into the app with another copy.
      try {
        if (preservedInvalidState) continue;
        await AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify({ capturedAt: new Date().toISOString(), sourceKey: key, raw, error: error instanceof Error ? error.message : String(error) }));
        preservedInvalidState = true;
      } catch {
        // Do not continue to an older candidate: that would overwrite the
        // newest unreadable diary without a recoverable copy of its bytes.
        throw new Error('Your unreadable diary could not be backed up safely. Free some device storage and reopen the app; the original data has not been replaced.');
      }
      continue;
    }
    // A disk-write failure is not a corrupt backup. Never fall back to older
    // user data merely because storage is full or temporarily unavailable.
    await saveState(state);
    return state;
  }
  if (hadCandidate && !preservedInvalidState) throw new Error('Your unreadable diary could not be backed up safely. Free some device storage and reopen the app; the original data has not been replaced.');
  await saveState(EMPTY_STATE);
  return EMPTY_STATE;
}

export async function saveState(state: AppState): Promise<void> {
  await writer.save(KEY, state);
}

export async function preservePreRestoreState(state: AppState): Promise<void> {
  await writer.save(RESTORE_RECOVERY_KEY, { capturedAt: new Date().toISOString(), state });
}

export async function loadPreRestoreRecovery(): Promise<AppState | null> {
  await writer.settled();
  const raw = await AsyncStorage.getItem(RESTORE_RECOVERY_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { state?: unknown };
  return parsed.state ? migrateState(parsed.state) : null;
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
  const previous = state.entries.find((item) => item.id === entry.id);
  const samePortion = previous && previous.foodId === entry.foodId && previous.portion.quantity === entry.portion.quantity && previous.portion.unit === entry.portion.unit;
  const captured = snapshotEntry({ ...entry, nutritionSnapshot: samePortion ? previous.nutritionSnapshot || entry.nutritionSnapshot : previous ? undefined : entry.nutritionSnapshot }, state.foods.find((food) => food.id === entry.foodId));
  const changedDates = new Set([entry.date, previous?.date].filter(Boolean));
  return { ...state, entries: upsertById(state.entries, captured), completedFoodDays: state.completedFoodDays?.filter((day) => !changedDates.has(day)) };
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
  const date = state.entries.find((entry) => entry.id === id)?.date;
  return { ...state, entries: state.entries.filter((entry) => entry.id !== id), completedFoodDays: state.completedFoodDays?.filter((day) => day !== date) };
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

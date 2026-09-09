import { AppState } from '../types';
import { migrateState, preservePreRestoreState } from '../storage/localDb';
import { utf8Bytes } from './bytes';

const MAX_BACKUP_BYTES = 20_000_000;
const collectionNames = ['foods', 'entries', 'weights', 'activities', 'goals', 'plans', 'recipes'] as const;
type RecordValue = Record<string, unknown>;

function object(value: unknown): value is RecordValue { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function number(value: unknown, minimum = 0): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= minimum; }
function text(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()); }
function fail(message: string): never { throw new Error(`Backup not recognized: ${message}`); }
function validDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateState(value: unknown, legacy = false): asserts value is RecordValue {
  if (!object(value)) fail('the data section is not an account.');
  if (!legacy && (!Number.isInteger(value.version) || Number(value.version) < 2 || Number(value.version) > 8)) fail('unsupported or missing account version.');
  for (const name of collectionNames) {
    if (!Array.isArray(value[name])) {
      if (legacy && value[name] === undefined) { value[name] = []; continue; }
      if ((name === 'plans' || name === 'recipes') && Number(value.version) < 7 && value[name] === undefined) { value[name] = []; continue; }
      fail(`${name} must be a complete list.`);
    }
    if ((value[name] as unknown[]).some((item) => !object(item))) fail(`${name} contains an incomplete item.`);
    const rows = value[name] as RecordValue[];
    if (name !== 'goals' && (rows.some((item) => !text(item.id)) || new Set(rows.map((item) => item.id)).size !== rows.length)) fail(`${name} contains missing or duplicate IDs.`);
  }
  const foods = value.foods as RecordValue[];
  for (const food of foods) {
    if (!text(food.name) || !object(food.serving) || !text(food.serving.unit) || !number(food.serving.gramsPerUnit, Number.MIN_VALUE) || !object(food.nutrition)
      || !['calories', 'protein', 'carbs', 'fat'].every((key) => number((food.nutrition as RecordValue)[key]))) fail('a food has invalid nutrition or serving details.');
  }
  for (const entry of value.entries as RecordValue[]) {
    if (!validDate(entry.date) || !text(entry.foodId) || !object(entry.portion) || !number(entry.portion.quantity, Number.MIN_VALUE) || !text(entry.portion.unit)) fail('a diary entry has invalid date or portion details.');
    if (entry.eatenAt !== undefined && (typeof entry.eatenAt !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.eatenAt))) fail('a diary entry has an invalid time.');
    if (entry.nutritionSnapshot !== undefined && (!object(entry.nutritionSnapshot) || !['grams', 'calories', 'protein', 'carbs', 'fat'].every((key) => number((entry.nutritionSnapshot as RecordValue)[key])))) fail('a diary nutrition snapshot is invalid.');
  }
  for (const weight of value.weights as RecordValue[]) if (!validDate(weight.date) || !number(weight.weightKg, Number.MIN_VALUE)) fail('a weigh-in is invalid.');
  for (const activity of value.activities as RecordValue[]) if (!validDate(activity.date) || !text(activity.name) || !number(activity.durationMinutes) || !number(activity.caloriesEstimated)) fail('an activity is invalid.');
  for (const goal of value.goals as RecordValue[]) if (!validDate(goal.date) || !['calories', 'protein', 'carbs', 'fat'].every((key) => number(goal[key]))) fail('a daily target is invalid.');
  for (const plan of value.plans as RecordValue[]) if (!text(plan.name) || !Array.isArray(plan.items) || plan.items.some((item) => !object(item) || !text(item.id) || !text(item.foodId) || !object(item.portion) || !number(item.portion.quantity, Number.MIN_VALUE) || !text(item.portion.unit))) fail('a saved day is incomplete.');
  for (const recipe of value.recipes as RecordValue[]) if (!text(recipe.name) || !text(recipe.foodId) || !number(recipe.servings, Number.MIN_VALUE) || !number(recipe.finalWeightGrams, Number.MIN_VALUE) || !Array.isArray(recipe.ingredients) || recipe.ingredients.some((item) => !object(item) || !text(item.foodId) || !number(item.quantity, Number.MIN_VALUE) || !text(item.unit))) fail('a recipe is incomplete.');
  if (value.profile !== undefined && (!object(value.profile) || !number(value.profile.bodyWeightKg, Number.MIN_VALUE) || !number(value.profile.heightCm, Number.MIN_VALUE) || !number(value.profile.ageYears, Number.MIN_VALUE) || !number(value.profile.activityFactor, Number.MIN_VALUE) || !['male', 'female', 'other'].includes(String(value.profile.sex)))) fail('the profile is incomplete.');
  for (const name of ['assistantMessages', 'completedFoodDays', 'goalHistory']) if (value[name] !== undefined && !Array.isArray(value[name])) fail(`${name} must be a list.`);
  if (Array.isArray(value.assistantMessages) && value.assistantMessages.some((message) => !object(message) || !text(message.id) || !text(message.text) || !['user', 'assistant'].includes(String(message.role)))) fail('conversation history is invalid.');
  if (Array.isArray(value.completedFoodDays) && value.completedFoodDays.some((date) => !validDate(date))) fail('a completed-food date is invalid.');
  if (Array.isArray(value.goalHistory) && value.goalHistory.some((goal) => !object(goal) || !validDate(goal.effectiveFrom) || !['calories', 'protein', 'carbs', 'fat'].every((key) => number(goal[key])))) fail('target history is invalid.');
  if (value.assistantPlan != null && (!object(value.assistantPlan) || !Array.isArray(value.assistantPlan.actions) || typeof value.assistantPlan.reply !== 'string')) fail('the pending assistant action is invalid.');
}

export interface BackupPreview {
  state: AppState;
  counts: { foods: number; entries: number; recipes: number; weights: number; activities: number };
  warnings: string[];
}

export function createPortableBackup(state: AppState): string {
  return JSON.stringify({ format: 'fitness-macro-backup', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function restorePortableBackup(text: string): AppState {
  return previewPortableBackup(text).state;
}

export function previewPortableBackup(text: string): BackupPreview {
  if (utf8Bytes(text) > MAX_BACKUP_BYTES) fail('file is larger than the 20 MB import limit.');
  const parsed: unknown = JSON.parse(text);
  if (!object(parsed)) fail('this is not a Weed Fitness backup.');
  let source: unknown = parsed;
  let legacy = false;
  if (parsed.state !== undefined) {
    if (parsed.format !== 'fitness-macro-backup') fail('unknown backup format.');
    source = parsed.state;
  } else if (Array.isArray(parsed.foodItems)) {
    legacy = true;
    source = { version: 2, profile: parsed.userProfile, foods: parsed.foodItems, entries: parsed.entries, weights: parsed.weights, activities: parsed.activities, goals: parsed.goals, plans: parsed.plans, recipes: parsed.recipes };
  }
  validateState(source, legacy);
  const state = migrateState(source);
  const knownFoods = new Set(state.foods.map((food) => food.id));
  if (state.entries.some((entry) => !knownFoods.has(entry.foodId)) || state.recipes.some((recipe) => !knownFoods.has(recipe.foodId) || recipe.ingredients.some((ingredient) => !knownFoods.has(ingredient.foodId))) || state.plans.some((plan) => plan.items.some((item) => !knownFoods.has(item.foodId)))) fail('food records needed by the diary or recipes are missing.');
  const warnings: string[] = [];
  const hasLocalImages = state.foods.some((food) => food.imageUri && !food.imageUri.startsWith('data:image/')) || Boolean(state.profile?.profilePhotoUri && !state.profile.profilePhotoUri.startsWith('data:image/'));
  if (hasLocalImages) warnings.push('This older backup contains device-only photo paths; those photos may not transfer to another phone.');
  if (!state.entries.length && !state.weights.length && !state.profile) warnings.push('This is an empty account. Importing it replaces your current diary.');
  return { state, counts: { foods: state.foods.length, entries: state.entries.length, recipes: state.recipes.length, weights: state.weights.length, activities: state.activities.length }, warnings };
}

/** Validate first, then retain an exact local rollback copy before replacement.
 * Caller still awaits saveState(next) before publishing the imported account. */
export async function prepareBackupRestore(text: string, currentState: AppState, preserve: (state: AppState) => Promise<void> = preservePreRestoreState): Promise<AppState> {
  const next = restorePortableBackup(text);
  await preserve(currentState);
  return next;
}

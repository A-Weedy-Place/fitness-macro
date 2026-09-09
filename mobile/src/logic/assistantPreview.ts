import type { AppState, AssistantAction, FoodItem } from '../types';
import { assistantFoodPortion } from './assistantExecution';
import { assistantActionDomainIssue, assistantActionIssue } from './assistantActions';
import { gramsForQuantity } from './portions';
import { calculateRecipe } from './recipes';

const invalidMessage = 'This saved proposal is incomplete. Discard it and ask the assistant to prepare it again.';
const text = (value: unknown, max = 300): string => typeof value === 'string' ? value.slice(0, max) : '';
const numeric = (value: number): string => String(Number(value.toPrecision(10)));
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export interface AssistantPreviewAction { type: string; summary: string; details: string[] }
export interface AssistantPlanPreview { actions: AssistantPreviewAction[]; notes: string[]; valid: boolean; hasPlan: boolean }

function buildActionDetails(action: AssistantAction, state: AppState, defaultDate: string, stagedFoods: FoodItem[]): string[] {
  const issue = assistantActionDomainIssue(action, state.profile);
  if (issue) throw new Error(issue);
  if (action.sourceUrl != null) {
    if (typeof action.sourceUrl !== 'string' || action.sourceUrl.length > 2048) throw new Error('the recipe reference is invalid');
    const reference = new URL(action.sourceUrl);
    if (reference.protocol !== 'https:' || reference.hostname !== 'en.wikibooks.org' || reference.pathname !== '/w/index.php' || !reference.searchParams.get('title')?.startsWith('Cookbook:') || !/^\d+$/.test(reference.searchParams.get('oldid') || '') || action.sourceLicense !== 'CC BY-SA 4.0') throw new Error('the recipe reference is invalid');
  }
  const lines: string[] = [];
  if (action.date || action.time || ['log_foods', 'create_recipe_and_log', 'log_weight', 'log_activity'].includes(action.type)) lines.push(`${action.date || defaultDate}${action.time ? ` · ${action.time}` : ''}`);
  const entry = state.entries.find(item => item.id === action.targetId);
  if (entry) lines.push(`${stagedFoods.find(food => food.id === entry.foodId)?.name || 'Diary entry'} · ${numeric(entry.portion.quantity)} ${entry.portion.unit} · from ${entry.date} ${entry.eatenAt || ''}`);
  if (action.name) lines.push(action.name);
  let batchCalories = 0;
  const recipeIngredients: Array<{ foodId: string; quantity: number; unit: string }> = [];
  for (const ingredient of action.ingredients || []) {
    const existing = stagedFoods.find(item => item.name.toLowerCase() === ingredient.name.toLowerCase() && (item.brand || '').toLowerCase() === (ingredient.brand || '').toLowerCase());
    const food = existing || { id: `preview_food_${stagedFoods.length}`, name: ingredient.name, brand: ingredient.brand || undefined, serving: { unit: ingredient.unit, amount: 1, gramsPerUnit: ingredient.gramsPerUnit }, nutrition: { calories: ingredient.caloriesPer100g, protein: ingredient.proteinPer100g, carbs: ingredient.carbsPer100g, fat: ingredient.fatPer100g }, createdAt: '', updatedAt: '', source: { source: 'llm' as const, confidence: ingredient.confidence } };
    if (!existing) stagedFoods.push(food);
    const portion = assistantFoodPortion(food, ingredient);
    recipeIngredients.push(portion);
    const grams = gramsForQuantity(food, portion.quantity, portion.unit);
    const calories = grams * food.nutrition.calories / 100;
    if (!Number.isFinite(grams) || !Number.isFinite(calories) || grams <= 0 || calories < 0) throw new Error('the saved food amount is invalid');
    batchCalories += calories;
    const converted = portion.quantity !== ingredient.quantity || portion.unit !== ingredient.unit;
    lines.push(`${numeric(ingredient.quantity)} ${ingredient.unit} ${food.name}${food.brand ? ` (${food.brand})` : ''}${converted ? ` → ${numeric(portion.quantity)} ${portion.unit}` : ''} · ${numeric(grams)} g · ${Math.round(calories)} kcal${existing ? ' (saved food)' : ' (estimate)'}`);
  }
  if (action.type.startsWith('create_recipe')) {
    // Match the actual executor's existing min-one-serving normalization.
    const servings = Math.max(action.servings || 1, 1);
    const calculation = calculateRecipe(recipeIngredients, stagedFoods);
    if (!Number.isFinite(calculation.finalGrams) || calculation.finalGrams <= 0) throw new Error('the recipe has no usable weight');
    stagedFoods.push({ id: `preview_recipe_${stagedFoods.length}`, name: action.name!, serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / servings }, nutrition: calculation.per100g, tags: ['recipe'], source: { source: 'llm', confidence: action.confidence }, createdAt: '', updatedAt: '' });
    lines.push(`Batch makes ${numeric(servings)} servings · ${Math.round(batchCalories)} kcal total · ${Math.round(batchCalories / servings)} kcal per serving. Ingredient calories above describe the whole batch.`);
    if (action.type === 'create_recipe_and_log') lines.push(`Log ${numeric(action.quantity || 1)} servings · ${Math.round(batchCalories / servings * (action.quantity || 1))} kcal.`);
  }
  if (action.type === 'log_weight') lines.push(`${action.value} kg · replaces any existing weight for this day`);
  if (action.type === 'set_goal') lines.push(`${action.calories} kcal · ${action.protein}g protein · ${action.carbs}g carbs · ${action.fat}g fat`);
  if (action.type === 'log_activity') lines.push(`${action.durationMinutes} minutes · ${action.calories == null ? 'estimated energy' : `${action.calories} kcal`}`);
  if (action.sourceUrl) { lines.push(`Recipe reference: ${text(action.sourceName) || 'Wikibooks contributors'} · ${action.sourceLicense} · nutrition remains estimated`); lines.push(action.sourceUrl); }
  return lines;
}

/** Unknown persisted values never escape into render-time string/array calls. */
export function assistantActionDetails(action: unknown, state: AppState, defaultDate: string): string[] {
  try {
    if (!record(action)) return [invalidMessage];
    return buildActionDetails(action as unknown as AssistantAction, state, defaultDate, [...state.foods]);
  } catch { return [invalidMessage]; }
}

/** Preview stages new foods just like Apply, without mutating the live state. */
export function assistantPlanPreview(plan: unknown, state: AppState, defaultDate: string): AssistantPlanPreview {
  if (plan == null) return { actions: [], notes: [], valid: false, hasPlan: false };
  const invalid = { actions: [], notes: [invalidMessage], valid: false, hasPlan: true };
  try {
    if (!record(plan) || !Array.isArray(plan.actions) || !plan.actions.length || plan.actions.length > 8 || !Array.isArray(plan.notes)) return invalid;
    const stagedFoods = [...state.foods];
    const actions: AssistantPreviewAction[] = [];
    for (const value of plan.actions) {
      if (!record(value) || typeof value.type !== 'string' || typeof value.summary !== 'string') return invalid;
      const action = value as unknown as AssistantAction;
      if (assistantActionIssue(action, state, defaultDate)) return invalid;
      actions.push({ type: action.type, summary: text(action.summary, 600), details: buildActionDetails(action, state, defaultDate, stagedFoods) });
    }
    return { actions, notes: plan.notes.filter((note): note is string => typeof note === 'string').slice(0, 8).map((note) => text(note, 700)), valid: true, hasPlan: true };
  } catch { return invalid; }
}

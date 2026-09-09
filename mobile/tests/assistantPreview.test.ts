import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantActionDetails, assistantPlanPreview } from '../src/logic/assistantPreview';
import { assistantFoodPortion } from '../src/logic/assistantExecution';
import { gramsForQuantity } from '../src/logic/portions';
import type { AppState, AssistantAction, FoodItem } from '../src/types';

const milk: FoodItem = { id: 'milk', name: 'Milk', serving: { unit: 'cup', amount: 1, gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3.3, carbs: 4.8, fat: 2 }, source: { source: 'manual', confidence: 1 }, createdAt: '', updatedAt: '' };
const ingredient = { name: 'Milk', brand: null, quantity: 150, unit: 'ml', gramsPerUnit: 1, caloriesPer100g: 50, proteinPer100g: 3.3, carbsPer100g: 4.8, fatPer100g: 2, confidence: 0.8 };
const action: AssistantAction = { type: 'log_foods', summary: 'Log milk', confidence: 0.9, targetId: null, date: '2026-09-09', time: '13:30', name: null, value: null, quantity: null, servings: null, durationMinutes: null, calories: null, protein: null, carbs: null, fat: null, displayName: null, targetWeightKg: null, activityFactor: null, goalMode: null, goalIntensity: null, targetDate: null, destination: null, ingredients: [ingredient] };
const state = { foods: [milk], entries: [], weights: [], activities: [], plans: [], recipes: [] } as unknown as AppState;
const plan = (actions = [action]) => ({ actions, notes: [], reply: 'Review', requiresConfirmation: true });

test('malformed stored proposals and ingredients return repair state instead of crashing render', () => {
  const invalid = [1, 'old plan', {}, { actions: null }, { actions: {}, notes: [] }, { actions: [null], notes: [] }, { actions: [{ ...action, ingredients: {} }], notes: [] }, { actions: [{ ...action, ingredients: [null] }], notes: [] }, { actions: [{ ...action, name: {} }], notes: [] }, { actions: [action], notes: {} }];
  for (const value of invalid) {
    const preview = assistantPlanPreview(value, state, '2026-09-09');
    assert.equal(preview.valid, false); assert.equal(preview.hasPlan, true); assert.match(preview.notes.join(' '), /incomplete/);
    assert.doesNotThrow(() => assistantActionDetails(value, state, '2026-09-09'));
  }
  assert.equal(assistantPlanPreview(null, state, '2026-09-09').hasPlan, false);
  assert.equal(assistantPlanPreview(plan(), { ...state, foods: null } as unknown as AppState, '2026-09-09').valid, false);
});

test('preview matches applied millilitres and supplied spoon/density overrides', () => {
  for (const serving of [{ quantity: 150, unit: 'ml', gramsPerUnit: 1 }, { quantity: 150, unit: 'ml', gramsPerUnit: 1.03 }, { quantity: 2, unit: 'tbsp', gramsPerUnit: 14 }]) {
    const item = { ...ingredient, ...serving };
    const portion = assistantFoodPortion(milk, item);
    const grams = gramsForQuantity(milk, portion.quantity, portion.unit);
    const calories = Math.round(grams * milk.nutrition.calories / 100);
    const details = assistantActionDetails({ ...action, ingredients: [item] }, state, '2026-09-09').join('\n');
    assert.ok(details.includes(`${calories} kcal`)); assert.ok(details.includes(`${grams} g`));
    if (portion.unit === 'g') assert.ok(details.includes(`→ ${portion.quantity} g`));
  }
  assert.match(assistantActionDetails(action, state, '2026-09-09').join('\n'), /75 kcal/);
});

test('saved default-unit nutrition overrides model guesses in preview exactly as in Apply', () => {
  const item = { ...ingredient, quantity: 2, unit: 'cups', gramsPerUnit: 300, caloriesPer100g: 80 };
  const details = assistantActionDetails({ ...action, ingredients: [item] }, state, '2026-09-09').join('\n');
  assert.match(details, /488 g · 244 kcal/);
  assert.doesNotMatch(details, /480 kcal/);
});

test('whole-batch and logged-portion totals are separate and source metadata is explicit', () => {
  const dish: AssistantAction = { ...action, type: 'create_recipe_and_log', name: 'Milk drink', servings: 3, quantity: 2, sourceName: 'Adapted from Cookbook:Milk drink, Wikibooks contributors; nutrition estimated', sourceUrl: 'https://en.wikibooks.org/w/index.php?title=Cookbook%3AMilk_drink&oldid=123', sourceLicense: 'CC BY-SA 4.0' };
  const details = assistantActionDetails(dish, state, '2026-09-09').join('\n');
  assert.match(details, /75 kcal total · 25 kcal per serving/); assert.match(details, /Log 2 servings · 50 kcal/);
  assert.ok(details.includes(dish.sourceUrl!)); assert.match(details, /CC BY-SA 4.0 · nutrition remains estimated/);
  assert.equal(assistantPlanPreview(plan([{ ...dish, sourceUrl: 'javascript:alert(1)' }]), state, '2026-09-09').valid, false);
});

test('staged new ingredients and dishes are reused across actions without mutating live state', () => {
  const first = { ...action, ingredients: [{ ...ingredient, name: 'Test food', unit: 'serving', quantity: 1, gramsPerUnit: 100, caloriesPer100g: 100 }] };
  const second = { ...first, ingredients: [{ ...first.ingredients[0], caloriesPer100g: 300 }] };
  const before = JSON.stringify(state);
  const preview = assistantPlanPreview(plan([first, second]), state, '2026-09-09');
  assert.equal(preview.valid, true); assert.match(preview.actions[1].details.join('\n'), /100 kcal/); assert.doesNotMatch(preview.actions[1].details.join('\n'), /300 kcal/);
  const create = { ...action, type: 'create_recipe_and_log', name: 'Milk dish', servings: 3, quantity: 1 } as AssistantAction;
  const log = { ...action, ingredients: [{ ...ingredient, name: 'Milk dish', unit: 'serving', quantity: 2, gramsPerUnit: 100, caloriesPer100g: 400 }] };
  const withDish = assistantPlanPreview(plan([create, log]), state, '2026-09-09');
  assert.equal(withDish.valid, true); assert.match(withDish.actions[1].details.join('\n'), /100 g · 50 kcal/);
  assert.equal(JSON.stringify(state), before);
});

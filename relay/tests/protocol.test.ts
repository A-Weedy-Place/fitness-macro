import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index';
import { legacyAssistantPlan, legacyFoodResolution, supportsExactPortions } from '../src/protocol';
import { assistantFoodPortion } from '../../mobile/src/logic/assistantExecution';
import { gramsForQuantity } from '../../mobile/src/logic/portions';
import { calculateRecipe } from '../../mobile/src/logic/recipes';
import type { AssistantAction, FoodItem } from '../../mobile/src/types';

const milk: FoodItem = { id: 'milk', name: 'Milk', serving: { unit: 'cup', amount: 1, gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3.3, carbs: 4.8, fat: 2 }, source: { source: 'manual', confidence: 1 }, createdAt: '', updatedAt: '' };
const ingredient = { name: 'Milk', brand: null, quantity: 150, unit: 'ml', gramsPerUnit: 1, caloriesPer100g: 50, proteinPer100g: 3.3, carbsPer100g: 4.8, fatPer100g: 2, confidence: 0.8 };
const action: AssistantAction = { type: 'log_foods', summary: 'Log milk', confidence: 0.9, targetId: null, date: '2026-09-09', time: '13:30', name: null, value: null, quantity: null, servings: null, durationMinutes: null, calories: null, protein: null, carbs: null, fat: null, displayName: null, targetWeightKg: null, activityFactor: null, goalMode: null, goalIntensity: null, targetDate: null, destination: null, ingredients: [ingredient] };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} does not equal ${expected}`);
const makeRequest = (path: string, body: unknown, version?: string) => new Request(`https://relay.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fitnessmacro-app-token': 'test', ...(version ? { 'x-weed-fitness-protocol': version } : {}) }, body: JSON.stringify(body) });
const env = { APP_ACCESS_TOKEN: 'test', GROQ_API_KEY: 'test' };

test('exact unit support is explicitly opted in and preflight permits the header', async () => {
  assert.equal(supportsExactPortions(makeRequest('/v1/assistant/plan', {})), false);
  assert.equal(supportsExactPortions(makeRequest('/v1/assistant/plan', {}, '2')), true);
  assert.equal(supportsExactPortions(makeRequest('/v1/assistant/plan', {}, 'unknown')), false);
  const response = await worker.fetch(new Request('https://relay.test/v1/assistant/plan', { method: 'OPTIONS' }), env);
  assert.match(response.headers.get('access-control-allow-headers') || '', /x-weed-fitness-protocol/);
});

test('legacy quick-log quantities stay safe even when installed APK ignores unit', async () => {
  const original = globalThis.fetch;
  const output = { intent: 'log_foods', title: 'Milk', summary: 'Milk', dishName: null, dishServings: 1, logServings: 1, logDate: '2026-09-09', eatenAt: '13:30', clarification: null, foods: [{ ...ingredient, existingFoodId: 'milk', quantity: 2, unit: 'tbsp', gramsPerUnit: 14, sourceUrl: null }], notes: [] };
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
  try {
    for (const version of [undefined, '2']) {
      const response = await worker.fetch(makeRequest('/v1/agent/command', { transcript: 'Milk', defaultDate: '2026-09-09', defaultTime: '13:30', context: { userFoods: [milk] } }, version), env);
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      const item = body.plan.items[0];
      assert.equal(item.unit, version === '2' ? 'g' : 'cup');
      assert.equal(body.suggestions[0].quantity, item.quantity); assert.equal(body.suggestions[0].unit, item.unit);
      const grams = version === '2' ? gramsForQuantity(milk, item.quantity, item.unit) : item.quantity * milk.serving.gramsPerUnit;
      close(grams, 28); close(grams * milk.nutrition.calories / 100, 14);
    }
  } finally { globalThis.fetch = original; }
});

test('legacy and exact-unit main assistant both log the same150ml, not150cups', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ actions: [action], notes: [], reply: 'Ready', requiresConfirmation: true }) } }] });
  try {
    for (const version of [undefined, '2']) {
      const response = await worker.fetch(makeRequest('/v1/assistant/plan', { command: 'Log150ml Milk', context: { userFoods: [milk] } }, version), env);
      assert.equal(response.status, 200);
      const body = await response.json() as { actions: AssistantAction[] };
      const item = body.actions[0].ingredients[0];
      assert.equal(item.unit, version === '2' ? 'ml' : 'cup');
      const portion = assistantFoodPortion(milk, item);
      const grams = version === '2' ? gramsForQuantity(milk, portion.quantity, portion.unit) : item.quantity * milk.serving.gramsPerUnit;
      close(grams, 150); close(grams * milk.nutrition.calories / 100, 75);
    }
  } finally { globalThis.fetch = original; }
});

test('legacy recipe ingredients retain equivalent nutrition and full supplied food context', () => {
  const recipe = { ...action, type: 'create_recipe_and_log', name: 'Milk drink', servings: 2, quantity: 1 };
  const output = legacyAssistantPlan({ actions: [recipe], notes: [] }, { userFoods: [milk] });
  const item = (output.actions as AssistantAction[])[0].ingredients[0];
  assert.equal(item.unit, 'cup'); assert.equal(item.gramsPerUnit, 244);
  const calculation = calculateRecipe([{ foodId: milk.id, quantity: item.quantity, unit: item.unit }], [milk]);
  close(calculation.grams, 150); close(calculation.calories / 2, 37.5);
  const input = { candidates: [milk], suggestions: [{ foodId: 'milk', quantity: 150, unit: 'ml' }], plan: { items: [{ foodId: 'milk', quantity: 150, unit: 'ml' }] } };
  const legacy = legacyFoodResolution(input) as any;
  close(legacy.plan.items[0].quantity * 244, 150); assert.equal(input.plan.items[0].unit, 'ml');
});

test('legacy assistant conversion preserves authoritative same-unit servings and stages new food reuse', () => {
  const sameUnit = { ...action, ingredients: [{ ...ingredient, quantity: 2, unit: 'cups', gramsPerUnit: 999 }] };
  const normalized = legacyAssistantPlan({ actions: [sameUnit] }, { userFoods: [milk] }).actions as AssistantAction[];
  assert.equal(normalized[0].ingredients[0].quantity, 2); assert.equal(normalized[0].ingredients[0].gramsPerUnit, 244);
  const first = { ...action, ingredients: [{ ...ingredient, name: 'New milk', quantity: 1, unit: 'cup', gramsPerUnit: 244 }] };
  const later = { ...action, ingredients: [{ ...ingredient, name: 'New milk' }] };
  const staged = legacyAssistantPlan({ actions: [first, later] }, { userFoods: [] }).actions as AssistantAction[];
  assert.equal(staged[1].ingredients[0].unit, 'cup'); close(staged[1].ingredients[0].quantity * 244, 150);
});

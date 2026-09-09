import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { enforceAssistantPlan, requestedTimes, resolveEntryId, withRecipeReferences } from '../src/index';
import { compactAppContext } from '../src/compactContext';
import { consumeRouteBudget, retryAfterSeconds, routeBucket } from '../src/rateLimits';
import { extractReferenceIngredients, lookupRecipeReference, referenceTitleMatches } from '../src/recipeReferences';
import { assistantActionDomainIssue, validAssistantDate } from '../../mobile/src/logic/assistantActions';
import { assistantFoodPortion } from '../../mobile/src/logic/assistantExecution';
import type { AssistantAction, FoodItem } from '../../mobile/src/types';

const ingredient = { name: 'Milk', brand: null, quantity: 150, unit: 'ml', gramsPerUnit: 1, caloriesPer100g: 50, proteinPer100g: 3.3, carbsPer100g: 4.8, fatPer100g: 2, confidence: 0.8 };
const action: AssistantAction = { type: 'log_foods', summary: 'Log milk', confidence: 0.9, targetId: null, date: '2026-09-09', time: '13:30', name: null, value: null, quantity: null, servings: null, durationMinutes: null, calories: null, protein: null, carbs: null, fat: null, displayName: null, targetWeightKg: null, activityFactor: null, goalMode: null, goalIntensity: null, targetDate: null, destination: null, ingredients: [ingredient] };
const milk: FoodItem = { id: 'milk', name: 'Milk', serving: { unit: 'cup', amount: 1, gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3.3, carbs: 4.8, fat: 2 }, source: { source: 'manual', confidence: 1 }, createdAt: '', updatedAt: '' };
const proposal = (actions = [action]) => ({ reply: 'Ready', requiresConfirmation: true, notes: [], actions });

test('AM/PM spans are not reinterpreted as additional 24-hour times', () => {
  assert.deepEqual(requestedTimes('Log biryani at 1:30 pm'), ['13:30']);
  assert.deepEqual(requestedTimes('Log milk at 12:30 a.m. and tea at 9 am'), ['00:30', '09:00']);
  assert.deepEqual(requestedTimes('Log tea at 09:00 and Coke at 13:30'), ['09:00', '13:30']);
  assert.doesNotThrow(() => enforceAssistantPlan(proposal(), {}, 'Log milk at 1:30 pm'));
  assert.throws(() => enforceAssistantPlan(proposal(), {}, 'Log tea at 09:00 and milk at 13:30'), /incomplete_plan/);
});
test('AI portions preserve ml and explicit mass for non-default units', () => {
  assert.deepEqual(assistantFoodPortion(milk, ingredient), { foodId: 'milk', quantity: 150, unit: 'ml' });
  assert.deepEqual(assistantFoodPortion(milk, { quantity: 2, unit: 'cups', gramsPerUnit: 244 }), { foodId: 'milk', quantity: 2, unit: 'cup' });
  assert.deepEqual(assistantFoodPortion(milk, { quantity: 2, unit: 'tbsp', gramsPerUnit: 14 }), { foodId: 'milk', quantity: 28, unit: 'g' });
});
test('existing saved dish is logged without recreating it and brand nutrition is respected', () => {
  const dish = { ...milk, name: 'Cold milk coffee', tags: ['recipe'], serving: { ...milk.serving, unit: 'serving' } };
  const duplicate = { ...action, type: 'create_recipe_and_log', name: dish.name, servings: 1, quantity: 2 } as AssistantAction;
  const reused = enforceAssistantPlan(proposal([duplicate]), { userFoods: [dish] }, 'Log two cold milk coffees').actions as AssistantAction[];
  assert.equal(reused[0].type, 'log_foods'); assert.equal(reused[0].ingredients[0].quantity, 2); assert.equal(reused[0].ingredients[0].name, dish.name);
  const branded = { ...action, ingredients: [{ ...ingredient, brand: 'Brand A' }] };
  const brandPlan = enforceAssistantPlan(proposal([branded]), { userFoods: [{ ...milk, brand: 'Brand A', nutrition: { ...milk.nutrition, calories: 80 } }, { ...milk, id: 'other', brand: 'Brand B', nutrition: { ...milk.nutrition, calories: 60 } }] }, 'Log Brand A milk').actions as AssistantAction[];
  assert.equal(brandPlan[0].ingredients[0].caloriesPer100g, 80); assert.equal(brandPlan[0].ingredients[0].brand, 'Brand A');
});
test('domain validation rejects impossible dates, times, unsafe goals and empty recipe portions', () => {
  assert.equal(validAssistantDate('2026-02-30'), false);
  assert.equal(validAssistantDate('2024-02-29'), true);
  for (const update of [{ date: '2026-02-30' }, { time: '25:00' }, { type: 'set_goal', calories: 1, protein: 1, carbs: 0, fat: 0 }, { type: 'create_recipe_and_log', name: 'Milk drink', servings: -1, quantity: 1 }, { type: 'log_weight', value: 0.2 }, { type: 'update_profile', activityFactor: 100 }]) {
    assert.ok(assistantActionDomainIssue({ ...action, ...update } as AssistantAction));
  }
  assert.equal(assistantActionDomainIssue({ ...action, type: 'set_goal', calories: 2000, protein: 120, carbs: 245, fat: 60 }), null);
  assert.ok(assistantActionDomainIssue({ ...action, ingredients: [{ ...ingredient, proteinPer100g: 999 }] }));
});
test('context retains actual day, selected diary day, bounded follow-up history and regional aliases', () => {
  const context = compactAppContext('Log mash ke daal', { currentDate: '2026-09-09', selectedDiaryDate: '2026-09-08', history: Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'milk '.repeat(800) })), userFoods: [{ id: 'urad', name: 'Urad dal' }], entries: [] });
  assert.equal(context.currentDate, '2026-09-09'); assert.equal(context.selectedDiaryDate, '2026-09-08');
  assert.equal((context.userFoods as Array<{ id: string }>)[0].id, 'urad');
  const history = context.history as Array<{ text: string }>;
  assert.ok(history.length <= 6); assert.ok(history.reduce((sum, item) => sum + item.text.length, 0) <= 3000);
});
test('move-by-name searches source date, not destination date', () => {
  assert.equal(resolveEntryId({ ...action, type: 'change_entry_time', targetId: null, name: 'black coffee', date: '2026-09-09' }, { entries: [{ id: 'coffee_yesterday', foodName: 'Coffee, black', date: '2026-09-08' }] }, 'Move yesterday black coffee to today'), 'coffee_yesterday');
});
test('route counters isolate status and catalogue traffic from reasoning and give retry times', async () => {
  assert.equal(routeBucket('/v1/assistant/plan'), 'reasoning'); assert.equal(routeBucket('/v1/agent/status'), 'status');
  const now = 100_000_000;
  for (let i = 0; i < 601; i++) await consumeRouteBudget('status', undefined, now);
  assert.equal((await consumeRouteBudget('reasoning', undefined, now)).allowed, true);
  assert.equal((await consumeRouteBudget('status', undefined, now)).allowed, false);
  assert.equal(retryAfterSeconds('23'), 23); assert.equal(retryAfterSeconds(null), 60);
});
test('upstream non-JSON rate-limit errors retain the actual code and Retry-After', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('provider busy', { status: 429, headers: { 'retry-after': '32' } }); };
  try {
    const response = await worker.fetch(new Request('https://relay.test/v1/assistant/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fitnessmacro-app-token': 'test' }, body: JSON.stringify({ command: 'Log milk', context: {} }) }), { APP_ACCESS_TOKEN: 'test', GROQ_API_KEY: 'test' });
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '32');
    assert.deepEqual(await response.json(), { error: 'groq_free_limit_reached', retryAfterSeconds: 32 }); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('reference parsing matches dish names and preserves source attribution without verified macros', async () => {
  assert.equal(referenceTitleMatches('mash ki dal', 'Cookbook:Urad Dal'), true);
  assert.equal(referenceTitleMatches('Chicken biryani', 'Cookbook:Chocolate Cake'), false);
  assert.deepEqual(extractReferenceIngredients('== Ingredients ==\n* 1 cup [[rice]]\n* 1 tbsp [[Oil|oil]]\n== Procedure ==\nDo not copy instructions.'), ['1 cup rice', '1 tbsp oil']);
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    return Response.json(url.searchParams.has('list') ? { query: { search: [{ title: 'Cookbook:Biryani', pageid: 123 }] } } : { query: { pages: [{ pageid: 123, title: 'Cookbook:Biryani', revisions: [{ revid: 456, slots: { main: { content: '== Ingredients ==\n* 200 g rice\n* 1 tbsp oil\n== Method ==\nCook.' } } }] }] } });
  };
  try {
    const reference = await lookupRecipeReference('Biryani');
    assert.ok(reference); assert.equal(reference.nutritionVerified, false); assert.equal(reference.license, 'CC BY-SA 4.0'); assert.match(reference.url, /oldid=456/);
    const dish = { ...action, type: 'create_recipe_and_log', name: 'Biryani', servings: 2, quantity: 1, ingredients: [{ ...ingredient, name: 'Rice' }, { ...ingredient, name: 'Oil' }] } as AssistantAction;
    const enriched = withRecipeReferences(proposal([dish]), [reference]);
    assert.match((enriched.actions as AssistantAction[])[0].sourceName!, /nutrition estimated/);
    assert.equal((withRecipeReferences(proposal([dish]), []).actions as AssistantAction[])[0].sourceUrl, undefined);
  } finally { globalThis.fetch = original; }
});

test('correction and reference enrichment share one extra model call, never a third', async () => {
  const original = globalThis.fetch;
  let modelCalls = 0;
  const dish = { ...action, type: 'create_recipe_and_log', name: 'Biryani', servings: 2, quantity: 1, ingredients: [{ ...ingredient, name: 'Rice' }, { ...ingredient, name: 'Oil' }] } as AssistantAction;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.groq.com') {
      modelCalls++;
      return Response.json({ choices: [{ message: { content: JSON.stringify(proposal([modelCalls === 1 ? { ...dish, ingredients: [] } : dish])) } }] });
    }
    return Response.json(url.searchParams.has('list') ? { query: { search: [{ title: 'Cookbook:Biryani', pageid: 123 }] } } : { query: { pages: [{ pageid: 123, title: 'Cookbook:Biryani', revisions: [{ revid: 456, slots: { main: { content: '== Ingredients ==\n* 200 g rice\n* 1 tbsp oil\n== Method ==\nCook.' } } }] }] } });
  };
  try {
    const response = await worker.fetch(new Request('https://relay.test/v1/assistant/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fitnessmacro-app-token': 'test' }, body: JSON.stringify({ command: 'Make and log Biryani', context: {} }) }), { APP_ACCESS_TOKEN: 'test', GROQ_API_KEY: 'test' });
    assert.equal(response.status, 200); assert.equal(modelCalls, 2);
    const result = await response.json() as { actions: AssistantAction[] };
    assert.match(result.actions[0].sourceUrl || '', /en.wikibooks.org/);
  } finally { globalThis.fetch = original; }
});

test('quick-log resolution converts a non-default spoon to explicit grams and ignores model citations', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ intent: 'log_foods', title: 'Milk', summary: 'Milk', dishName: null, dishServings: 1, logServings: 1, logDate: '2026-09-09', eatenAt: '13:30', clarification: null, foods: [{ ...ingredient, existingFoodId: 'milk', quantity: 2, unit: 'tbsp', gramsPerUnit: 14, sourceUrl: 'https://fake.invalid/made-up' }], notes: [] }) } }] });
  try {
    const response = await worker.fetch(new Request('https://relay.test/v1/agent/command', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fitnessmacro-app-token': 'test' }, body: JSON.stringify({ transcript: 'Milk', defaultDate: '2026-09-09', defaultTime: '13:30', context: { userFoods: [milk] } }) }), { APP_ACCESS_TOKEN: 'test', GROQ_API_KEY: 'test' });
    assert.equal(response.status, 200);
    const result = await response.json() as { suggestions: Array<{ quantity: number; unit: string; sourceUrl?: string }> };
    assert.equal(result.suggestions[0].quantity, 28); assert.equal(result.suggestions[0].unit, 'g'); assert.equal(result.suggestions[0].sourceUrl, undefined);
  } finally { globalThis.fetch = original; }
});

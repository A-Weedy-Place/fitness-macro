import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAssistantPlan } from '../src/services/ai/planner';
import { plannerHarness } from './helpers/plannerHarness';
import { assistantPlanSchema, foodResolutionSchema, nutritionAdviceSchema } from '../src/services/ai/schemas';
import { recoverNullableGeneration } from '../src/services/ai/structuredRecovery';

const ingredient = { name: 'Milk', brand: null, quantity: 150, unit: 'ml', gramsPerUnit: 1, caloriesPer100g: 50, proteinPer100g: 3.3, carbsPer100g: 5, fatPer100g: 2, confidence: 0.9 };
const action = { type: 'log_foods', summary: 'Log milk', confidence: 0.9, ingredients: [ingredient], date: '2026-09-09', time: '08:00' };
const plan = () => ({ reply: 'Ready', requiresConfirmation: true, notes: [], actions: [structuredClone(action)] });
const failure = (value: unknown) => ({ error: { code: 'json_validate_failed', failed_generation: JSON.stringify(value) } });

test('only omitted nullable schema fields are restored; portions and all existing values stay exact', () => {
  const input = plan();
  const recovered = recoverNullableGeneration(400, failure(input), assistantPlanSchema);
  assert.ok(recovered); assert.ok(recovered.repaired > 0);
  const output = recovered.value as typeof input & { actions: Array<Record<string, unknown>> };
  assert.equal(output.actions[0].targetWeightKg, null);
  assert.deepEqual(output.actions[0].ingredients, input.actions[0].ingredients);
  assert.equal('targetWeightKg' in input.actions[0], false);
  assert.doesNotThrow(() => enforceAssistantPlan(output, {}, 'Log 150 ml milk at 08:00'));
  assert.equal(recoverNullableGeneration(400, failure(output), assistantPlanSchema), null, 'not a general repair for other validation failures');
});

test('full schema validation rejects missing meaningful data, invalid types, enums, additional fields and array bounds', () => {
  for (const mutate of [
    (value: any) => { delete value.actions[0].ingredients; },
    (value: any) => { delete value.actions[0].ingredients[0].quantity; },
    (value: any) => { value.actions[0].ingredients[0].quantity = '150'; },
    (value: any) => { value.actions[0].type = 'invent_action'; },
    (value: any) => { value.actions[0].unexpected = true; },
    (value: any) => { value.actions[0].goalMode = 'extreme'; },
    (value: any) => { value.actions = Array.from({ length: 9 }, () => value.actions[0]); },
    (value: any) => { value.actions[0].ingredients = Array.from({ length: 21 }, () => ingredient); },
    (value: any) => { delete value.requiresConfirmation; }
  ]) {
    const input = plan(); mutate(input);
    assert.equal(recoverNullableGeneration(400, failure(input), assistantPlanSchema), null);
  }
  assert.equal(recoverNullableGeneration(400, failure(plan()), { ...assistantPlanSchema, unknownValidation: 1 }), null);
  assert.equal(recoverNullableGeneration(400, failure({ summary: 'x', actions: [], cautions: [], meals: [] }), nutritionAdviceSchema), null);
});

test('recovery is narrowly gated, bounded before JSON parsing and covers food nullable fields', () => {
  assert.equal(recoverNullableGeneration(429, failure(plan()), assistantPlanSchema), null);
  assert.equal(recoverNullableGeneration(400, { error: { code: 'invalid_json_schema', failed_generation: JSON.stringify(plan()) } }, assistantPlanSchema), null);
  assert.equal(recoverNullableGeneration(400, { error: { code: 'json_validate_failed', failed_generation: '{' } }, assistantPlanSchema), null);
  const oversized = { ...plan(), reply: '🍃'.repeat(9000) };
  assert.equal(recoverNullableGeneration(400, failure(oversized), assistantPlanSchema), null);
  const food = { intent: 'log_foods', title: 'Milk', summary: 'Milk', dishServings: 1, logServings: 1, foods: [ingredient], notes: [] };
  assert.ok(recoverNullableGeneration(400, failure(food), foodResolutionSchema));
});

test('schema-valid recovery still rejects unsafe goals, dates and nutrition through domain checks', () => {
  for (const update of [
    { date: '2026-02-30' }, { time: '25:00' },
    { type: 'set_goal', calories: 1, protein: 1, carbs: 0, fat: 0 },
    { ingredients: [{ ...ingredient, proteinPer100g: 900 }] }
  ]) {
    const input = plan(); Object.assign(input.actions[0], update);
    const recovered = recoverNullableGeneration(400, failure(input), assistantPlanSchema);
    assert.ok(recovered);
    assert.throws(() => enforceAssistantPlan(recovered.value as Record<string, unknown>, {}, 'Log milk'), /invalid_plan/);
  }
});

test('direct Groq400 nullable recovery needs one call; unsafe recovery cannot bypass the two-call correction ceiling', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let unsafe = false;
  globalThis.fetch = async () => {
    calls++;
    const input = plan();
    if (unsafe) input.actions[0].ingredients[0].proteinPer100g = 900;
    return Response.json(failure(input), { status: 400 });
  };
  const request = () => plannerHarness.fetch(new Request('https://direct-planner.test/v1/assistant/plan', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'Log 150 ml milk at 08:00', context: { currentDate: '2026-09-09', userFoods: [] } })
  }), { apiKey: 'synthetic-test-credential' });
  try {
    const response = await request();
    assert.equal(response.status, 200); assert.equal(calls, 1);
    const output = await response.json() as { actions: Array<{ ingredients: typeof ingredient[] }> };
    assert.equal(output.actions[0].ingredients[0].quantity, 150); assert.equal(output.actions[0].ingredients[0].unit, 'ml');
    unsafe = true; calls = 0;
    const rejected = await request();
    assert.equal(rejected.status, 502); assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('saved-food empty ingredients receive a specific correction reason without inventing a missing portion', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const input = JSON.parse(String(options?.body));
    assert.match(input.messages[0].content, /ingredients MUST contain one complete ingredient record per food, including saved foods/);
    assert.match(input.messages[0].content, /Emit every required JSON key/);
    if (calls === 2) assert.match(input.messages[1].content, /Correction required: groq_invalid_plan: the food ingredients are missing/);
    const output = plan();
    if (calls === 1) output.actions[0].ingredients = [];
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
  };
  try {
    const response = await plannerHarness.fetch(new Request('https://direct-planner.test/v1/assistant/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'Log 150 ml milk at 08:00', context: { currentDate: '2026-09-09', userFoods: [] } })
    }), { apiKey: 'synthetic-test-credential' });
    assert.equal(response.status, 200); assert.equal(calls, 2);
    const output = await response.json() as { actions: Array<{ ingredients: typeof ingredient[] }> };
    assert.equal(output.actions[0].ingredients[0].quantity, 150); assert.equal(output.actions[0].ingredients[0].unit, 'ml');
  } finally { globalThis.fetch = originalFetch; }
});

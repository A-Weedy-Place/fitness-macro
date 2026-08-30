import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CustomFoodSchema, MealPlanSchema } from '../src/contracts.js';
import { estimateTdee, mifflinStJeor, recommendDailyGoal } from '../src/logic/tdee.js';
import { estimateStravaCalories } from '../src/integrations/strava.js';
import { mapFoodAgentResult } from '../src/providers/foodAgent.js';
import { compactAppContext } from '../src/providers/appContext.js';
import { groqStatus } from '../src/providers/groqJson.js';
import { enforceAppPlan } from '../src/providers/appAgent.js';

test('agent validates custom foods and reusable plans', () => {
  const food = CustomFoodSchema.parse({ clientId: 'food_1', name: 'Roti', serving: { unit: 'piece', amount: 1, gramsPerUnit: 45 }, nutrition: { calories: 260, protein: 8, carbs: 50, fat: 3 } });
  assert.equal(food.serving.gramsPerUnit, 45);
  const plan = MealPlanSchema.parse({ clientId: 'plan_1', name: 'Simple day', items: [{ clientId: 'item_1', mealType: 'breakfast', foodId: 'food_1', portion: { foodId: 'food_1', quantity: 2, unit: 'piece' } }] });
  assert.equal(plan.items.length, 1);
});

test('agent and mobile target formula produces expected values', () => {
  const profile = { id: 'p', sex: 'female' as const, ageYears: 35, heightCm: 165, bodyWeightKg: 65, activityFactor: 1.4, weeklyWeightChangeKg: -0.25, createdAt: '', updatedAt: '' };
  const bmr = mifflinStJeor(profile);
  assert.equal(bmr, 1345);
  assert.equal(estimateTdee(bmr, 1.4), 1883);
  assert.equal(recommendDailyGoal(profile, '2026-08-07').calories, 1608);
});

test('JSON store migrates to schema 5 and deletes idempotently', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fitness-agent-test-'));
  process.env.AGENT_DATA_DIR = directory;
  try {
    const { createDbAccessor } = await import(`../src/storage/db.js?test=${Date.now()}`);
    const db = createDbAccessor();
    assert.equal(db.getSnapshot().version, 5);
    const entry = { id: 'entry_1', date: '2026-08-07', mealType: 'lunch' as const, foodId: 'food_1', portion: { foodId: 'food_1', quantity: 100, unit: 'g' }, enteredAt: '2026-08-07T00:00:00Z', source: { source: 'manual' as const } };
    db.addEntry(entry);
    assert.equal(db.listEntries('2026-08-07').length, 1);
    assert.equal(db.deleteEntry(entry.id), true);
    assert.equal(db.deleteEntry(entry.id), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Strava calorie fallback uses activity-specific estimates', () => {
  assert.equal(estimateStravaCalories({ sport_type: 'Run', moving_time: 3600, distance: 10_000 }, 75), 750);
  assert.equal(estimateStravaCalories({ sport_type: 'Ride', moving_time: 3600 }, 75), 600);
  assert.equal(estimateStravaCalories({ sport_type: 'Walk', moving_time: 1800, calories: 123 }, 75), 123);
});

test('assistant context keeps relevant foods without sending full history', () => {
  const entries = Array.from({ length: 500 }, (_, index) => ({ id: `entry_${index}`, date: index > 475 ? '2026-08-30' : '2026-08-01', foodName: `Food ${index}` }));
  const userFoods = Array.from({ length: 150 }, (_, index) => ({ id: `food_${index}`, name: index === 93 ? 'Plain paratha' : `Unrelated food ${index}` }));
  const recipes = Array.from({ length: 80 }, (_, index) => ({ id: `recipe_${index}`, name: index === 31 ? 'Aloo keema' : `Recipe ${index}` }));
  const compact = compactAppContext('I ate one paratha and a plate of aloo keema', { currentDate: '2026-08-30', entries, userFoods, recipes });
  const compactFoods = compact.userFoods as Array<{ name: string }>;
  const compactRecipes = compact.recipes as Array<{ name: string }>;
  assert.equal(compactFoods.some((food) => food.name === 'Plain paratha'), true);
  assert.equal(compactRecipes.some((recipe) => recipe.name === 'Aloo keema'), true);
  assert.ok((compact.entries as unknown[]).length <= 32);
  assert.ok(JSON.stringify(compact).length <= 10_000);
});

test('Groq integration is explicitly free-tier-only and has no paid tools', () => {
  const status = groqStatus();
  assert.equal(status.freeTierOnly, true);
  assert.equal(status.paidToolsEnabled, false);
});

test('food-agent plans reuse a saved cookbook food ID instead of duplicating it', () => {
  const saved = {
    id: 'recipe_food_aloo_keema', name: 'Aloo keema', serving: { unit: 'plate', amount: 1, gramsPerUnit: 350 },
    nutrition: { calories: 155, protein: 9, carbs: 12, fat: 8 }, tags: ['recipe'],
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', source: { source: 'manual', confidence: 1 }
  };
  const result = mapFoodAgentResult('one plate aloo keema', '2026-08-30', '12:00', {
    intent: 'log_foods', title: 'Log aloo keema', summary: 'One saved plate', dishName: null,
    dishServings: 1, logServings: 1, logDate: null, eatenAt: null, clarification: null, notes: [],
    foods: [{ existingFoodId: saved.id, name: saved.name, brand: null, quantity: 1, unit: 'plate', gramsPerUnit: 350, caloriesPer100g: 155, proteinPer100g: 9, carbsPer100g: 12, fatPer100g: 8, confidence: 1, sourceUrl: null }]
  }, 'groq-resolved', { userFoods: [saved] });
  assert.equal(result.candidates[0].id, saved.id);
  assert.equal(result.plan?.items[0].foodId, saved.id);
});

test('Groq app plans require confirmation and preserve saved nutrition', () => {
  const plan = enforceAppPlan({
    reply: 'Logged your breakfast.', requiresConfirmation: false, notes: [],
    actions: [{
      type: 'log_foods', summary: 'Log breakfast', confidence: 1, targetId: null, date: '2026-08-30', time: '08:30', name: null,
      value: null, quantity: null, servings: null, durationMinutes: null, calories: null, protein: null, carbs: null, fat: null,
      displayName: null, targetWeightKg: null, activityFactor: null, goalMode: null, goalIntensity: null, targetDate: null, destination: null,
      ingredients: [{ name: 'Plain paratha', brand: null, quantity: 1, unit: 'piece', gramsPerUnit: 95, caloriesPer100g: 999, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, confidence: 0.5 }]
    }]
  }, { userFoods: [{ name: 'Plain paratha', serving: { unit: 'piece', gramsPerUnit: 90 }, nutrition: { calories: 326, protein: 7.2, carbs: 45, fat: 13 }, source: { confidence: 0.9 } }] });
  assert.equal(plan.requiresConfirmation, true);
  assert.match(plan.reply, /Confirm to save/);
  assert.equal(plan.actions[0].ingredients[0].caloriesPer100g, 326);
  assert.equal(plan.actions[0].ingredients[0].gramsPerUnit, 90);
});

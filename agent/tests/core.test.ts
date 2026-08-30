import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CustomFoodSchema, MealPlanSchema } from '../src/contracts.js';
import { estimateTdee, mifflinStJeor, recommendDailyGoal } from '../src/logic/tdee.js';
import { estimateStravaCalories } from '../src/integrations/strava.js';
import { codexResolverStatus } from '../src/providers/codexFoodResolver.js';

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

test('Codex resolver is opt-in and reports its execution boundary', () => {
  const previous = process.env.CODEX_FOOD_RESOLVER_ENABLED;
  process.env.CODEX_FOOD_RESOLVER_ENABLED = 'false';
  assert.equal(codexResolverStatus().enabled, false);
  assert.equal(codexResolverStatus().busy, false);
  if (previous === undefined) delete process.env.CODEX_FOOD_RESOLVER_ENABLED;
  else process.env.CODEX_FOOD_RESOLVER_ENABLED = previous;
});

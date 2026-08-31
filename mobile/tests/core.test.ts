import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySeries, buildWeightSeries, calculateInsights, dateWindow } from '../src/logic/analytics';
import { nutritionForEntry, sumNutrition } from '../src/logic/nutrition';
import { buildPlanFromDay, instantiatePlan } from '../src/logic/plans';
import { estimateTdee, mifflinStJeor, recommendDailyGoal } from '../src/logic/tdee';
import { weeklyChangeForGoal } from '../src/logic/goals';
import { createPortableBackup, restorePortableBackup } from '../src/logic/backup';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../src/logic/units';
import { estimateActivityCalories } from '../src/logic/activityEnergy';
import { mealForTime } from '../src/logic/time';
import { calculateRecipe } from '../src/logic/recipes';
import { estimateAdaptiveExpenditure } from '../src/logic/expenditure';
import { dateFor, startOfWeekMonday } from '../src/utils/dates';
import { EMPTY_STATE, upsertWeight } from '../src/storage/localDb';
import { BodyMetricLog, FoodEntry, FoodItem, UserProfile } from '../src/types';

const food: FoodItem = {
  id: 'food_1',
  name: 'Test daal',
  serving: { unit: 'g', amount: 100, gramsPerUnit: 1 },
  nutrition: { calories: 200, protein: 20, carbs: 30, fat: 4 },
  source: { source: 'manual', confidence: 1 },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
};

function entry(id: string, date: string, quantity = 100): FoodEntry {
  return {
    id,
    date,
    mealType: 'lunch',
    foodId: food.id,
    portion: { foodId: food.id, quantity, unit: 'g' },
    enteredAt: `${date}T12:00:00.000Z`,
    source: { source: 'manual', confidence: 1 }
  };
}

test('nutrition scales portions through grams per unit', () => {
  const value = nutritionForEntry(entry('entry_1', '2026-08-07', 150), food);
  assert.equal(value.calories, 300);
  assert.equal(value.protein, 30);
  assert.deepEqual(sumNutrition([entry('a', '2026-08-07'), entry('b', '2026-08-07', 50)], [food]), value);
});

test('packet servings use serving weight before per-100g nutrition', () => {
  const packet = { ...food, serving: { unit: 'serving', amount: 1, gramsPerUnit: 30 } };
  const twoServings = { ...entry('packet', '2026-08-07', 2), portion: { foodId: food.id, quantity: 2, unit: 'serving' } };
  const value = nutritionForEntry(twoServings, packet);
  assert.equal(value.calories, 120);
  assert.equal(value.protein, 12);
});

test('TDEE and macro targets are deterministic and adjustment is bounded', () => {
  const profile: UserProfile = {
    id: 'profile', sex: 'male', ageYears: 30, heightCm: 175, bodyWeightKg: 75,
    targetWeightKg: 70, activityFactor: 1.4, weeklyWeightChangeKg: -0.25,
    createdAt: '', updatedAt: ''
  };
  const bmr = mifflinStJeor(profile);
  assert.equal(bmr, 1699);
  assert.equal(estimateTdee(bmr, profile.activityFactor), 2379);
  const goal = recommendDailyGoal(profile, '2026-08-07');
  assert.equal(goal.calories, 2104);
  assert.equal(goal.protein, 135);
  assert.equal(goal.fat, 60);
  assert.equal(goal.carbs, 256);
});

test('daily analytics calculates adherence, streak, activity and weight change', () => {
  const entries = [entry('one', '2026-08-06'), entry('two', '2026-08-07')];
  const series = buildDailySeries({
    endDate: '2026-08-07', days: 3, entries, foods: [food], profile: undefined,
    activities: [{ id: 'run', date: '2026-08-07', name: 'Run', source: 'manual', type: 'run', durationMinutes: 30, caloriesEstimated: 250, createdAt: '' }],
    goals: [
      { date: '2026-08-06', calories: 200, protein: 20, carbs: 30, fat: 4 },
      { date: '2026-08-07', calories: 400, protein: 40, carbs: 60, fat: 8 }
    ]
  });
  const weights: BodyMetricLog[] = [
    { id: 'w1', date: '2026-08-06', weightKg: 80, enteredAt: '2026-08-06T08:00:00Z' },
    { id: 'w2', date: '2026-08-07', weightKg: 79.5, enteredAt: '2026-08-07T08:00:00Z' }
  ];
  const insights = calculateInsights(series, weights, '2026-08-07');
  assert.deepEqual(dateWindow('2026-08-07', 3), ['2026-08-05', '2026-08-06', '2026-08-07']);
  assert.equal(insights.loggedDays, 2);
  assert.equal(insights.streak, 2);
  assert.equal(insights.averageCalories, 200);
  assert.equal(insights.calorieAdherencePercent, 50);
  assert.equal(insights.proteinHitPercent, 50);
  assert.equal(insights.activityMinutes, 30);
  assert.equal(insights.weightChangeKg, -0.5);
  assert.equal(buildWeightSeries(weights, '2026-08-07', 30)[1].secondary, 79.75);
});

test('food plans preserve portions and create fresh diary IDs', () => {
  let itemIndex = 0;
  const built = buildPlanFromDay({
    id: 'plan_1', name: 'Training day', entries: [entry('old_entry', '2026-08-06')],
    now: '2026-08-07T00:00:00Z', makeItemId: () => `item_${++itemIndex}`
  });
  assert.equal(built.plan.items[0].portion.quantity, 100);
  assert.equal(built.payload.clientId, 'plan_1');
  const applied = instantiatePlan({ plan: built.plan, date: '2026-08-10', now: '2026-08-10T08:00:00Z', makeEntryId: () => 'new_entry' });
  assert.equal(applied[0].id, 'new_entry');
  assert.equal(applied[0].date, '2026-08-10');
  assert.equal(applied[0].foodId, food.id);
});

test('goal pace is derived from deadline and capped by body weight', () => {
  const weekly = weeklyChangeForGoal({ bodyWeightKg: 75, targetWeightKg: 60, targetDate: '2026-09-01', goalMode: 'lose', goalIntensity: 'aggressive' }, new Date('2026-08-01T12:00:00Z'));
  assert.equal(weekly, -0.75);
});

test('portable backup migrates to schema 7 without connection data', () => {
  const state = restorePortableBackup(createPortableBackup({ version: 7, foods: [food], entries: [entry('backup', '2026-08-07')], weights: [], activities: [], goals: [], plans: [], recipes: [] }));
  assert.equal(state.version, 7);
  assert.equal(state.entries[0].eatenAt, '13:00');
});

test('one weigh-in is retained per calendar day, with the latest replacing the first', () => {
  const first = { id: 'weight_1', date: '2026-08-30', weightKg: 82, enteredAt: '2026-08-30T07:00:00Z' };
  const replacement = { id: 'weight_2', date: '2026-08-30', weightKg: 81.7, enteredAt: '2026-08-30T20:00:00Z' };
  const state = upsertWeight(upsertWeight(EMPTY_STATE, first), replacement);
  assert.deepEqual(state.weights, [replacement]);
});

test('display units round-trip to canonical metric storage', () => {
  const imperial = cmToFeetInches(175);
  assert.equal(imperial.feet, 5);
  assert.ok(Math.abs(feetInchesToCm(imperial.feet, imperial.inches) - 175) < 0.2);
  assert.ok(Math.abs(lbToKg(kgToLb(92.8)) - 92.8) < 0.001);
});

test('time categories and activity energy are inferred without user calorie input', () => {
  assert.equal(mealForTime('08:30'), 'breakfast');
  assert.equal(mealForTime('13:15'), 'lunch');
  assert.equal(mealForTime('20:00'), 'dinner');
  assert.equal(estimateActivityCalories('Walk', 30, 92.8).calories, 171);
});

test('diary dates use the chosen local calendar and Monday-starting weeks', () => {
  assert.equal(dateFor(new Date('2026-08-30T20:15:00.000Z'), 'Asia/Karachi'), '2026-08-31');
  assert.equal(startOfWeekMonday('2026-08-30'), '2026-08-24');
  assert.equal(startOfWeekMonday('2026-08-31'), '2026-08-31');
});

test('recipe nutrition accounts for ingredient mass and final cooked weight', () => {
  const value = calculateRecipe([{ foodId: food.id, quantity: 200, unit: 'g' }], [food], 150);
  assert.equal(value.calories, 400);
  assert.equal(Math.round(value.per100g.calories), 267);
});

test('adaptive expenditure combines logged intake with weight direction', () => {
  const series = Array.from({ length: 14 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, label: '', calories: 2200, protein: 100, carbs: 200, fat: 70, activityCalories: 0, activityMinutes: 0, logged: true }));
  const weights = [{ id: 'start', date: '2026-08-01', weightKg: 90, enteredAt: '' }, { id: 'end', date: '2026-08-14', weightKg: 89.5, enteredAt: '' }];
  const result = estimateAdaptiveExpenditure(series, weights, 2500);
  assert.equal(result.status, 'updating');
  assert.ok(result.estimate >= 2450 && result.estimate <= 2550);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvedServingQuantity } from '../src/logic/resolvedPortions';
import { nutritionForEntry } from '../src/logic/nutrition';
import { calculateRecipe } from '../src/logic/recipes';
import { FoodItem } from '../src/types';

const milk: FoodItem = { id: 'milk', name: 'Milk', serving: { unit: 'cup', amount: 1, gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3.3, carbs: 4.8, fat: 2 }, source: { source: 'manual' }, createdAt: '', updatedAt: '' };
function resolvedEntry(quantity: number, unit: string) {
  return { id: 'entry', date: '2026-09-09', mealType: 'snack' as const, foodId: milk.id, portion: { foodId: milk.id, quantity: resolvedServingQuantity(milk, quantity, unit), unit: milk.serving.unit }, enteredAt: '', source: { source: 'llm' as const } };
}

test('legacy quick-log 150 ml of saved cup-based milk stays 75 calories', () => {
  const entry = resolvedEntry(150, 'ml');
  assert.equal(entry.portion.unit, 'cup');
  assert.equal(entry.portion.quantity, 150 / 244);
  assert.equal(nutritionForEntry(entry, milk).calories, 75);
});

test('repeated same-food plan items keep their separate quantities', () => {
  const items = [{ foodId: milk.id, quantity: 150, unit: 'ml' }, { foodId: milk.id, quantity: 2, unit: 'cup' }];
  const converted = items.map((item) => resolvedEntry(item.quantity, item.unit));
  assert.deepEqual(converted.map((entry) => nutritionForEntry(entry, milk).calories), [75, 244]);
});

test('recipe preview in serving quantities agrees with exact-unit ingredient totals', () => {
  const quantity = resolvedServingQuantity(milk, 150, 'g');
  const exact = calculateRecipe([{ foodId: milk.id, quantity: 150, unit: 'g' }], [milk]);
  const preview = calculateRecipe([{ foodId: milk.id, quantity, unit: 'cup' }], [milk]);
  assert.deepEqual(preview, exact);
});

test('litres and plural aliases are converted, while invalid portions fail closed', () => {
  assert.ok(Math.abs(nutritionForEntry(resolvedEntry(1, 'litres'), milk).calories - 500) < 1e-8);
  assert.equal(resolvedServingQuantity(milk, 2, 'cups'), 2);
  for (const quantity of [NaN, Infinity, 0, -1]) assert.throws(() => resolvedServingQuantity(milk, quantity, 'ml'), /invalid/);
  assert.throws(() => resolvedServingQuantity(milk, 1, 'bucket'), /unsupported/);
});

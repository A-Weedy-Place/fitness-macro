import test from 'node:test';
import assert from 'node:assert/strict';
import { manualFoodIssue, safeRecipeSourceUrl } from '../src/logic/manualInput';

const milk = { name: 'Milk', servingGrams: 244, calories: 122, protein: 8, carbs: 12, fat: 5 };
test('manual labels validate their per-serving values through shared per-100g checks', () => {
  assert.equal(manualFoodIssue(milk), null);
  assert.equal(manualFoodIssue({ name: 'Water', servingGrams: 250, calories: 0, protein: 0, carbs: 0, fat: 0 }), null);
});
test('negative, nonfinite and unreasonable manual labels cannot enter the catalogue', () => {
  for (const key of ['calories', 'protein', 'carbs', 'fat'] as const) {
    assert.match(manualFoodIssue({ ...milk, [key]: -1 }) || '', /negative/);
    assert.match(manualFoodIssue({ ...milk, [key]: Infinity }) || '', /finite/);
  }
  assert.ok(manualFoodIssue({ ...milk, servingGrams: 0 }));
  assert.ok(manualFoodIssue({ ...milk, servingGrams: 100_001 }));
  assert.ok(manualFoodIssue({ ...milk, calories: 100_000 }));
  assert.ok(manualFoodIssue({ ...milk, protein: 300 }));
});
test('recipe source links allow ordinary web URLs but not executable or local file schemes', () => {
  assert.equal(safeRecipeSourceUrl(' https://en.wikibooks.org/wiki/Cookbook:Biryani '), 'https://en.wikibooks.org/wiki/Cookbook:Biryani');
  assert.equal(safeRecipeSourceUrl('http://example.com/recipe'), 'http://example.com/recipe');
  for (const value of ['javascript:alert(1)', 'file:///private/key', 'data:text/html,hello', 'intent://open', 'https://name:secret@example.com', 'not a url', '']) assert.equal(safeRecipeSourceUrl(value), null);
});

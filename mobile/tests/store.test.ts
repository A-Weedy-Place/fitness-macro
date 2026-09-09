import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableStore, mergeStateTransition } from '../src/logic/durableStore';
import { AppState, DailyGoal, FoodEntry } from '../src/types';

const empty = (): AppState => ({ version: 8, foods: [], entries: [], activities: [], weights: [], plans: [], recipes: [], goals: [] });
const goal = (date: string, calories: number): DailyGoal => ({ date, calories, protein: 100, carbs: 200, fat: 50 });
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

test('durable store publishes and changes memory only after phone storage confirms', async () => {
  const original = empty(); const next = { ...original, goals: [goal('2026-09-09', 2000)] };
  let finishWrite!: () => void;
  const writes: AppState[] = []; const published: AppState[] = [];
  const store = createDurableStore(original, async (value) => { writes.push(value); await new Promise<void>((resolve) => { finishWrite = resolve; }); }, (value) => published.push(value));
  const pending = store.update(next);
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(store.get(), original);
  assert.deepEqual(published, []);
  finishWrite(); await pending;
  assert.equal(store.get(), next);
  assert.deepEqual(published, [next]);
});

test('a failed save leaves memory unchanged and does not poison the next save', async () => {
  const original = empty(); const published: AppState[] = []; let fail = true;
  const store = createDurableStore(original, async () => { if (fail) throw new Error('disk full'); }, (value) => published.push(value));
  await assert.rejects(store.update({ ...original, goals: [goal('2026-09-09', 2000)] }), /disk full/);
  assert.equal(store.get(), original);
  assert.deepEqual(published, []);
  fail = false;
  await store.update((current) => ({ ...current, goals: [goal('2026-09-10', 2100)] }));
  assert.equal(store.get().goals[0].date, '2026-09-10');
  assert.equal(published.length, 1);
});

test('queued functional changes see the last durably saved state', async () => {
  const writes: AppState[] = [];
  const store = createDurableStore(empty(), async (value) => { writes.push(value); await tick(); }, () => undefined);
  await Promise.all([
    store.update((current) => ({ ...current, goals: [...current.goals, goal('2026-09-09', 2000)] })),
    store.update((current) => ({ ...current, goals: [...current.goals, goal('2026-09-10', 2100)] }))
  ]);
  assert.deepEqual(writes.map((value) => value.goals.length), [1, 2]);
  assert.equal(store.get().goals.length, 2);
});

test('update restart barrier waits for pending persistence without writing another state', async () => {
  let release!: () => void; let writes = 0; let barrierFinished = false;
  const store = createDurableStore(empty(), async () => { writes += 1; await new Promise<void>((resolve) => { release = resolve; }); }, () => undefined);
  const save = store.update((current) => ({ ...current, goals: [goal('2026-09-09', 2000)] }));
  await tick();
  const barrier = store.update((current) => current).then(() => { barrierFinished = true; });
  await tick(); assert.equal(barrierFinished, false);
  release(); await save; await barrier;
  assert.equal(barrierFinished, true); assert.equal(writes, 1); assert.equal(store.get().goals.length, 1);
});

test('two actions prepared from one snapshot preserve unrelated concurrent records', async () => {
  const base = empty();
  const first = { ...base, goals: [goal('2026-09-09', 2000)] };
  const second = { ...base, goals: [goal('2026-09-10', 2100)] };
  const store = createDurableStore(base, async () => tick(), () => undefined);
  await Promise.all([
    store.update((current) => mergeStateTransition(base, first, current)),
    store.update((current) => mergeStateTransition(base, second, current))
  ]);
  assert.deepEqual(store.get().goals.map((value) => value.date).sort(), ['2026-09-09', '2026-09-10']);
});

test('competing edits to the same goal are rejected rather than silently overwritten', async () => {
  const base = { ...empty(), goals: [goal('2026-09-09', 2000)] };
  const first = { ...base, goals: [goal('2026-09-09', 2100)] };
  const second = { ...base, goals: [goal('2026-09-09', 1500)] };
  const published: AppState[] = [];
  const store = createDurableStore(base, async () => tick(), (value) => published.push(value));
  await store.update((current) => mergeStateTransition(base, first, current));
  await assert.rejects(store.update((current) => mergeStateTransition(base, second, current)), /record changed/i);
  assert.equal(store.get().goals[0].calories, 2100);
  assert.equal(published.length, 1);
});

const meal = (id: string, date: string): FoodEntry => ({ id, date, eatenAt: '12:00', foodId: 'test-food', mealType: 'lunch', portion: { foodId: 'test-food', quantity: 1, unit: 'serving' }, enteredAt: '2026-09-09T12:00:00Z', source: { source: 'manual' } });

test('concurrent differently identified weigh-ins cannot create two weights for one day', async () => {
  const base = empty();
  const first: AppState = { ...base, weights: [{ id: 'manual', date: '2026-09-09', weightKg: 82, enteredAt: '2026-09-09T12:00:00Z', source: 'manual' }] };
  const second: AppState = { ...base, weights: [{ id: 'tracker', date: '2026-09-09', weightKg: 83, enteredAt: '2026-09-09T12:01:00Z', source: 'health_connect' }] };
  const store = createDurableStore(base, async () => tick(), () => undefined);
  await store.update((current) => mergeStateTransition(base, first, current));
  await assert.rejects(store.update((current) => mergeStateTransition(base, second, current)), /record changed/i);
  assert.equal(store.get().weights.length, 1); assert.equal(store.get().weights[0].id, 'manual');
});

test('meal logging reopens a day marked complete by a concurrent action', () => {
  const base = { ...empty(), completedFoodDays: [] };
  const current = { ...base, completedFoodDays: ['2026-09-09', '2026-09-08'] };
  const proposed = { ...base, entries: [meal('new', '2026-09-09')] };
  assert.deepEqual(mergeStateTransition(base, proposed, current).completedFoodDays, ['2026-09-08']);
});

test('moving a meal reopens both dates even when completion was added concurrently', () => {
  const base = { ...empty(), entries: [meal('meal', '2026-09-08')], completedFoodDays: [] };
  const current = { ...base, completedFoodDays: ['2026-09-08', '2026-09-09', '2026-09-07'] };
  const proposed = { ...base, entries: [meal('meal', '2026-09-09')] };
  assert.deepEqual(mergeStateTransition(base, proposed, current).completedFoodDays, ['2026-09-07']);
});

test('marking a day complete rejects confirmation prepared before concurrent food changes', () => {
  const base = { ...empty(), entries: [meal('meal', '2026-09-09')], completedFoodDays: [] };
  const current = { ...base, entries: [...base.entries, meal('second', '2026-09-09')] };
  const proposed = { ...base, completedFoodDays: ['2026-09-09'] };
  assert.throws(() => mergeStateTransition(base, proposed, current), /review the diary/i);
  const unrelated = { ...base, entries: [...base.entries, meal('tomorrow', '2026-09-10')] };
  assert.deepEqual(mergeStateTransition(base, proposed, unrelated).completedFoodDays, ['2026-09-09']);
});

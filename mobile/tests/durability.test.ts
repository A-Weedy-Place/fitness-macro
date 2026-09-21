import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createDurableWriter, KeyValueStore } from '../src/storage/serialStore';
import { createPortableBackup, previewPortableBackup, restorePortableBackup, prepareBackupRestore } from '../src/logic/backup';
import { EMPTY_STATE, migrateState, upsertEntry, upsertFood, removeEntry, decodeStoredState } from '../src/storage/localDb';
import { FoodEntry, FoodItem } from '../src/types';

function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async (key) => { data.delete(key); } };
}

test('durable writes serialize, reject failures, and permit a later retry', async () => {
  const store = memoryStore(); const started = deferred(); const release = deferred(); const calls: string[] = [];
  const originalSet = store.setItem;
  store.setItem = async (key, value) => { calls.push(value); if (value === '1') { started.resolve(); await release.promise; throw new Error('storage_full'); } await originalSet(key, value); };
  const writer = createDurableWriter(store);
  const first = writer.save('state', 1); const rejected = assert.rejects(first, /storage_full/);
  await started.promise;
  const second = writer.save('state', 2);
  assert.deepEqual(calls, ['1']);
  release.resolve(); await rejected; await second;
  assert.equal(store.data.get('state'), '2');
});

test('backup rejects unrelated JSON, incomplete collections, invalid macros and missing references', () => {
  for (const text of ['{}', '[]', '{"hello":"world"}', '{"state":{}}']) assert.throws(() => restorePortableBackup(text));
  assert.throws(() => restorePortableBackup(JSON.stringify({ ...EMPTY_STATE, entries: null })));
  assert.throws(() => restorePortableBackup(JSON.stringify({ ...EMPTY_STATE, foods: [{ ...EMPTY_STATE.foods[0], nutrition: { calories: -1 } }] })));
  assert.throws(() => restorePortableBackup(JSON.stringify({ ...EMPTY_STATE, entries: [{ id: 'x', date: '2026-09-09', foodId: 'missing', portion: { quantity: 1, unit: 'g' } }] })));
});

test('startup does not mistake unrelated valid JSON for a deliberately empty account', () => {
  for (const raw of ['{}', '[]', 'null', '{"version":8}']) assert.throws(() => decodeStoredState(raw), /recovery/);
  assert.equal(decodeStoredState(JSON.stringify(EMPTY_STATE)).version, 8);
});

test('startup never overwrites newest corrupt data when its recovery copy fails, even with a valid older account', async () => {
  for (const latestKey of ['fitness-app-state-v8', 'fitness-app-state-v7']) {
    const storage = memoryStore(); const olderKey = latestKey.endsWith('v8') ? 'fitness-app-state-v7' : 'fitness-app-state-v6';
    storage.data.set(latestKey, '{corrupt original diary'); storage.data.set(olderKey, JSON.stringify(EMPTY_STATE));
    const writes: string[] = [];
    const originalSet = storage.setItem;
    storage.setItem = async (key, value) => { writes.push(key); if (key === 'fitness-app-state-startup-recovery-v1') throw new Error('storage_full'); await originalSet(key, value); };
    const context = { exports: {} as Record<string, any>, require: (name: string) => {
      if (name.includes('async-storage')) return storage;
      if (name.endsWith('/starterFoods')) return { STARTER_FOODS: [] };
      if (name.endsWith('/portions')) return { gramsForQuantity: () => 0 };
      if (name.endsWith('/serialStore')) return { createDurableWriter };
      throw new Error(`Unexpected dependency ${name}`);
    } };
    const code = ts.transpileModule(readFileSync(fileURLToPath(new URL('../src/storage/localDb.ts', import.meta.url)), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, context);
    await assert.rejects(context.exports.loadState(), /original data has not been replaced/);
    assert.equal(storage.data.get(latestKey), '{corrupt original diary');
    assert.deepEqual(writes, ['fitness-app-state-startup-recovery-v1']);
  }
});

test('valid portable backup previews account contents and preserves embedded photo bytes', () => {
  const food = { ...EMPTY_STATE.foods[0], imageUri: 'data:image/png;base64,aGVsbG8=' };
  const preview = previewPortableBackup(createPortableBackup({ ...EMPTY_STATE, foods: [food] }));
  assert.equal(preview.state.version, 8); assert.equal(preview.state.foods.find((item) => item.id === food.id)?.imageUri, food.imageUri);
  assert.equal(preview.counts.entries, 0); assert.ok(preview.warnings.some((warning) => warning.includes('empty account')));
});

test('valid current storage opens without reading broken legacy keys', async () => {
  const storage = memoryStore(); const reads: string[] = [];
  storage.data.set('fitness-app-state-v8', JSON.stringify(EMPTY_STATE));
  storage.getItem = async (key) => { reads.push(key); if (key !== 'fitness-app-state-v8') throw new Error('legacy_read_failed'); return storage.data.get(key) || null; };
  const context = { exports: {} as Record<string, any>, require: (name: string) => {
    if (name.includes('async-storage')) return storage;
    if (name.endsWith('/starterFoods')) return { STARTER_FOODS: [] };
    if (name.endsWith('/portions')) return { gramsForQuantity: () => 0 };
    if (name.endsWith('/serialStore')) return { createDurableWriter };
    throw new Error(`Unexpected dependency ${name}`);
  } };
  const code = ts.transpileModule(readFileSync(fileURLToPath(new URL('../src/storage/localDb.ts', import.meta.url)), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, context);
  assert.equal((await context.exports.loadState()).version, 8);
  assert.deepEqual(reads, ['fitness-app-state-v8']);
});

test('restore validates before writing recovery and refuses replacement if recovery cannot persist', async () => {
  let preserved = 0;
  await assert.rejects(prepareBackupRestore('{}', EMPTY_STATE, async () => { preserved += 1; }));
  assert.equal(preserved, 0);
  await assert.rejects(prepareBackupRestore(createPortableBackup(EMPTY_STATE), EMPTY_STATE, async () => { throw new Error('recovery_storage_full'); }), /recovery_storage_full/);
  const next = await prepareBackupRestore(createPortableBackup(EMPTY_STATE), EMPTY_STATE, async (state) => { assert.equal(state, EMPTY_STATE); preserved += 1; });
  assert.equal(next.version, 8); assert.equal(preserved, 1);
});

test('entry nutrition freezes on migration/logging and time edits, recaptures explicit portions', () => {
  const food: FoodItem = { ...EMPTY_STATE.foods[0], id: 'milk', name: 'Milk', serving: { amount: 1, unit: 'cup', gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3, carbs: 5, fat: 2 } };
  const entry: FoodEntry = { id: 'entry', date: '2026-09-01', eatenAt: '08:00', foodId: food.id, mealType: 'breakfast', portion: { foodId: food.id, quantity: 1, unit: 'cup' }, enteredAt: '2026-09-01T08:00:00Z', source: { source: 'manual' } };
  const logged = upsertEntry({ ...EMPTY_STATE, foods: [food] }, entry);
  assert.equal(logged.entries[0].nutritionSnapshot?.calories, 122);
  const editedLibrary = upsertFood(logged, { ...food, nutrition: { ...food.nutrition, calories: 100 } });
  const moved = upsertEntry(editedLibrary, { ...editedLibrary.entries[0], eatenAt: '09:00' });
  assert.equal(moved.entries[0].nutritionSnapshot?.calories, 122);
  const editedPortion = upsertEntry(moved, { ...moved.entries[0], portion: { foodId: food.id, quantity: 150, unit: 'g' } });
  assert.equal(editedPortion.entries[0].nutritionSnapshot?.calories, 150);
  assert.equal(migrateState({ ...EMPTY_STATE, foods: [food], entries: [entry] }).entries[0].nutritionSnapshot?.calories, 122);
  const completed = { ...logged, completedFoodDays: ['2026-09-01', '2026-09-02', '2026-09-03'] };
  assert.deepEqual(upsertEntry(completed, { ...logged.entries[0], date: '2026-09-02' }).completedFoodDays, ['2026-09-03']);
  assert.deepEqual(removeEntry(completed, entry.id).completedFoodDays, ['2026-09-02', '2026-09-03']);
});

test('legacy weigh-in source migration only infers Health Connect from both ID and provenance', () => {
  const base = { date: '2026-09-01', weightKg: 82, enteredAt: '2026-09-01T09:00:00Z' };
  const migrated = migrateState({ ...EMPTY_STATE, weights: [
    { ...base, id: 'health_weight_import', notes: 'Imported from Health Connect (tracker)' },
    { ...base, date: '2026-09-02', id: 'health_weight_manual', source: 'manual', notes: 'Imported from Health Connect (later edited)' },
    { ...base, date: '2026-09-03', id: 'health_weight_unknown' },
    { ...base, date: '2026-09-04', id: 'manual_weight', notes: 'Imported from Health Connect' }
  ] });
  assert.deepEqual(migrated.weights.map((item) => item.source), ['health_connect', 'manual', 'manual', 'manual']);
});

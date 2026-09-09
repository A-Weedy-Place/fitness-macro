import { AppState } from '../types';

type Update = AppState | ((current: AppState) => AppState);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Rebase unrelated concurrent writes, but never overwrite a changed record. */
export function mergeStateTransition(base: AppState, proposed: AppState, current: AppState): AppState {
  const result = { ...current } as AppState;
  // A weigh-in's logical identity is its day, even when two producers assign
  // different IDs (for example a manual entry racing a tracker import).
  const collections = { foods: 'id', entries: 'id', weights: 'date', activities: 'id', recipes: 'id', plans: 'id', goals: 'date', goalHistory: 'effectiveFrom' };
  const beforeEntries = new Map(base.entries.map((entry) => [entry.id, entry]));
  const proposedEntries = new Map(proposed.entries.map((entry) => [entry.id, entry]));
  const changedFoodDates = new Set<string>();
  for (const id of new Set([...beforeEntries.keys(), ...proposedEntries.keys()])) {
    const before = beforeEntries.get(id), after = proposedEntries.get(id);
    if (equal(before, after)) continue;
    if (before) changedFoodDates.add(before.date);
    if (after) changedFoodDates.add(after.date);
  }
  const entriesForDay = (state: AppState, date: string) => state.entries.filter((entry) => entry.date === date).sort((a, b) => a.id.localeCompare(b.id));
  for (const day of proposed.completedFoodDays || []) {
    if (!(base.completedFoodDays || []).includes(day) && !equal(entriesForDay(base, day), entriesForDay(current, day))) {
      throw new Error('Food for this day changed before it could be marked complete. Review the diary and mark it complete again.');
    }
  }
  for (const key of Object.keys(proposed) as Array<keyof AppState>) {
    if (equal(base[key], proposed[key])) continue;
    if (key in collections) {
      const idKey = collections[key as keyof typeof collections];
      const rows = (value: unknown) => (value || []) as Array<Record<string, unknown>>;
      const before = new Map(rows(base[key]).map(row => [row[idKey], row]));
      const after = new Map(rows(proposed[key]).map(row => [row[idKey], row]));
      const latest = new Map(rows(current[key]).map(row => [row[idKey], row]));
      for (const id of new Set([...before.keys(), ...after.keys()])) {
        if (equal(before.get(id), after.get(id))) continue;
        if (!equal(latest.get(id), before.get(id)) && !equal(latest.get(id), after.get(id))) throw new Error('This record changed while the action was being prepared. Please review it and try again.');
        const row = after.get(id);
        if (row) latest.set(id, row); else latest.delete(id);
      }
      Object.assign(result, { [key]: [...latest.values()] });
    } else if (key === 'completedFoodDays') {
      const before = new Set(base.completedFoodDays || []), after = new Set(proposed.completedFoodDays || []), latest = new Set(current.completedFoodDays || []);
      for (const day of before) if (!after.has(day)) latest.delete(day);
      for (const day of after) if (!before.has(day)) latest.add(day);
      result.completedFoodDays = [...latest].sort();
    } else {
      if (!equal(current[key], base[key]) && !equal(current[key], proposed[key])) throw new Error('Your data changed while this action was being prepared. Please try again.');
      Object.assign(result, { [key]: proposed[key] });
    }
  }
  // This also catches a concurrently added completion marker that was absent
  // from both the original and proposed snapshots. Any meal mutation reopens it.
  if (changedFoodDates.size) result.completedFoodDays = result.completedFoodDays?.filter((day) => !changedFoodDates.has(day));
  return result;
}

export function createDurableStore(initial: AppState, write: (state: AppState) => Promise<void>, publish: (state: AppState) => void) {
  let current = initial;
  let pending: Promise<void> = Promise.resolve();
  return {
    get: () => current,
    hydrate(value: AppState) { current = value; publish(value); },
    update(update: Update): Promise<void> {
      const operation = pending.then(async () => {
        const next = typeof update === 'function' ? update(current) : update;
        if (next === current) return;
        await write(next);
        current = next;
        publish(next);
      });
      pending = operation.catch(() => undefined);
      return operation;
    }
  };
}

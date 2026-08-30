import { createDbAccessor } from './db.js';
import { ActivityEntry, BodyMetricLog, DailyGoal, FoodEntry, FoodItem, MealPlan, SyncEvent, UserProfile } from '../contracts.js';
import { makeId } from '../utils/id.js';

export const db = createDbAccessor();

async function recordSync(resource: SyncEvent['resource'], resourceId: string, type: SyncEvent['type'] = 'created') {
  db.addSyncEvent({ id: makeId('sync'), type, resource, resourceId, createdAt: new Date().toISOString() });
}

export async function createFoodEntry(
  input: Omit<FoodEntry, 'id' | 'enteredAt' | 'source'> & { clientId?: string }
): Promise<FoodEntry> {
  const enteredAt = new Date().toISOString();
  const { clientId, ...data } = input;
  const entry: FoodEntry = {
    ...data,
    id: clientId || makeId('entry'),
    enteredAt,
    source: { source: 'manual', confidence: 1 }
  };
  db.addEntry(entry);
  await recordSync('entry', entry.id);
  return entry;
}

export async function createWeightLog(
  input: Omit<BodyMetricLog, 'id' | 'enteredAt'> & { clientId?: string }
): Promise<BodyMetricLog> {
  const { clientId, ...data } = input;
  const existing = db.listWeights(data.date, data.date)[0];
  const log: BodyMetricLog = { ...data, id: existing?.id || clientId || makeId('weight'), enteredAt: new Date().toISOString() };
  db.addWeight(log);
  await recordSync('weight', log.id);
  return log;
}

export async function createActivity(
  input: Omit<ActivityEntry, 'id' | 'createdAt' | 'source'> & { clientId?: string }
): Promise<ActivityEntry> {
  const { clientId, ...data } = input;
  const activity: ActivityEntry = {
    ...data,
    id: clientId || makeId('activity'),
    source: 'manual',
    createdAt: new Date().toISOString()
  };
  db.addActivity(activity);
  await recordSync('activity', activity.id);
  return activity;
}

export async function saveImportedActivities(activities: ActivityEntry[]): Promise<void> {
  for (const activity of activities) {
    db.addActivity(activity);
    await recordSync('activity', activity.id, 'updated');
  }
}

export async function createCustomFood(
  input: Pick<FoodItem, 'name' | 'brand' | 'barcode' | 'serving' | 'nutrition'> & { clientId?: string }
): Promise<FoodItem> {
  const now = new Date().toISOString();
  const food: FoodItem = {
    id: input.clientId || makeId('food'),
    name: input.name,
    brand: input.brand,
    barcode: input.barcode,
    serving: input.serving,
    nutrition: input.nutrition,
    createdAt: now,
    updatedAt: now,
    source: { source: 'manual', confidence: 1 }
  };
  db.upsertFood(food);
  await recordSync('food', food.id);
  return food;
}

export async function saveFoodItems(items: FoodItem[]): Promise<void> {
  db.addFoods(items);
  for (const item of items) await recordSync('food', item.id);
}

export async function saveProfile(input: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const existing = db.getProfile();
  const now = new Date().toISOString();
  const profile: UserProfile = {
    ...existing,
    ...input,
    id: existing?.id || makeId('profile'),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  db.setProfile(profile);
  await recordSync('profile', profile.id, existing ? 'updated' : 'created');
  return profile;
}

export async function setDailyGoal(goal: DailyGoal): Promise<DailyGoal> {
  db.addGoal(goal);
  await recordSync('goal', goal.date, 'updated');
  return goal;
}

export async function saveMealPlan(
  input: Pick<MealPlan, 'name' | 'description'> & {
    clientId?: string;
    items: Array<Omit<MealPlan['items'][number], 'id'> & { clientId?: string }>;
  }
): Promise<MealPlan> {
  const existing = input.clientId ? db.listPlans().find((plan) => plan.id === input.clientId) : undefined;
  const now = new Date().toISOString();
  const plan: MealPlan = {
    id: input.clientId || makeId('plan'),
    name: input.name,
    description: input.description,
    items: input.items.map(({ clientId, ...item }) => ({ ...item, id: clientId || makeId('plan_item') })),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  db.upsertPlan(plan);
  await recordSync('plan', plan.id, existing ? 'updated' : 'created');
  return plan;
}

export async function deleteResource(resource: 'entry' | 'weight' | 'activity' | 'plan', id: string): Promise<boolean> {
  const deleted = resource === 'entry'
    ? db.deleteEntry(id)
    : resource === 'weight'
      ? db.deleteWeight(id)
      : resource === 'activity'
        ? db.deleteActivity(id)
        : db.deletePlan(id);
  if (deleted) await recordSync(resource, id, 'deleted');
  return deleted;
}

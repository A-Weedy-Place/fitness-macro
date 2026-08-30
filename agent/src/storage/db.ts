import fs from 'fs';
import path from 'path';
import { DbSchema, FoodItem, FoodEntry, BodyMetricLog, DailyGoal, SyncEvent, UserProfile, ActivityEntry, MealPlan } from '../contracts.js';

const dbDir = path.resolve(process.env.AGENT_DATA_DIR || path.resolve(process.cwd(), 'data'));
const dbFile = path.resolve(dbDir, 'db.json');
const tempDbFile = path.resolve(dbDir, 'db.json.tmp');

const defaultDb: DbSchema = {
  version: 5,
  foodItems: [],
  entries: [],
  weights: [],
  activities: [],
  goals: [],
  plans: [],
  syncEvents: []
};

function ensureDirectory() {
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
}

function migrate(db: Partial<DbSchema> & { version?: number }): DbSchema {
  return {
    version: 5,
    userProfile: db.userProfile,
    foodItems: Array.isArray(db.foodItems) ? db.foodItems : [],
    entries: Array.isArray(db.entries) ? db.entries : [],
    weights: Array.isArray(db.weights) ? db.weights : [],
    activities: Array.isArray(db.activities) ? db.activities : [],
    goals: Array.isArray(db.goals) ? db.goals : [],
    plans: Array.isArray(db.plans) ? db.plans : [],
    syncEvents: Array.isArray(db.syncEvents) ? db.syncEvents : []
  };
}

function readDb(): DbSchema {
  ensureDirectory();
  if (!fs.existsSync(dbFile)) {
    writeDb(defaultDb);
    return defaultDb;
  }
  const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}') as Partial<DbSchema>;
  return migrate(parsed);
}

function writeDb(db: DbSchema) {
  ensureDirectory();
  fs.writeFileSync(tempDbFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempDbFile, dbFile);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function upsertById<T extends { id: string }>(items: T[], item: T): void {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
}

export function createDbAccessor() {
  return {
    getSnapshot: readDb,

    getProfile(): UserProfile | undefined {
      return readDb().userProfile;
    },

    setProfile(profile: UserProfile): void {
      const db = readDb();
      db.userProfile = profile;
      writeDb(db);
    },

    getFoodById(id: string): FoodItem | undefined {
      return readDb().foodItems.find((food) => food.id === id);
    },

    searchFoodByName(q: string, limit = 20): FoodItem[] {
      const query = normalizeText(q);
      return readDb().foodItems.filter((food) => {
        const name = normalizeText(food.name);
        const brand = food.brand ? normalizeText(food.brand) : '';
        const tags = (food.tags ?? []).join(' ').toLowerCase();
        return name.includes(query) || brand.includes(query) || tags.includes(query);
      }).slice(0, limit);
    },

    upsertFood(item: FoodItem): void {
      const db = readDb();
      upsertById(db.foodItems, item);
      writeDb(db);
    },

    addFoods(items: FoodItem[]): void {
      const db = readDb();
      for (const item of items) upsertById(db.foodItems, item);
      writeDb(db);
    },

    addEntry(entry: FoodEntry): void {
      const db = readDb();
      upsertById(db.entries, entry);
      db.entries.sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
      writeDb(db);
    },

    listEntries(date: string): FoodEntry[] {
      return readDb().entries.filter((entry) => entry.date === date);
    },

    allEntries(): FoodEntry[] {
      return readDb().entries;
    },

    deleteEntry(id: string): boolean {
      const db = readDb();
      const next = db.entries.filter((entry) => entry.id !== id);
      if (next.length === db.entries.length) return false;
      db.entries = next;
      writeDb(db);
      return true;
    },

    addWeight(log: BodyMetricLog): void {
      const db = readDb();
      upsertById(db.weights, log);
      db.weights.sort((a, b) => a.date.localeCompare(b.date));
      writeDb(db);
    },

    listWeights(fromDate?: string, toDate?: string): BodyMetricLog[] {
      return readDb().weights.filter((weight) => {
        if (fromDate && weight.date < fromDate) return false;
        if (toDate && weight.date > toDate) return false;
        return true;
      });
    },

    deleteWeight(id: string): boolean {
      const db = readDb();
      const next = db.weights.filter((weight) => weight.id !== id);
      if (next.length === db.weights.length) return false;
      db.weights = next;
      writeDb(db);
      return true;
    },

    addActivity(entry: ActivityEntry): void {
      const db = readDb();
      upsertById(db.activities, entry);
      db.activities.sort((a, b) => a.date.localeCompare(b.date));
      writeDb(db);
    },

    listActivities(fromDate?: string, toDate?: string): ActivityEntry[] {
      return readDb().activities.filter((activity) => {
        if (fromDate && activity.date < fromDate) return false;
        if (toDate && activity.date > toDate) return false;
        return true;
      });
    },

    deleteActivity(id: string): boolean {
      const db = readDb();
      const next = db.activities.filter((activity) => activity.id !== id);
      if (next.length === db.activities.length) return false;
      db.activities = next;
      writeDb(db);
      return true;
    },

    addGoal(goal: DailyGoal): void {
      const db = readDb();
      const index = db.goals.findIndex((candidate) => candidate.date === goal.date);
      if (index >= 0) db.goals[index] = goal;
      else db.goals.push(goal);
      writeDb(db);
    },

    listGoals(fromDate?: string, toDate?: string): DailyGoal[] {
      return readDb().goals.filter((goal) => {
        if (fromDate && goal.date < fromDate) return false;
        if (toDate && goal.date > toDate) return false;
        return true;
      });
    },

    upsertPlan(plan: MealPlan): void {
      const db = readDb();
      upsertById(db.plans, plan);
      writeDb(db);
    },

    listPlans(): MealPlan[] {
      return readDb().plans;
    },

    deletePlan(id: string): boolean {
      const db = readDb();
      const next = db.plans.filter((plan) => plan.id !== id);
      if (next.length === db.plans.length) return false;
      db.plans = next;
      writeDb(db);
      return true;
    },

    addSyncEvent(event: SyncEvent): void {
      const db = readDb();
      upsertById(db.syncEvents, event);
      writeDb(db);
    },

    listSyncSince(since?: string): SyncEvent[] {
      const events = readDb().syncEvents;
      if (!since) return events;
      const sinceTime = new Date(since).getTime();
      return events.filter((event) => new Date(event.createdAt).getTime() >= sinceTime);
    }
  };
}

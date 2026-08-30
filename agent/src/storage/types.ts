import { ActivityEntry, BodyMetricLog, DailyGoal, DbSchema, FoodEntry, FoodItem, MealPlan, SyncEvent, UserProfile } from '../contracts.js';

export interface AgentDb {
  getSnapshot(): DbSchema;
  getProfile(): UserProfile | undefined;
  setProfile(profile: UserProfile): void;
  getFoodById(id: string): FoodItem | undefined;
  searchFoodByName(q: string, limit?: number): FoodItem[];
  upsertFood(item: FoodItem): void;
  addFoods(items: FoodItem[]): void;
  addEntry(entry: FoodEntry): void;
  listEntries(date: string): FoodEntry[];
  allEntries(): FoodEntry[];
  deleteEntry(id: string): boolean;
  addWeight(log: BodyMetricLog): void;
  listWeights(fromDate?: string, toDate?: string): BodyMetricLog[];
  deleteWeight(id: string): boolean;
  addActivity(entry: ActivityEntry): void;
  listActivities(fromDate?: string, toDate?: string): ActivityEntry[];
  deleteActivity(id: string): boolean;
  addGoal(goal: DailyGoal): void;
  listGoals(fromDate?: string, toDate?: string): DailyGoal[];
  upsertPlan(plan: MealPlan): void;
  listPlans(): MealPlan[];
  deletePlan(id: string): boolean;
  addSyncEvent(event: SyncEvent): void;
  listSyncSince(since?: string): SyncEvent[];
}

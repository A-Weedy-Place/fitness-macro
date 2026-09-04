import { AppState, FoodItem, UserProfile } from '../types';
import { migrateState } from '../storage/localDb';

export function createPortableBackup(state: AppState): string {
  return JSON.stringify({ format: 'fitness-macro-backup', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function restorePortableBackup(text: string): AppState {
  const parsed = JSON.parse(text) as { state?: Partial<AppState>; foodItems?: FoodItem[]; userProfile?: UserProfile } & Partial<AppState>;
  if (parsed.state) return migrateState(parsed.state);
  if (parsed.foodItems) return migrateState({ profile: parsed.userProfile, foods: parsed.foodItems, entries: parsed.entries, weights: parsed.weights, activities: parsed.activities, goals: parsed.goals, plans: parsed.plans });
  return migrateState(parsed);
}

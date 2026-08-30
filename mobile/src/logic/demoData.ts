import { AppState, FoodEntry, UserProfile } from '../types';
import { STARTER_FOODS } from '../data/starterFoods';
import { recommendDailyGoal } from './tdee';
import { shiftDate } from '../utils/dates';

const byId = Object.fromEntries(STARTER_FOODS.map((food) => [food.id.replace('starter_', ''), food]));

export function withDemoData(state: AppState, endDate: string, profile?: UserProfile): AppState {
  const entries: FoodEntry[] = [];
  const weights = [];
  const activities = [];
  const goals = [];
  const startWeight = profile?.bodyWeightKg || 78;
  for (let offset = -59; offset <= 0; offset += 1) {
    const date = shiftDate(endDate, offset);
    const wave = Math.sin(offset * 1.7);
    const dayFoods = [
      { key: 'egg_boiled', quantity: 2, mealType: 'breakfast' as const, eatenAt: '08:10' },
      { key: 'milk_tea', quantity: 1, mealType: 'breakfast' as const, eatenAt: '08:35' },
      { key: offset % 3 ? 'daal_cooked' : 'chicken_karahi', quantity: 1 + (wave + 1) * 0.08, mealType: 'lunch' as const, eatenAt: '13:20' },
      { key: 'chapati_wholewheat', quantity: offset % 4 === 0 ? 2 : 1, mealType: 'lunch' as const, eatenAt: '13:32' },
      { key: 'banana', quantity: 1, mealType: 'snack' as const, eatenAt: '16:45' },
      { key: offset % 5 === 0 ? 'chicken_biryani' : 'chicken_breast', quantity: offset % 5 === 0 ? 0.85 : 180 + wave * 15, mealType: 'dinner' as const, eatenAt: '20:15' },
      { key: offset % 5 === 0 ? 'yogurt_plain' : 'basmati_rice', quantity: offset % 5 === 0 ? 0.5 : 180 + wave * 12, mealType: 'dinner' as const, eatenAt: '20:28' }
    ];
    if (offset % 11 !== 0) for (const [index, item] of dayFoods.entries()) {
      const food = byId[item.key];
      entries.push({ id: `demo_entry_${date}_${index}`, date, eatenAt: item.eatenAt, mealType: item.mealType, foodId: food.id, portion: { foodId: food.id, quantity: Number(item.quantity.toFixed(2)), unit: food.serving.unit }, enteredAt: `${date}T${item.eatenAt}:00.000Z`, source: { source: 'manual', confidence: 1 }, note: 'Demo data' });
    }
    if (offset % 3 === 0) weights.push({ id: `demo_weight_${date}`, date, weightKg: Number((startWeight + offset * 0.025 + wave * 0.18).toFixed(2)), enteredAt: `${date}T07:30:00.000Z`, notes: 'Demo data' });
    if (offset % 2 === 0) activities.push({ id: `demo_activity_${date}`, date, name: offset % 4 ? 'Walk' : 'Strength training', source: 'manual' as const, type: offset % 4 ? 'walk' : 'strength', durationMinutes: offset % 4 ? 42 : 55, caloriesEstimated: offset % 4 ? 210 : 280, createdAt: `${date}T18:00:00.000Z` });
    if (profile) goals.push(recommendDailyGoal(profile, date));
  }
  return {
    ...state,
    foods: [...new Map([...STARTER_FOODS, ...state.foods].map((food) => [food.id, food])).values()],
    entries: [...state.entries.filter((item) => !item.id.startsWith('demo_')), ...entries],
    weights: [...state.weights.filter((item) => !item.id.startsWith('demo_')), ...weights],
    activities: [...state.activities.filter((item) => !item.id.startsWith('demo_')), ...activities],
    goals: profile ? [...state.goals.filter((item) => item.date < shiftDate(endDate, -59) || item.date > endDate), ...goals] : state.goals
  };
}

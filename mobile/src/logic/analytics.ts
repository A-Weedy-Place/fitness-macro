import { ActivityEntry, BodyMetricLog, DailyGoal, FoodEntry, FoodItem, UserProfile } from '../types';
import { recommendDailyGoal } from './tdee';
import { sumNutrition } from './nutrition';
import { shiftDate } from '../utils/dates';

export interface DailyAnalyticsPoint {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  activityCalories: number;
  activityMinutes: number;
  goalCalories?: number;
  goalProtein?: number;
  logged: boolean;
}

export function dateWindow(endDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftDate(endDate, index - days + 1));
}

export function goalForDate(goals: DailyGoal[], profile: UserProfile | undefined, date: string): DailyGoal | undefined {
  return goals.find((goal) => goal.date === date) || (profile ? recommendDailyGoal(profile, date) : undefined);
}

export function buildDailySeries(input: {
  endDate: string;
  days: number;
  entries: FoodEntry[];
  foods: FoodItem[];
  activities: ActivityEntry[];
  goals: DailyGoal[];
  profile?: UserProfile;
}): DailyAnalyticsPoint[] {
  return dateWindow(input.endDate, input.days).map((date) => {
    const entries = input.entries.filter((entry) => entry.date === date);
    const activities = input.activities.filter((activity) => activity.date === date);
    const nutrition = sumNutrition(entries, input.foods);
    const goal = goalForDate(input.goals, input.profile, date);
    return {
      date,
      label: date.slice(5).replace('-', '/'),
      ...nutrition,
      activityCalories: activities.reduce((sum, activity) => sum + activity.caloriesEstimated, 0),
      activityMinutes: activities.reduce((sum, activity) => sum + activity.durationMinutes, 0),
      goalCalories: goal?.calories,
      goalProtein: goal?.protein,
      logged: entries.length > 0
    };
  });
}

export function latestWeightByDate(weights: BodyMetricLog[]): BodyMetricLog[] {
  const byDate = new Map<string, BodyMetricLog>();
  for (const weight of [...weights].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))) byDate.set(weight.date, weight);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildWeightSeries(weights: BodyMetricLog[], endDate: string, days: number) {
  const startDate = shiftDate(endDate, -days + 1);
  const all = latestWeightByDate(weights).filter((item) => item.date <= endDate);
  return all.filter((item) => item.date >= startDate).map((item) => {
    const history = all.filter((candidate) => candidate.date <= item.date).slice(-7);
    const trend = history.reduce((sum, candidate) => sum + candidate.weightKg, 0) / history.length;
    return { date: item.date, label: item.date.slice(5).replace('-', '/'), value: item.weightKg, secondary: trend };
  });
}

export function calculateInsights(series: DailyAnalyticsPoint[], weights: BodyMetricLog[], endDate: string) {
  const logged = series.filter((day) => day.logged);
  const withCalorieGoal = logged.filter((day) => day.goalCalories);
  const withProteinGoal = logged.filter((day) => day.goalProtein);
  const calorieAdherent = withCalorieGoal.filter((day) => Math.abs(day.calories - (day.goalCalories || 0)) <= (day.goalCalories || 0) * 0.1);
  const proteinHit = withProteinGoal.filter((day) => day.protein >= (day.goalProtein || 0) * 0.9);
  const dailyWeights = latestWeightByDate(weights).filter((item) => item.date <= endDate);
  const relevantWeights = dailyWeights.filter((item) => item.date >= series[0]?.date);
  const weightChangeKg = relevantWeights.length > 1
    ? relevantWeights[relevantWeights.length - 1].weightKg - relevantWeights[0].weightKg
    : null;
  let streak = 0;
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (!series[index].logged) break;
    streak += 1;
  }
  return {
    loggedDays: logged.length,
    streak,
    averageCalories: logged.length ? logged.reduce((sum, day) => sum + day.calories, 0) / logged.length : 0,
    averageProtein: logged.length ? logged.reduce((sum, day) => sum + day.protein, 0) / logged.length : 0,
    calorieAdherencePercent: withCalorieGoal.length ? calorieAdherent.length / withCalorieGoal.length * 100 : 0,
    proteinHitPercent: withProteinGoal.length ? proteinHit.length / withProteinGoal.length * 100 : 0,
    activityMinutes: series.reduce((sum, day) => sum + day.activityMinutes, 0),
    weightChangeKg
  };
}

export function macroCalorieSplit(series: DailyAnalyticsPoint[]) {
  const protein = series.reduce((sum, day) => sum + day.protein, 0) * 4;
  const carbs = series.reduce((sum, day) => sum + day.carbs, 0) * 4;
  const fat = series.reduce((sum, day) => sum + day.fat, 0) * 9;
  return [
    { label: 'Protein', value: protein },
    { label: 'Carbs', value: carbs },
    { label: 'Fat', value: fat }
  ];
}

export function mealCalorieBreakdown(entries: FoodEntry[], foods: FoodItem[]) {
  const meals = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
  return meals.map((meal) => ({
    label: meal,
    value: sumNutrition(entries.filter((entry) => entry.mealType === meal), foods).calories
  })).filter((item) => item.value > 0);
}

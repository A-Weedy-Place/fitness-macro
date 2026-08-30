import { DailyGoal, UserProfile } from '../types';

export function mifflinStJeor(profile: Pick<UserProfile, 'sex' | 'bodyWeightKg' | 'heightCm' | 'ageYears'>) {
  const base = 10 * profile.bodyWeightKg + 6.25 * profile.heightCm - 5 * profile.ageYears;
  const sexOffset = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  return Math.round(base + sexOffset);
}

export function estimateTdee(bmr: number, activityFactor: number) {
  return Math.round(bmr * activityFactor);
}

export function recommendDailyGoal(profile: UserProfile, date: string): DailyGoal {
  const tdee = profile.adaptiveTdee || estimateTdee(mifflinStJeor(profile), profile.activityFactor);
  const requestedAdjustment = profile.weeklyWeightChangeKg * 7700 / 7;
  const limit = tdee * 0.3;
  const adjustment = Math.max(-limit, Math.min(limit, requestedAdjustment));
  const calories = Math.round(Math.max(1200, tdee + adjustment));
  const protein = Math.round(profile.bodyWeightKg * 1.8);
  const fat = Math.round(profile.bodyWeightKg * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { date, calories, protein, carbs, fat };
}

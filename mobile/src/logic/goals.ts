import { ProfileInput, UserProfile } from '../types';

export type GoalInput = Pick<ProfileInput, 'bodyWeightKg' | 'targetWeightKg' | 'targetDate' | 'goalMode' | 'goalIntensity'>;

function weeksUntil(targetDate?: string, from = new Date()): number | null {
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
  const days = (new Date(`${targetDate}T12:00:00`).getTime() - from.getTime()) / 86400000;
  return days > 0 ? Math.max(days / 7, 1) : null;
}

export function weeklyChangeForGoal(input: GoalInput, from = new Date()): number {
  const mode = input.goalMode || 'maintain';
  if (mode === 'maintain' || mode === 'recompose') return 0;
  const direction = mode === 'lose' ? -1 : 1;
  const defaults = mode === 'lose'
    ? { gentle: 0.25, moderate: 0.5, aggressive: 0.75 }
    : { gentle: 0.1, moderate: 0.25, aggressive: 0.4 };
  const weeks = weeksUntil(input.targetDate, from);
  const requested = weeks && input.targetWeightKg
    ? Math.abs(input.targetWeightKg - input.bodyWeightKg) / weeks
    : defaults[input.goalIntensity || 'moderate'];
  const safeCap = mode === 'lose'
    ? Math.min(0.9, input.bodyWeightKg * 0.01)
    : Math.min(0.5, input.bodyWeightKg * 0.005);
  return Number((direction * Math.min(Math.max(requested, 0), safeCap)).toFixed(2));
}

export function goalLabel(profile?: UserProfile): string {
  if (!profile) return 'Set up your goal';
  const labels = { lose: 'Fat loss', maintain: 'Maintain weight', gain: 'Build mass', recompose: 'Body recomposition' };
  return labels[profile.goalMode || 'maintain'];
}

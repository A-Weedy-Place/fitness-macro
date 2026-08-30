import { MealType } from '../types';

export function mealForTime(time: string): MealType {
  const hour = Number(time.slice(0, 2));
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

export function mealLabelForTime(time: string) {
  const value = mealForTime(time);
  return value === 'snack' ? 'Afternoon / snack' : `${value[0].toUpperCase()}${value.slice(1)} time`;
}

export function currentTime() {
  const value = new Date();
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

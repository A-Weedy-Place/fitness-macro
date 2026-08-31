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

export function currentTime(timeZone?: string) {
  const value = new Date();
  if (timeZone && timeZone !== 'device') {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
      const hour = parts.find((item) => item.type === 'hour')?.value;
      const minute = parts.find((item) => item.type === 'minute')?.value;
      if (hour && minute) return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } catch {
      // Fall back to the device clock if a manually entered zone is invalid.
    }
  }
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

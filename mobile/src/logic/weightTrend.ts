import { BodyMetricLog } from '../types';

export function weightTrend(weights: BodyMetricLog[]) {
  const latestByDate = new Map<string, BodyMetricLog>();
  for (const item of [...weights].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))) {
    latestByDate.set(item.date, item);
  }
  const recent = [...latestByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  if (!recent.length) return { averageKg: null, changeKg: null, count: 0 };
  const averageKg = recent.reduce((sum, item) => sum + item.weightKg, 0) / recent.length;
  const changeKg = recent.length > 1 ? recent[recent.length - 1].weightKg - recent[0].weightKg : null;
  return { averageKg, changeKg, count: recent.length };
}

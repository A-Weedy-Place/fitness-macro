import { BodyMetricLog } from '../types';
import { DailyAnalyticsPoint, latestWeightByDate } from './analytics';

export interface AdaptiveExpenditure {
  status: 'collecting' | 'updating';
  estimate: number;
  observed: number | null;
  confidence: number;
  loggedDays: number;
  weightSpanDays: number;
}

export function estimateAdaptiveExpenditure(series: DailyAnalyticsPoint[], weights: BodyMetricLog[], baseline: number): AdaptiveExpenditure {
  const startDate = series[0]?.date;
  const endDate = series.at(-1)?.date;
  if (!startDate || !endDate) return { status: 'collecting', estimate: baseline, observed: null, confidence: 0, loggedDays: 0, weightSpanDays: 0 };
  const logged = series.filter((point) => point.logged && point.calories > 0);
  const relevantWeights = latestWeightByDate(weights).filter((item) => item.date >= startDate && item.date <= endDate);
  const first = relevantWeights[0]; const last = relevantWeights.at(-1);
  const span = first && last ? Math.max(0, Math.round((new Date(`${last.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) / 86400000)) : 0;
  // A two-week window reduces the chance that a single salty meal, missed log,
  // or noisy weigh-in changes a person's target.  Automatic updates are still
  // capped by the caller and are never triggered from missing diary data.
  // Fourteen calendar dates are thirteen elapsed 24-hour intervals apart.
  if (logged.length < 10 || !first || !last || span < 13) return { status: 'collecting', estimate: baseline, observed: null, confidence: 0, loggedDays: logged.length, weightSpanDays: span };
  const averageIntake = logged.reduce((sum, point) => sum + point.calories, 0) / logged.length;
  const dailyWeightChange = (last.weightKg - first.weightKg) / span;
  const observed = averageIntake - dailyWeightChange * 7700;
  const bounded = Math.max(baseline * 0.65, Math.min(baseline * 1.35, observed));
  const confidence = Math.min(1, logged.length / 21, (span + 1) / 28);
  return { status: 'updating', estimate: Math.round(baseline * (1 - confidence) + bounded * confidence), observed: Math.round(observed), confidence, loggedDays: logged.length, weightSpanDays: span };
}

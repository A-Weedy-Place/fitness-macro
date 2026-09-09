import { BodyMetricLog } from '../types';
import { DailyAnalyticsPoint, latestWeightByDate } from './analytics';
import { dateDistance, shiftDate, today } from '../utils/dates';

export interface AdaptiveExpenditure {
  status: 'collecting' | 'updating';
  estimate: number;
  observed: number | null;
  confidence: number;
  loggedDays: number;
  weightSpanDays: number;
  reason?: string;
}

export interface AdaptiveExpenditureOptions { completedFoodDays?: string[]; today?: string }

export function estimateAdaptiveExpenditure(series: DailyAnalyticsPoint[], weights: BodyMetricLog[], baseline: number, options: AdaptiveExpenditureOptions = {}): AdaptiveExpenditure {
  const startDate = series[0]?.date;
  const endDate = series.at(-1)?.date;
  const currentDate = options.today || today();
  const complete = new Set(options.completedFoodDays || []);
  const logged = series.filter((point) => complete.has(point.date) && point.date < currentDate && point.logged && Number.isFinite(point.calories) && point.calories > 0);
  const collecting = (reason: string, weightSpanDays = 0): AdaptiveExpenditure => ({ status: 'collecting', estimate: baseline, observed: null, confidence: 0, loggedDays: logged.length, weightSpanDays, reason });
  if (!startDate || !endDate || !Number.isFinite(baseline) || baseline <= 0) return collecting('Not enough complete diary data.');
  const byDate = new Map(logged.map((point) => [point.date, point]));
  const relevantWeights = latestWeightByDate(weights).filter((item) => item.date >= startDate && item.date <= currentDate && item.date <= shiftDate(endDate, 1) && Number.isFinite(item.weightKg) && item.weightKg >= 20 && item.weightKg <= 500);
  // Morning weigh-ins bracket the intake days: use [first date, last date),
  // never intake from before the first weight or today's unfinished diary.
  // Pick the longest fully confirmed window with at least four weigh-ins.
  let selected: { intake: DailyAnalyticsPoint[]; weights: BodyMetricLog[]; span: number } | undefined;
  for (let firstIndex = 0; firstIndex < relevantWeights.length; firstIndex += 1) {
    for (let lastIndex = relevantWeights.length - 1; lastIndex >= firstIndex + 3; lastIndex -= 1) {
      const first = relevantWeights[firstIndex]; const last = relevantWeights[lastIndex];
      const span = dateDistance(first.date, last.date);
      if (span < 14 || span > 28 || (selected && span <= selected.span)) continue;
      const intake = Array.from({ length: span }, (_, index) => byDate.get(shiftDate(first.date, index)));
      if (intake.some((point) => !point)) continue;
      selected = { intake: intake as DailyAnalyticsPoint[], weights: relevantWeights.slice(firstIndex, lastIndex + 1), span };
    }
  }
  if (!selected) return collecting('Confirm at least 14 consecutive completed food days with at least four weigh-ins across the period.');
  const { intake, weights: checkIns, span } = selected;
  // Extreme/mistyped intake must trigger review, not an automatic target change.
  if (intake.some((point) => point.calories < baseline * 0.35 || point.calories > baseline * 2.5)) return collecting('Some completed days need their portions checked before adjusting the plan.', span);
  const averageIntake = intake.reduce((sum, point) => sum + point.calories, 0) / intake.length;
  const xs = checkIns.map((item) => dateDistance(checkIns[0].date, item.date));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanWeight = checkIns.reduce((sum, item) => sum + item.weightKg, 0) / checkIns.length;
  const dailyWeightChange = checkIns.reduce((sum, item, index) => sum + (xs[index] - meanX) * (item.weightKg - meanWeight), 0) / xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const observed = averageIntake - dailyWeightChange * 7700;
  if (!Number.isFinite(observed) || observed < baseline * 0.65 || observed > baseline * 1.35) return collecting('Food and weight changes do not yet support a reliable maintenance adjustment.', span);
  const confidence = Math.min(1, span / 28, checkIns.length / 8);
  return { status: 'updating', estimate: Math.round(baseline * (1 - confidence) + observed * confidence), observed: Math.round(observed), confidence, loggedDays: intake.length, weightSpanDays: span };
}

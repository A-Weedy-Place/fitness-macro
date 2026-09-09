import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthActivities, healthSyncWindow, HealthSyncWindow, latestHealthWeights, reconcileHealthConnectSync, startOfHealthDate } from '../src/logic/healthImport';
import { estimateAdaptiveExpenditure } from '../src/logic/expenditure';
import { DailyAnalyticsPoint, goalForDate } from '../src/logic/analytics';
import { AppState, ActivityEntry, BodyMetricLog, UserProfile } from '../src/types';
import { EMPTY_STATE } from '../src/storage/localDb';

const window: HealthSyncWindow = { startDate: '2026-09-07', endDate: '2026-09-07', startTime: '2026-09-07T00:00:00.000Z', endTime: '2026-09-08T00:00:00.000Z', activitiesComplete: true, weightsComplete: true };
const session = (id: string, origin = 'com.strava', start = '2026-09-07T08:00:00Z', end = '2026-09-07T09:00:00Z', exerciseType = 56) => ({ startTime: start, endTime: end, exerciseType, title: 'Morning run', metadata: { id, dataOrigin: origin } });
function aggregateEnergy(start: string, end: string, calories: number) {
  return async (range: { startTime: string; endTime: string }) => Math.max(0, Math.min(Date.parse(end), Date.parse(range.endTime)) - Math.max(Date.parse(start), Date.parse(range.startTime))) / (Date.parse(end) - Date.parse(start)) * calories;
}

test('duplicate Strava and Fit sessions share one priority-aggregated calorie total', async () => {
  const result = await buildHealthActivities({ sessions: [session('strava'), session('fit', 'com.google.android.apps.fitness')], window, timeZone: 'UTC', aggregateCalories: aggregateEnergy('2026-09-07T08:00:00Z', '2026-09-07T09:00:00Z', 300) });
  assert.equal(result.length, 1);
  assert.equal(result[0].importSource, 'Strava');
  assert.equal(result.reduce((sum, item) => sum + item.caloriesEstimated, 0), 300);
});

test('overlapping workouts allocate each minute and calorie once', async () => {
  const result = await buildHealthActivities({ sessions: [session('run'), session('walk', 'tracker', '2026-09-07T08:30:00Z', '2026-09-07T09:30:00Z', 79)], window, timeZone: 'UTC', aggregateCalories: aggregateEnergy('2026-09-07T08:00:00Z', '2026-09-07T09:30:00Z', 600) });
  assert.equal(result.reduce((sum, item) => sum + item.caloriesEstimated, 0), 600);
  assert.equal(result.reduce((sum, item) => sum + item.durationMinutes, 0), 90);
});

test('daily energy remainder does not invent an all-day exercise duration', async () => {
  const result = await buildHealthActivities({ sessions: [], window, timeZone: 'UTC', aggregateCalories: async () => 500 });
  assert.equal(result[0].caloriesEstimated, 500);
  assert.equal(result[0].durationMinutes, 0);
});

test('a session spanning midnight is split using the selected diary timezone', async () => {
  const twoDays = { ...window, startDate: '2026-09-07', endDate: '2026-09-08', startTime: '2026-09-06T19:00:00Z', endTime: '2026-09-08T19:00:00Z' };
  const start = '2026-09-07T18:30:00Z'; const end = '2026-09-07T19:30:00Z';
  const result = await buildHealthActivities({ sessions: [session('night', 'com.strava', start, end)], window: twoDays, timeZone: 'Asia/Karachi', aggregateCalories: aggregateEnergy(start, end, 300) });
  assert.deepEqual(result.map((item) => [item.date, item.caloriesEstimated, item.durationMinutes]), [['2026-09-07', 150, 30], ['2026-09-08', 150, 30]]);
});

test('calendar boundaries follow DST, and the history window stays inside 30 days', () => {
  const start = startOfHealthDate('2026-03-08', 'America/New_York');
  const end = startOfHealthDate('2026-03-09', 'America/New_York');
  assert.equal((end.getTime() - start.getTime()) / 3600000, 23);
  const result = healthSyncWindow(new Date('2026-09-09T00:30:00Z'), 30, 'Asia/Karachi');
  assert.equal(result.startDate, '2026-08-11');
  assert.ok(Date.parse(result.endTime) - Date.parse(result.startTime) < 30 * 86400000);
});

test('imported weights have structured provenance and latest measurement wins over edit time', () => {
  const result = latestHealthWeights([
    { time: '2026-09-07T08:00:00Z', weight: { inKilograms: 82 }, metadata: { id: 'early', lastModifiedTime: '2026-09-08T08:00:00Z' } },
    { time: '2026-09-07T18:00:00Z', weight: { inKilograms: 81.8 }, metadata: { id: 'later' } }
  ], 'UTC');
  assert.equal(result[0].weightKg, 81.8);
  assert.equal(result[0].source, 'health_connect');
  assert.equal(result[0].healthConnect?.recordId, 'later');
});

const activity = (id: string, date = '2026-09-07', source: ActivityEntry['source'] = 'health_connect'): ActivityEntry => ({ id, date, source, name: id, type: 'run', caloriesEstimated: 300, durationMinutes: 60, createdAt: '' });
const weight = (id: string, value: number, source: BodyMetricLog['source']): BodyMetricLog => ({ id, date: '2026-09-07', weightKg: value, source, enteredAt: '' });

test('successful reconciliation removes deleted workouts and superseded calorie summaries only in its window', () => {
  const state: AppState = { ...EMPTY_STATE, activities: [activity('deleted'), activity('health_active_old'), activity('older', '2026-09-06'), activity('manual', '2026-09-07', 'manual')] };
  const next = reconcileHealthConnectSync(state, { activities: [activity('new_session')], weights: [], syncWindow: window });
  assert.deepEqual(next.activities.map((item) => item.id), ['older', 'manual', 'new_session']);
});

test('corrected imported weights replace prior imports while a deliberate manual check-in wins', () => {
  const incoming = weight('new', 81.5, 'health_connect');
  const importedState = { ...EMPTY_STATE, weights: [weight('old', 82, 'health_connect')] };
  assert.deepEqual(reconcileHealthConnectSync(importedState, { activities: [], weights: [incoming], syncWindow: window }).weights, [incoming]);
  const manual = weight('manual', 81.9, 'manual');
  assert.deepEqual(reconcileHealthConnectSync({ ...EMPTY_STATE, weights: [manual] }, { activities: [], weights: [incoming], syncWindow: window }).weights, [manual]);
});

test('failed or partial sync cannot erase prior data from an unread scope', () => {
  const state = { ...EMPTY_STATE, activities: [activity('keep')], weights: [weight('keep_weight', 82, 'health_connect')] };
  assert.equal(reconcileHealthConnectSync(state, { activities: [], weights: [], syncWindow: null }), state);
  const result = reconcileHealthConnectSync(state, { activities: [], weights: [], syncWindow: { ...window, activitiesComplete: false, weightsComplete: false } });
  assert.deepEqual(result, state);
});

const date = (day: number) => `2026-08-${String(day).padStart(2, '0')}`;
const series = (calories: (day: number) => number): DailyAnalyticsPoint[] => Array.from({ length: 28 }, (_, index) => ({ date: date(index + 1), label: '', calories: calories(index + 1), protein: 100, carbs: 200, fat: 70, activityCalories: 0, activityMinutes: 0, logged: true }));
const checkIns: BodyMetricLog[] = [14, 18, 23, 28].map((day) => ({ id: `w${day}`, date: date(day), weightKg: 82, enteredAt: '' }));

test('partial historical diaries and sparse scale readings never trigger adaptive changes', () => {
  const days = series(() => 2000);
  assert.equal(estimateAdaptiveExpenditure(days, checkIns, 2000).status, 'collecting');
  assert.equal(estimateAdaptiveExpenditure(days, [checkIns[0], checkIns[3]], 2000, { completedFoodDays: days.map((day) => day.date), today: date(29) }).status, 'collecting');
});

test('adaptive intake window exactly matches the dates bracketed by weights', () => {
  const days = series((day) => day < 14 ? 3000 : 2000);
  const result = estimateAdaptiveExpenditure(days, checkIns, 2000, { completedFoodDays: days.map((day) => day.date), today: date(29) });
  assert.equal(result.status, 'updating');
  assert.equal(result.loggedDays, 14);
  assert.equal(result.observed, 2000);
  assert.equal(result.estimate, 2000);
});

test('unfinished today and extreme portion totals cannot be used to lower maintenance', () => {
  const days = series(() => 150);
  assert.equal(estimateAdaptiveExpenditure(days, checkIns, 2000, { completedFoodDays: days.map((day) => day.date), today: date(29) }).status, 'collecting');
  const normal = series(() => 2000);
  assert.equal(estimateAdaptiveExpenditure(normal, checkIns, 2000, { completedFoodDays: normal.map((day) => day.date), today: date(26) }).status, 'collecting');
});

test('historical effective goals stay fixed and unknown old targets remain unknown', () => {
  const profile = { id: 'p', sex: 'male', ageYears: 30, heightCm: 175, bodyWeightKg: 82, activityFactor: 1.4, weeklyWeightChangeKg: 0, adaptiveTdee: 1500 } as UserProfile;
  const history = [{ effectiveFrom: date(1), calories: 2000, protein: 140, carbs: 200, fat: 71 }, { effectiveFrom: date(20), calories: 1500, protein: 140, carbs: 100, fat: 60 }];
  assert.equal(goalForDate([], profile, date(10), history, date(29))?.calories, 2000);
  assert.equal(goalForDate([], profile, date(25), history, date(29))?.calories, 1500);
  assert.equal(goalForDate([], profile, '2026-07-01', history, date(29)), undefined);
});

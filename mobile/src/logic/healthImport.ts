import { ActivityEntry, AppState, BodyMetricLog } from '../types';
import { dateFor, shiftDate } from '../utils/dates';

export type HealthRecord = Record<string, any>;
export type HealthInterval = { startTime: string; endTime: string };
export interface HealthSyncWindow extends HealthInterval {
  startDate: string;
  endDate: string;
  activitiesComplete: boolean;
  weightsComplete: boolean;
}
export interface HealthImportBatch {
  activities: ActivityEntry[];
  weights: BodyMetricLog[];
  syncWindow: HealthSyncWindow | null;
}

/** Convert midnight in the diary zone to an instant, including DST offsets. */
export function startOfHealthDate(date: string, timeZone?: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  if (!timeZone || timeZone === 'device') return new Date(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const wall = Date.UTC(year, month - 1, day);
  let instant = wall;
  for (let index = 0; index < 5; index += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const number = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const actualWall = Date.UTC(number('year'), number('month') - 1, number('day'), number('hour'), number('minute'), number('second'));
    const corrected = instant + wall - actualWall;
    if (corrected === instant) break;
    instant = corrected;
  }
  if (dateFor(new Date(instant), timeZone) !== date) throw new Error('Unable to resolve the Health Connect calendar boundary.');
  return new Date(instant);
}

/** Start on a fully readable day, not 30 days ago at an arbitrary time. */
export function healthSyncWindow(end: Date, days = 30, timeZone?: string): HealthSyncWindow {
  const endDate = dateFor(end, timeZone);
  const startDate = shiftDate(endDate, -Math.max(0, Math.min(29, Math.floor(days) - 1)));
  return { startTime: startOfHealthDate(startDate, timeZone).toISOString(), endTime: end.toISOString(), startDate, endDate, activitiesComplete: false, weightsComplete: false };
}

type MillisecondInterval = { start: number; end: number };
function subtractIntervals(input: MillisecondInterval, covered: MillisecondInterval[]): MillisecondInterval[] {
  let remaining = [input];
  for (const used of covered) remaining = remaining.flatMap((part) => {
    if (used.end <= part.start || used.start >= part.end) return [part];
    return [part.start < used.start && { start: part.start, end: used.start }, used.end < part.end && { start: used.end, end: part.end }].filter(Boolean) as MillisecondInterval[];
  });
  return remaining;
}

export function originOf(record: HealthRecord): string { return String(record.metadata?.dataOrigin || '').trim(); }
export function safeHealthKey(value: string): string { return encodeURIComponent(value); }
export function sourceLabel(origin: string): string {
  if (!origin) return 'Health Connect';
  if (origin.toLowerCase().includes('strava')) return 'Strava';
  const known: Record<string, string> = { 'com.google.android.apps.fitness': 'Google Fit', 'com.samsung.android.app.shealth': 'Samsung Health', 'com.fitbit.FitbitMobile': 'Fitbit', 'com.garmin.android.apps.connectmobile': 'Garmin Connect' };
  return known[origin] || origin;
}

export function selectDistinctHealthSessions(records: HealthRecord[]): HealthRecord[] {
  const priority = (record: HealthRecord) => originOf(record).toLowerCase().includes('strava') ? 2 : 1;
  const valid = records.filter((record) => Number.isFinite(Date.parse(record.startTime)) && Date.parse(record.endTime) > Date.parse(record.startTime));
  const selected: HealthRecord[] = [];
  for (const record of [...valid].sort((a, b) => priority(b) - priority(a) || String(a.startTime).localeCompare(String(b.startTime)))) {
    if (selected.some((other) => {
      const start = Math.max(Date.parse(record.startTime), Date.parse(other.startTime));
      const end = Math.min(Date.parse(record.endTime), Date.parse(other.endTime));
      const shortest = Math.min(Date.parse(record.endTime) - Date.parse(record.startTime), Date.parse(other.endTime) - Date.parse(other.startTime));
      const title = String(record.title || '').trim().toLowerCase();
      return (end - start) / shortest >= 0.8 && (record.exerciseType === other.exerciseType || Boolean(title && title === String(other.title || '').trim().toLowerCase()));
    })) continue;
    selected.push(record);
  }
  return selected;
}

/**
 * The native aggregate is unfiltered by source: Health Connect applies the
 * owner's Activity priorities. Never sum raw calorie records from trackers.
 * Calories are allocated once to disjoint workout intervals, then the daily
 * remainder is recorded separately. Midnight-crossing sessions are split.
 */
export async function buildHealthActivities(input: {
  sessions: HealthRecord[];
  window: HealthSyncWindow;
  timeZone?: string;
  aggregateCalories: (interval: HealthInterval) => Promise<number>;
  aggregateDistance?: (interval: HealthInterval) => Promise<number | undefined>;
}): Promise<ActivityEntry[]> {
  const sessions = selectDistinctHealthSessions(input.sessions);
  const activities: ActivityEntry[] = [];
  for (let date = input.window.startDate; date <= input.window.endDate; date = shiftDate(date, 1)) {
    const dayStart = Math.max(Date.parse(input.window.startTime), startOfHealthDate(date, input.timeZone).getTime());
    const dayEnd = Math.min(Date.parse(input.window.endTime), startOfHealthDate(shiftDate(date, 1), input.timeZone).getTime());
    if (dayEnd <= dayStart) continue;
    const dayInterval = { startTime: new Date(dayStart).toISOString(), endTime: new Date(dayEnd).toISOString() };
    const total = await input.aggregateCalories(dayInterval);
    if (!Number.isFinite(total) || total < 0) throw new Error('Health Connect returned an invalid calorie total.');
    let allocated = 0;
    const covered: MillisecondInterval[] = [];
    for (const session of sessions) {
      const start = Math.max(dayStart, Date.parse(session.startTime));
      const end = Math.min(dayEnd, Date.parse(session.endTime));
      if (end <= start) continue;
      const pieces = subtractIntervals({ start, end }, covered);
      if (!pieces.length) continue;
      let calories = 0; let distance = 0;
      for (const piece of pieces) {
        const interval = { startTime: new Date(piece.start).toISOString(), endTime: new Date(piece.end).toISOString() };
        const value = await input.aggregateCalories(interval);
        if (!Number.isFinite(value) || value < 0) throw new Error('Health Connect returned invalid workout energy.');
        calories += value;
        if (input.aggregateDistance) distance += (await input.aggregateDistance(interval)) || 0;
      }
      // Bucketing/rounding by the native provider cannot push total above day energy.
      calories = Math.min(calories, Math.max(0, total - allocated));
      allocated += calories;
      covered.push(...pieces);
      const nativeId = String(session.metadata?.id || session.metadata?.clientRecordId || `${originOf(session)}_${session.startTime}_${session.endTime}`);
      activities.push({
        id: `health_session_${safeHealthKey(nativeId)}_${date}`, date,
        name: String(session.title || session.notes || exerciseTypeName(Number(session.exerciseType))).trim() || 'Workout',
        source: 'health_connect', importSource: sourceLabel(originOf(session)), type: `health_${Number(session.exerciseType) || 0}`,
        durationMinutes: pieces.reduce((sum, piece) => sum + (piece.end - piece.start) / 60000, 0),
        distanceMeters: distance > 0 ? distance : undefined, caloriesEstimated: calories,
        createdAt: String(session.metadata?.lastModifiedTime || session.endTime),
        healthConnect: { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), recordId: nativeId }
      });
    }
    const remainder = Math.max(0, total - allocated);
    if (remainder > 0) activities.push({
      id: `health_active_${date}`, date, name: 'Other daily activity', source: 'health_connect', importSource: 'Health Connect', type: 'health_connect_daily',
      // Energy intervals are not exercise durations; do not invent 24-hour workouts.
      durationMinutes: 0, caloriesEstimated: remainder, createdAt: dayInterval.endTime, healthConnect: dayInterval
    });
  }
  return activities.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function latestHealthWeights(records: HealthRecord[], timeZone?: string): BodyMetricLog[] {
  const latest = new Map<string, { time: string; item: BodyMetricLog }>();
  for (const record of records) {
    const time = String(record.time || ''); const weightKg = Number(record.weight?.inKilograms);
    if (!Number.isFinite(Date.parse(time)) || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) continue;
    const date = dateFor(new Date(time), timeZone);
    const nativeId = String(record.metadata?.id || record.metadata?.clientRecordId || `${originOf(record)}_${time}`);
    const item: BodyMetricLog = { id: `health_weight_${safeHealthKey(nativeId)}`, date, weightKg, source: 'health_connect', enteredAt: String(record.metadata?.lastModifiedTime || time), healthConnect: { time, recordId: nativeId }, notes: `Imported from Health Connect · ${sourceLabel(originOf(record))}` };
    const current = latest.get(date);
    if (!current || Date.parse(time) > Date.parse(current.time) || (Date.parse(time) === Date.parse(current.time) && Date.parse(item.enteredAt) > Date.parse(current.item.enteredAt))) latest.set(date, { time, item });
  }
  return [...latest.values()].map((value) => value.item).sort((a, b) => a.date.localeCompare(b.date));
}

/** Replace only successfully read scopes in this bounded window; preserve manual data. */
export function reconcileHealthConnectSync(state: AppState, batch: HealthImportBatch): AppState {
  const window = batch.syncWindow;
  if (!window) return state;
  const inWindow = (date: string, instant?: string) => instant
    ? Date.parse(instant) >= Date.parse(window.startTime) && Date.parse(instant) < Date.parse(window.endTime)
    : date >= window.startDate && date <= window.endDate;
  const keptActivities = window.activitiesComplete ? state.activities.filter((item) => item.source !== 'health_connect' || !inWindow(item.date, item.healthConnect?.startTime)) : state.activities;
  const activities = window.activitiesComplete ? [...keptActivities, ...batch.activities] : keptActivities;
  const importedWeight = (item: BodyMetricLog) => item.source === 'health_connect';
  const keptWeights = window.weightsComplete ? state.weights.filter((item) => !importedWeight(item) || !inWindow(item.date, item.healthConnect?.time)) : state.weights;
  const manualDates = new Set(keptWeights.filter((item) => !importedWeight(item)).map((item) => item.date));
  const weights = window.weightsComplete ? [...keptWeights, ...batch.weights.filter((item) => !manualDates.has(item.date))].sort((a, b) => a.date.localeCompare(b.date)) : keptWeights;
  return { ...state, activities, weights };
}

function exerciseTypeName(type: number): string {
  const names: Record<number, string> = { 8: 'Cycling', 9: 'Stationary cycling', 18: 'Elliptical', 26: 'Hiking', 39: 'Indoor rowing', 48: 'Pilates', 53: 'Rowing', 56: 'Run', 57: 'Treadmill run', 64: 'Football', 70: 'Strength training', 73: 'Open-water swim', 74: 'Pool swim', 79: 'Walk', 80: 'Water fitness', 82: 'Wheelchair', 83: 'Workout' };
  return names[type] || 'Workout';
}

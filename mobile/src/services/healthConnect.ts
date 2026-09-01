import { Platform } from 'react-native';
import { ActivityEntry, BodyMetricLog } from '../types';

export interface HealthConnectStatus {
  available: boolean;
  permissionGranted: boolean;
  developmentBuildRequired: boolean;
  message: string;
}

export interface HealthConnectSyncResult {
  status: HealthConnectStatus;
  activities: ActivityEntry[];
  weights: BodyMetricLog[];
  /** The pre-session calorie importer can be safely replaced after this sync. */
  replaceLegacyActivities: boolean;
}

type HealthModule = typeof import('react-native-health-connect');
type HealthRecord = Record<string, any>;
type TimeRange = { operator: 'between'; startTime: string; endTime: string };

const workoutPermissions = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const }
];
const weightPermission = { accessType: 'read' as const, recordType: 'Weight' as const };
const permissions = [...workoutPermissions, weightPermission];

/**
 * Imports Health Connect as a read-only source. Exercise sessions are the
 * primary record because they retain the tracker-provided workout name,
 * duration and origin. Active-calorie intervals are used only as a fallback
 * when a source has no exercise session, so a Strava workout cannot be added
 * twice as both a session and a calorie record.
 */
export async function syncHealthConnect(requestAccess = false, days = 30): Promise<HealthConnectSyncResult> {
  const empty = (status: HealthConnectStatus): HealthConnectSyncResult => ({ status, activities: [], weights: [], replaceLegacyActivities: false });
  if (Platform.OS !== 'android') return empty({ available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is available on Android only.' });

  try {
    const health = await import('react-native-health-connect');
    const initialized = await health.initialize();
    if (!initialized) return empty({ available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is not available or needs an update.' });

    let granted: Array<{ accessType: 'read' | 'write'; recordType: string }> = await health.getGrantedPermissions();
    const has = (recordType: string) => granted.some((item) => item.accessType === 'read' && item.recordType === recordType);
    const missing = permissions.filter((permission) => !has(permission.recordType));
    // Ask for newly added scopes even when an older APK was already connected
    // with just weight or calories.
    if (requestAccess && missing.length) {
      await health.requestPermission(missing);
      granted = await health.getGrantedPermissions();
    }

    const canReadSessions = has('ExerciseSession');
    const canReadActiveCalories = has('ActiveCaloriesBurned');
    const canReadDistance = has('Distance');
    const canReadWeight = has('Weight');
    const permissionGranted = canReadSessions || canReadActiveCalories || canReadWeight;
    if (!permissionGranted) return empty({ available: true, permissionGranted: false, developmentBuildRequired: false, message: 'Allow workout, active-calorie, distance, and weight access to import Health Connect data.' });

    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const timeRangeFilter: TimeRange = { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() };
    const sessions = canReadSessions ? selectDistinctSessions(await readAllRecords(health, 'ExerciseSession', timeRangeFilter)) : [];
    const activeCalories = canReadActiveCalories ? await readAllRecords(health, 'ActiveCaloriesBurned', timeRangeFilter) : [];
    const activities = [
      ...await mapWithConcurrency(sessions, 4, async (session) => buildSessionActivity(health, session, canReadActiveCalories, canReadDistance)),
      ...buildFallbackActivities(activeCalories, sessions)
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const weights = canReadWeight ? latestWeightsByDate(await readAllRecords(health, 'Weight', timeRangeFilter)) : [];
    const parts = [`${sessions.length} workout session${sessions.length === 1 ? '' : 's'}`];
    const fallbackCount = activities.length - sessions.length;
    if (fallbackCount) parts.push(`${fallbackCount} daily activity ${fallbackCount === 1 ? 'summary' : 'summaries'}`);
    if (weights.length) parts.push(`${weights.length} weight check-in${weights.length === 1 ? '' : 's'}`);
    const missingDetail = [!canReadSessions && 'workout sessions', !canReadActiveCalories && 'active calories', !canReadDistance && 'distance', !canReadWeight && 'weight'].filter(Boolean);
    const suffix = missingDetail.length ? ` Allow ${missingDetail.join(', ')} in Health Connect to import more.` : '';
    return {
      status: { available: true, permissionGranted: true, developmentBuildRequired: false, message: `Connected. Found ${parts.join(', ')} from the last ${days} days.${suffix}` },
      activities,
      weights,
      // We only replace older raw-calorie records after successfully reading
      // either that source or richer session data.
      replaceLegacyActivities: canReadSessions || canReadActiveCalories
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const nativeMissing = /TurboModule|Native module|RNHealthConnect|could not be found/i.test(detail);
    return empty({ available: false, permissionGranted: false, developmentBuildRequired: nativeMissing, message: nativeMissing ? 'Install the Weed Fitness APK to enable Health Connect.' : `Health Connect error: ${detail}` });
  }
}

export async function openHealthConnectSettings(): Promise<void> {
  const health = await import('react-native-health-connect');
  health.openHealthConnectSettings();
}

async function readAllRecords(health: HealthModule, recordType: 'ExerciseSession' | 'ActiveCaloriesBurned' | 'Weight', timeRangeFilter: TimeRange): Promise<HealthRecord[]> {
  const records: HealthRecord[] = [];
  let pageToken: string | undefined;
  // A bounded pagination loop catches longer histories without getting stuck
  // if a provider accidentally returns the same token.
  for (let page = 0; page < 20; page += 1) {
    const response = await health.readRecords(recordType, { timeRangeFilter, ascendingOrder: true, pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
    records.push(...recordsFrom(response));
    const nextToken = String((response as { pageToken?: string }).pageToken || '');
    if (!nextToken || nextToken === pageToken) break;
    pageToken = nextToken;
  }
  return distinctNativeRecords(records, recordType);
}

async function buildSessionActivity(health: HealthModule, session: HealthRecord, canReadActiveCalories: boolean, canReadDistance: boolean): Promise<ActivityEntry> {
  const startTime = String(session.startTime);
  const endTime = String(session.endTime || session.startTime);
  const origin = originOf(session);
  const timeRangeFilter: TimeRange = { operator: 'between', startTime, endTime };
  const [caloriesEstimated, distanceMeters] = await Promise.all([
    canReadActiveCalories ? aggregateActiveCalories(health, timeRangeFilter, origin) : Promise.resolve(0),
    canReadDistance ? aggregateDistance(health, timeRangeFilter, origin) : Promise.resolve(undefined)
  ]);
  const nativeId = String(session.metadata?.id || session.metadata?.clientRecordId || stableRecordKey(session, 'session'));
  return {
    id: `health_session_${safeKey(nativeId)}`,
    date: localDate(startTime),
    name: String(session.title || session.notes || exerciseTypeName(Number(session.exerciseType))).trim() || 'Workout',
    source: 'health_connect',
    importSource: sourceLabel(origin),
    type: `health_${Number(session.exerciseType) || 0}`,
    durationMinutes: durationMinutes(startTime, endTime),
    distanceMeters,
    caloriesEstimated,
    createdAt: String(session.metadata?.lastModifiedTime || endTime)
  };
}

async function aggregateActiveCalories(health: HealthModule, timeRangeFilter: TimeRange, origin: string): Promise<number> {
  try {
    const result = await health.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, ...(origin ? { dataOriginFilter: [origin] } : {}) });
    return Math.max(0, Number(result.ACTIVE_CALORIES_TOTAL?.inKilocalories || 0));
  } catch {
    // A source can expose a workout but not matching energy. Keep the session.
    return 0;
  }
}

async function aggregateDistance(health: HealthModule, timeRangeFilter: TimeRange, origin: string): Promise<number | undefined> {
  try {
    const result = await health.aggregateRecord({ recordType: 'Distance', timeRangeFilter, ...(origin ? { dataOriginFilter: [origin] } : {}) });
    const meters = Number(result.DISTANCE?.inMeters || 0);
    return meters > 0 ? meters : undefined;
  } catch {
    return undefined;
  }
}

function buildFallbackActivities(activeCalories: HealthRecord[], sessions: HealthRecord[]): ActivityEntry[] {
  const groups = new Map<string, { origin: string; date: string; records: HealthRecord[] }>();
  for (const record of activeCalories) {
    if (isCoveredBySession(record, sessions)) continue;
    const startTime = String(record.startTime);
    const origin = originOf(record);
    const date = localDate(startTime);
    const key = `${date}|${origin || 'health_connect'}`;
    const group = groups.get(key) || { origin, date, records: [] };
    group.records.push(record); groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const intervals = group.records.map((record) => ({ start: Date.parse(String(record.startTime)), end: Date.parse(String(record.endTime || record.startTime)) }));
    const firstStart = Math.min(...intervals.map((item) => item.start));
    const lastEnd = Math.max(...intervals.map((item) => item.end));
    return {
      id: `health_active_${safeKey(`${group.date}_${group.origin || 'health'}`)}`,
      date: group.date,
      name: `${sourceLabel(group.origin)} daily activity`,
      source: 'health_connect' as const,
      importSource: sourceLabel(group.origin),
      type: 'health_connect_daily',
      durationMinutes: mergedIntervalMinutes(intervals),
      caloriesEstimated: group.records.reduce((total, record) => total + Math.max(0, Number(record.energy?.inKilocalories || 0)), 0),
      createdAt: new Date(lastEnd || firstStart).toISOString()
    };
  }).filter((activity) => activity.caloriesEstimated > 0 || activity.durationMinutes > 0);
}

function latestWeightsByDate(records: HealthRecord[]): BodyMetricLog[] {
  const latestByDate = new Map<string, BodyMetricLog>();
  for (const record of records) {
    const time = String(record.time || record.metadata?.lastModifiedTime || new Date().toISOString());
    const item: BodyMetricLog = {
      id: `health_weight_${safeKey(String(record.metadata?.id || record.metadata?.clientRecordId || time))}`,
      date: localDate(time),
      weightKg: Number(record.weight?.inKilograms || 0),
      enteredAt: String(record.metadata?.lastModifiedTime || time),
      notes: `Imported from Health Connect · ${sourceLabel(originOf(record))}`
    };
    const current = latestByDate.get(item.date);
    if (item.weightKg > 0 && (!current || item.enteredAt >= current.enteredAt)) latestByDate.set(item.date, item);
  }
  return [...latestByDate.values()];
}

function selectDistinctSessions(records: HealthRecord[]): HealthRecord[] {
  const sorted = [...records].sort((a, b) => sessionPriority(b) - sessionPriority(a) || Date.parse(String(a.startTime)) - Date.parse(String(b.startTime)));
  const selected: HealthRecord[] = [];
  for (const record of sorted) if (!selected.some((existing) => duplicateSession(record, existing))) selected.push(record);
  return selected.sort((a, b) => Date.parse(String(a.startTime)) - Date.parse(String(b.startTime)));
}

function duplicateSession(a: HealthRecord, b: HealthRecord): boolean {
  const startA = Date.parse(String(a.startTime)); const endA = Date.parse(String(a.endTime));
  const startB = Date.parse(String(b.startTime)); const endB = Date.parse(String(b.endTime));
  const shortest = Math.min(endA - startA, endB - startB);
  const overlap = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  const titleA = normalizeName(a.title || a.notes); const titleB = normalizeName(b.title || b.notes);
  return shortest > 0 && overlap / shortest >= 0.8 && (Number(a.exerciseType) === Number(b.exerciseType) || Boolean(titleA && titleA === titleB));
}

function isCoveredBySession(record: HealthRecord, sessions: HealthRecord[]): boolean {
  const start = Date.parse(String(record.startTime)); const end = Date.parse(String(record.endTime || record.startTime));
  const length = Math.max(1, end - start); const origin = originOf(record);
  return sessions.some((session) => {
    const sessionOrigin = originOf(session);
    if (origin && sessionOrigin && origin !== sessionOrigin) return false;
    const overlap = Math.max(0, Math.min(end, Date.parse(String(session.endTime))) - Math.max(start, Date.parse(String(session.startTime))));
    return overlap / length >= 0.8;
  });
}

function recordsFrom(value: unknown): HealthRecord[] { const response = value as { records?: HealthRecord[]; result?: HealthRecord[] }; return response.records || response.result || []; }
function distinctNativeRecords(records: HealthRecord[], recordType: string): HealthRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => { const key = String(record.metadata?.id || record.metadata?.clientRecordId || stableRecordKey(record, recordType)); if (seen.has(key)) return false; seen.add(key); return true; });
}
function stableRecordKey(record: HealthRecord, kind: string): string { return `${kind}_${originOf(record)}_${record.startTime || record.time || ''}_${record.endTime || ''}`; }
function originOf(record: HealthRecord): string { return String(record.metadata?.dataOrigin || '').trim(); }
function safeKey(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180); }
function normalizeName(value: unknown): string { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function durationMinutes(start: string, end: string): number { return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000)); }
function localDate(value: string): string { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function sessionPriority(record: HealthRecord): number { const origin = originOf(record).toLowerCase(); return origin.includes('strava') ? 3 : origin ? 2 : 1; }
function sourceLabel(origin: string): string {
  if (!origin) return 'Health Connect';
  if (origin.toLowerCase().includes('strava')) return 'Strava';
  const known: Record<string, string> = { 'com.google.android.apps.fitness': 'Google Fit', 'com.google.android.apps.healthdata': 'Health Connect', 'com.samsung.android.app.shealth': 'Samsung Health', 'com.fitbit.FitbitMobile': 'Fitbit', 'com.garmin.android.apps.connectmobile': 'Garmin Connect' };
  return known[origin] || origin.split('.').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}
function exerciseTypeName(type: number): string {
  const names: Record<number, string> = { 8: 'Cycling', 9: 'Stationary cycling', 18: 'Elliptical', 26: 'Hiking', 39: 'Indoor rowing', 48: 'Pilates', 53: 'Rowing', 56: 'Run', 57: 'Treadmill run', 64: 'Football', 70: 'Strength training', 73: 'Open-water swim', 74: 'Pool swim', 79: 'Walk', 80: 'Water fitness', 82: 'Wheelchair', 83: 'Workout' };
  return names[type] || 'Workout';
}
function mergedIntervalMinutes(intervals: Array<{ start: number; end: number }>): number {
  const valid = intervals.filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end)).map((item) => ({ start: item.start, end: Math.max(item.start, item.end) })).sort((a, b) => a.start - b.start);
  if (!valid.length) return 0;
  let milliseconds = 0; let current = valid[0];
  for (const next of valid.slice(1)) { if (next.start <= current.end) current.end = Math.max(current.end, next.end); else { milliseconds += current.end - current.start; current = next; } }
  return Math.max(1, Math.round((milliseconds + current.end - current.start) / 60000));
}
async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []; let index = 0;
  async function worker() { while (index < items.length) { const current = index; index += 1; results[current] = await mapper(items[current]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
